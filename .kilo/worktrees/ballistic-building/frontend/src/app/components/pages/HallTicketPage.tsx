import { useRef, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
 Calendar,
 Clock,
 MapPin,
 Download,
 Printer,
 ArrowLeft,
 ArrowRight,
 Phone,
 MessageCircle,
 Home,
 Book,
 User,
 Shield,
 Award,
 AlertCircle,
  Check,
  CheckCircle,
} from 'lucide-react';
import { belts } from '../../data';
import { Student } from '../../types';
import logo from '../../../assets/shadow-kai-logo.png';
import badgeLogo from '../../../assets/shadow-kai-logo.png';
import { uploadHallTicketPDF } from '../../services/storageService';
import { firebaseStudentService, firebaseBeltTestService } from '../../services/firebaseData';
import { BeltTest } from '../../types/admin';
import { getMascotImage, getMascotAccentColor, preloadImage } from '../../utils/mascot';
import { HallTicketCard } from '../shared/HallTicketCard';
import { ensureAppFontsLoaded, waitForClonedStylesheets } from '../../utils/html2canvasCaptureHelpers';

import { useDialog } from "../../contexts/DialogContext";

interface HallTicketPageProps {
 student: Student;
 onBack: () => void;
 onRegisterNew?: () => void;
}

const FALLBACK_EVENT = {
 name: 'Shadow Kai â€” Karate Belt Test',
 org: 'Tamil Nadu Karate Association Â· à®¤à®®à®¿à®´à¯à®¨à®¾à®Ÿà¯ à®•à®°à®¾à®¤à¯à®¤à¯‡ à®šà®™à¯à®•à®®à¯',
 date: 'TBD',
 time: 'TBD',
 venue: 'TBD',
};

export default function HallTicketPage({ student, onBack, onRegisterNew }: HallTicketPageProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const belt = belts[student.beltIndex ?? 0];
  const { showAlert } = useDialog();
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [beltTest, setBeltTest] = useState<BeltTest | null>(null);

  const isSilambam = (student.programType || "").toUpperCase() === 'SELAMBAM';
  
  const mascotSrc = getMascotImage(isSilambam ? 'SILAMBAM' : 'KARATE', isSilambam ? `Stage ${student.stageLevel || 1}` : belt.to);
  const accentColor = getMascotAccentColor(isSilambam ? 'SILAMBAM' : 'KARATE', isSilambam ? `Stage ${student.stageLevel || 1}` : belt.to);

  useEffect(() => {
    const fetchBeltTest = async () => {
      if (student.beltTestId) {
        try {
          const bt = await firebaseBeltTestService.getById(student.beltTestId);
          setBeltTest(bt);
        } catch (error) {
          console.error("Failed to fetch belt test:", error);
        }
      }
    };
    fetchBeltTest();
  }, [student.beltTestId]);

 useEffect(() => {
 // Intercept browser back button to start a new registration
 window.history.pushState(null, '', window.location.href);
 const handlePopState = () => {
 if (onRegisterNew) {
 onRegisterNew();
 }
 };
 window.addEventListener('popstate', handlePopState);
 return () => window.removeEventListener('popstate', handlePopState);
 }, [onRegisterNew]);

  const hasAutoDownloaded = useRef(false);

  const initials = (student.name || 'SK')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const qrValue = JSON.stringify({
    id: student.id,
    name: student.name,
    belt: `${belt.from} â†’ ${belt.to}`,
    school: student.school,
  });

  const handleDownloadPDF = async () => {
  if (!receiptRef.current) return;
  try {
  if (mascotSrc) {
    await preloadImage(mascotSrc);
  }
    await ensureAppFontsLoaded();
    const html2canvas = (await import('html2canvas-pro')).default;
    const jsPDF = (await import('jspdf')).default;

    const canvas = await html2canvas(receiptRef.current, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: 1024,
    onclone: async (doc) => {
      const el = doc.getElementById(`receipt-print-area-${student.id}`);
      if (el) {
        el.style.transform = 'scale(1)';
      }
      await waitForClonedStylesheets(doc);
    }
    });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  
  const pdfWidth = canvas.width * 0.264583; // convert px to mm
  const pdfHeight = canvas.height * 0.264583;
  
  const pdf = new jsPDF({
  orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
  unit: 'mm',
  format: [pdfWidth, pdfHeight],
  compress: true,
  });

  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(`ShadowKai_Receipt_${student.id}.pdf`);
  } catch (err) {
  console.error('PDF generation failed:', err);
  await showAlert({
  title: "PDF Download Failed",
  message: "Could not generate the PDF. Please use the Print button instead.",
  variant: "error",
  });
  }
  };

  const generateAndUploadHallTicket = async () => {
    if (!receiptRef.current || isProcessing) return;
    
    // Idempotency check
    if ((student as any).registrationWhatsappSent) {
//       console.log("WhatsApp already sent for this registration. Skipping upload.");
      setIsInitialLoad(false);
      return;
    }

    setIsProcessing(true);
    setUploadStatus("Generating Hall Ticket...");
    
    try {
      let pdfBlob: Blob;
      let finalHallTicketUrl = (student as any).hallTicketUrl;
      
      // Only generate and upload if not already uploaded
      if (!finalHallTicketUrl) {
        if (mascotSrc) {
          await preloadImage(mascotSrc);
        }
          await ensureAppFontsLoaded();
          const html2canvas = (await import('html2canvas-pro')).default;
          const jsPDF = (await import('jspdf')).default;

          const canvas = await html2canvas(receiptRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: 1024,
            onclone: async (doc) => {
              const el = doc.getElementById(`receipt-print-area-${student.id}`);
              if (el) {
                el.style.transform = 'scale(1)';
              }
              await waitForClonedStylesheets(doc);
            }
          });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        const pdfWidth = canvas.width * 0.264583;
        const pdfHeight = canvas.height * 0.264583;

        const pdf = new jsPDF({
          orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [pdfWidth, pdfHeight],
          compress: true,
        });
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdfBlob = pdf.output('blob');
        
        setUploadStatus("Securing Hall Ticket...");
        const uploadResult = await uploadHallTicketPDF(student.id, pdfBlob, student.programType);
        finalHallTicketUrl = uploadResult.downloadURL;
      }

      if (!finalHallTicketUrl) throw new Error("Upload returned empty URL");

      setUploadStatus("Sending Notification...");
      
      const backendUrl = import.meta.env.VITE_API_BASE_URL || '';
      if (student.whatsapp) {
        const response = await fetch(`${backendUrl}/api/whatsapp/send-registration-whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: student.id,
            pdfUrl: finalHallTicketUrl // Pass URL directly to backend
          })
        });

        if (response.ok) {
//           console.log("Backend queued the WhatsApp message successfully.");
        }
      }
      
      // Auto-download the PDF for the user
      if (pdfBlob) {
        try {
          const url = URL.createObjectURL(pdfBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `ShadowKai_Receipt_${student.id}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (dlErr) {
          console.error("Auto-download failed:", dlErr);
        }
      }

      setUploadStatus(null);
    } catch (err) {
      console.error('PDF upload/webhook failed:', err);
      await showAlert({
        title: "Notification Failed",
        message: "Failed to secure the Hall Ticket or send the notification. The student is registered, but the WhatsApp message could not be sent.",
        variant: "error",
      });
      setUploadStatus(null);
    } finally {
      setIsProcessing(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    if (!hasAutoDownloaded.current) {
      hasAutoDownloaded.current = true;
      // Wait for rendering and images to fully load before capturing
      setTimeout(() => {
        generateAndUploadHallTicket();
      }, 1500);
    }
  }, []);

 const handlePrint = () => {
 window.print();
 };

  return (
  <div style={{ minHeight: '100vh', background: 'var(--off)', position: 'relative' }}>
   {/* Processing Overlay */}
   {(isInitialLoad || isProcessing) && (
     <div style={{
       position: 'fixed', inset: 0, zIndex: 9999, background: '#ffffff',
       display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
     }}>
       <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
       <div className="text-sm font-bold text-gray-800">{uploadStatus || "Finalizing Registration..."}</div>
       <div className="text-sm text-gray-500 mt-2">Please do not close this page.</div>
     </div>
   )}
  {/* Header */}
 <div style={{ background: 'var(--ink)', padding: '0 28px', position: 'sticky', top: 0, zIndex: 50 }}>
 <div className="max-w-[960px] mx-auto flex items-center gap-4 py-4">
 {/* Logo */}
 <img
 src={logo}
 alt="Shadow Kai"
 className="w-9 h-9 object-cover"
 />

 <div className="flex items-center gap-2 ml-auto">
          <StepDot num={1} label="Register" done />
          <div className="w-8 h-[1.5px] bg-white dark:bg-zinc-950/20 hidden sm:block" />
          <StepDot num={2} label="Payment" done />
          <div className="w-8 h-[1.5px] bg-white dark:bg-zinc-950/20 hidden sm:block" />
          <StepDot num={3} label="Receipt" active />
        </div>
 </div>
 </div>

 {/* Green success banner */}
 <div
 style={{
 background: 'linear-gradient(135deg, #004d1c 0%, #007A30 60%, #00C853 100%)',
 padding: '36px 28px 32px',
 }}
 >
 <div className="max-w-[960px] mx-auto">
 <div className="flex items-center gap-2 mb-3">
 <div
 className="w-7 h-7 rounded-full flex items-center justify-center"
 style={{ background: 'rgba(255,255,255,.2)' }}
 >
 <Shield size={14} color="white" />
 </div>
 <span className="text-[9px] font-bold tracking-[.12em] uppercase" style={{ color: 'rgba(255,255,255,.7)' }}>
 Payment Successful
 </span>
 </div>
 <h1
 style={{
 fontFamily: "'Bebas Neue', sans-serif",
 fontSize: 'clamp(21px,4.5vw,51px)',
 letterSpacing: '3px',
 color: '#fff',
 lineHeight: 1,
 }}
 >
 YOUR RECEIPT
 <br />
 <span style={{ color: 'var(--yellow)' }}>IS READY</span>
 </h1>
 <p className="text-[10.5px] font-bold mt-2.5" style={{ color: 'rgba(255,255,255,.7)' }}>
 à®¨à¯à®´à¯ˆà®µà¯à®šà¯ à®šà¯€à®Ÿà¯à®Ÿà¯ â€” Download and present this at the venue
 </p>
 </div>
 </div>

 {/* Receipt Card Area */}
 <div className="max-w-[860px] mx-auto px-5 py-8 pb-[60px]">
  {/* Action Notice */}
  <div
  className="flex items-start gap-3 px-4 py-3.5 rounded-xl mb-6"
  style={{
  background: 'rgba(255,140,0,.08)',
  border: '1.5px solid rgba(255,140,0,.25)',
  }}
  >
  <AlertCircle size={16} color="var(--orange)" className="mt-0.5 flex-shrink-0" />
  <p className="text-[9.75px] font-bold" style={{ color: '#664400' }}>
  Please download and bring this receipt for the test. Without this receipt, entry may be denied at the venue.
  </p>
  </div>

  <div style={{ display: 'flex', justifyContent: 'center' }}>
    <HallTicketCard 
      ref={receiptRef}
      student={student}
      beltTest={beltTest}
      belt={belt}
      isSilambam={isSilambam}
      mascotSrc={mascotSrc}
      accentColor={accentColor}
    />
  </div>

  {/* Action Buttons */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
 <button
 onClick={handleDownloadPDF}
 className="flex items-center justify-center gap-2 px-4 py-4 rounded-2xl border-none cursor-pointer transition-all duration-200 hover:translate-y-[-2px] hover:shadow-[0_12px_32px_rgba(0,0,0,.2)] active:translate-y-0"
 style={{
 background: 'linear-gradient(135deg, var(--orange) 0%, #ff6b00 100%)',
 fontFamily: "'Bebas Neue', sans-serif",
 fontSize: '18px',
 letterSpacing: '1px',
 color: '#fff',
 }}
 >
 <Download size={18} />
 DOWNLOAD PDF
 </button>
 <button
 onClick={handlePrint}
 className="flex items-center justify-center gap-2 px-4 py-4 rounded-2xl cursor-pointer transition-all duration-200 hover:translate-y-[-2px] hover:shadow-[0_12px_32px_rgba(0,0,0,.12)] active:translate-y-0"
 style={{
 background: '#fff',
 fontFamily: "'Bebas Neue', sans-serif",
 fontSize: '18px',
 letterSpacing: '1px',
 color: 'var(--ink)',
 border: '2px solid var(--border-color)',
 }}
 >
 <Printer size={18} />
 PRINT RECEIPT
 </button>
 {onRegisterNew && (
 <button
 onClick={onRegisterNew}
 className="flex items-center justify-center gap-2 px-4 py-4 rounded-2xl cursor-pointer transition-all duration-200 hover:translate-y-[-2px] hover:shadow-[0_12px_32px_rgba(0,0,0,.12)] active:translate-y-0"
 style={{
 background: 'var(--ink)',
 fontFamily: "'Bebas Neue', sans-serif",
 fontSize: '18px',
 letterSpacing: '1px',
 color: '#fff',
 border: 'none',
 }}
 >
 <User size={18} />
 NEW REGISTRATION
 </button>
 )}
 </div>

 <p
 className="text-center text-[9px] mt-4"
 style={{ color: 'var(--muted-color)', fontWeight: 600 }}
 >
 ðŸ‘‰ Please download and bring this receipt for the test. Receipt ID: {student.id}
 </p>
 </div>
 </div>
 );
}

/* â”€â”€ Sub-components â”€â”€ */

function StepDot({ num, label, done, active }: { num: number; label: string; done?: boolean; active?: boolean }) {
 return (
 <div className="flex items-center gap-1.5">
 <div
 className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
 style={{
 background: done
 ? 'var(--green)'
 : active
 ? 'var(--orange)'
 : 'rgba(255,255,255,.15)',
 fontSize: '11px',
 fontWeight: 800,
 color: done || active ? '#fff' : 'rgba(255,255,255,.4)',
 }}
 >
 {done ? <CheckCircle size={13} strokeWidth={2.5} /> : num}
 </div>
 <span
 className="text-[8.25px] font-bold hidden sm:block uppercase tracking-wider"
 style={{ color: active ? '#fff' : done ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.3)' }}
 >
 {label}
 </span>
 </div>
 );
}
