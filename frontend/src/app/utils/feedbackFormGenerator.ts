import { StudentRecord } from '../types/admin';
import { generateResultCertificates } from './resultPdf/generateResultCertificate';

export async function generateFeedbackForms(students: StudentRecord[]) {
  return generateResultCertificates(students);
}
