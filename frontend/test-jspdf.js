import fs from 'fs';
import { jsPDF } from 'jspdf';
import { SILAMBAM_LOGO_BASE64 } from './src/app/utils/resultPdf/silambam/silambamAssets.ts';

const doc = new jsPDF();
try {
  doc.addImage(SILAMBAM_LOGO_BASE64, 'PNG', 10, 10, 25, 25);
  doc.save('test.pdf');
  console.log('Success with original string');
} catch (e) {
  console.error('Error with original string:', e.message);
}

const cleanB64 = (b64) => b64.includes(',') ? b64.split(',')[1] : b64;
try {
  const doc2 = new jsPDF();
  doc2.addImage(cleanB64(SILAMBAM_LOGO_BASE64), 'PNG', 10, 10, 25, 25);
  doc2.save('test2.pdf');
  console.log('Success with cleaned string');
} catch (e) {
  console.error('Error with cleaned string:', e.message);
}
