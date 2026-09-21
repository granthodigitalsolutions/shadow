import { createRoot } from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { ResultCertificateCard, ResultCertificateStudentInfo } from '../../components/shared/ResultCertificateCard';
import { getGrade } from '../../constants/scoring';
import { StudentRecord } from '../../types/admin';
import { ensureAppFontsLoaded, waitForClonedStylesheets } from '../html2canvasCaptureHelpers';

type StudentWithTestDate = StudentRecord & { beltTestDate?: string; grade?: string };

/**
 * Renders a ResultCertificateCard off-screen, captures it with html2canvas,
 * and returns the canvas. Mirrors the hall-ticket capture pattern so both
 * PDF flows behave consistently.
 */
async function captureCertificateCanvas(info: ResultCertificateStudentInfo): Promise<HTMLCanvasElement> {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureAppFontsLoaded();

      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.opacity = '0';
      container.style.width = '800px';
      container.style.height = '1131px';
      document.body.appendChild(container);

      const root = createRoot(container);
      root.render(<ResultCertificateCard student={info} />);

      // Give React/webfonts time to paint before capture
      setTimeout(async () => {
        try {
          const element = container.querySelector('[id^="result-certificate-"]') as HTMLElement;
          if (!element) throw new Error('Could not find result-certificate element');

          const canvas = await html2canvas(element, {
            scale: 2.2, // sharp enough for print/screen without bloating the PDF
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: 800,
            windowHeight: 1131,
            onclone: (clonedDoc: Document) => waitForClonedStylesheets(clonedDoc),
          });

          root.unmount();
          container.remove();
          resolve(canvas);
        } catch (e) {
          root.unmount();
          container.remove();
          reject(e);
        }
      }, 400);
    } catch (e) {
      reject(e);
    }
  });
}

function toCertificateInfo(student: StudentWithTestDate): ResultCertificateStudentInfo {
  return {
    id: student.id,
    name: student.name,
    school: student.school,
    programType: student.programType,
    beltLevel: student.beltLevel,
    stageLevel: student.stageLevel,
    percentage: student.percentage ?? 0,
    grade: student.grade || getGrade(student.percentage),
    testDate: student.beltTestDate || student.testDate,
  };
}

/**
 * Builds a single jsPDF document containing one certificate page per student.
 * JPEG quality 0.9 keeps the file small enough for Firebase Storage while
 * still reading crisp on screen and in print.
 */
export async function generateResultCertificates(students: StudentWithTestDate[]): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  for (let i = 0; i < students.length; i++) {
    const canvas = await captureCertificateCanvas(toCertificateInfo(students[i]));
    const imgData = canvas.toDataURL('image/jpeg', 0.9);

    if (i > 0) doc.addPage('a4', 'portrait');
    doc.addImage(imgData, 'JPEG', 0, 0, 210, 296.89);
  }

  return doc;
}
