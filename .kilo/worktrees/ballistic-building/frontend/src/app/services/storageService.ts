import { RESULT_STORAGE } from '../constants/programs';
import { ref, uploadBytes, getDownloadURL, getMetadata, deleteObject } from "firebase/storage";
import { storage } from "../config/firebase";


export const deleteOldResultPDF = async (existingPath?: string): Promise<void> => {
  if (!existingPath) return;
  if (!existingPath.startsWith("karate/") && !existingPath.startsWith("silambam/") && !existingPath.startsWith("results/")) {
    console.warn("[Storage] Safety check failed: invalid deletion path", existingPath);
    return;
  }
  try {
//     console.log("[Storage] Existing PDF found:", existingPath);
//     console.log("[Storage] Deleting old PDF...");
    const oldFileRef = ref(storage, existingPath);
    await deleteObject(oldFileRef);
//     console.log("[Storage] Old PDF deleted successfully");
  } catch (error) {
    console.warn("[Storage] Failed to delete old PDF:", error);
  }
};

export const uploadResultPDF = async (studentId: string, pdfBlob: Blob, programType?: string): Promise<{ downloadURL: string, folder: string, fullPath: string }> => {
  try {
    const progType = (programType?.toUpperCase() || 'KARATE') as keyof typeof RESULT_STORAGE;
    const folder = RESULT_STORAGE[progType] || "results/karate";
//     console.log(`[Upload] Program:`, programType);
//     console.log(`[Upload] Folder:`, folder);
    
    // 5. Prevent Filename Collisions
    const fileName = `${studentId}_${Date.now()}_${crypto.randomUUID()}.pdf`;
    const fullPath = `${folder}/${fileName}`;
    const storageRef = ref(storage, fullPath);
    
//     console.log(`[Upload] Full Path:`, fullPath);
//     console.log(`[Upload] Uploading Blob to ${fullPath}...`);
    const metadataObj = {
      contentType: "application/pdf",
      customMetadata: {
        studentId: studentId,
        program: progType.toLowerCase(),
        tournamentYear: new Date().getFullYear().toString()
      }
    };
    
    let snapshot;
    let attempt = 0;
    const maxRetries = 3;
    const delays = [1000, 2000, 4000]; // 1s, 2s, 4s

    while (attempt <= maxRetries) {
      try {
        snapshot = await uploadBytes(storageRef, pdfBlob, metadataObj);
        break; // Upload succeeded
      } catch (err) {
        if (attempt === maxRetries) throw err;
        console.warn(`[Upload] Upload failed, retrying in ${delays[attempt]}ms... (${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delays[attempt]));
        attempt++;
      }
    }
//     console.log("[Upload] Upload complete to Firebase Storage.");
    
    // 4. Upload Verification
    const metadata = await getMetadata(snapshot.ref);
//     console.log("[Upload] Verified upload metadata:", metadata.name, metadata.size, "bytes");
    
    // 2. Exact Sequence
    const downloadURL = await getDownloadURL(snapshot.ref);
//     console.log("[Upload] Download URL generated:", downloadURL);
    
    return { downloadURL, folder, fullPath };
  } catch (error) {
    console.error("[Upload] Ã¢ÂÅ’ Upload failed:", error);
    throw error;
  }
};

export const uploadHallTicketPDF = async (studentId: string, pdfBlob: Blob, programType: string = 'KARATE'): Promise<{ downloadURL: string, fileName: string }> => {
  try {
//     console.log(`[Upload] Uploading Hall Ticket for student ${studentId}...`);
    
    // Prevent Filename Collisions
    const fileName = `${studentId}_HallTicket_${Date.now()}.pdf`;
    const folderName = programType.toLowerCase() === 'selambam' || programType.toLowerCase() === 'silambam' ? 'silambam' : 'karate';
    const fullPath = `halltickets/${folderName}/${fileName}`;
    const storageRef = ref(storage, fullPath);
    
    const metadataObj = {
      contentType: "application/pdf",
      customMetadata: {
        studentId: studentId,
        type: "hallticket"
      }
    };
    
    let snapshot;
    let attempt = 0;
    const maxRetries = 3;
    const delays = [1000, 2000, 4000]; // 1s, 2s, 4s

    while (attempt <= maxRetries) {
      try {
        snapshot = await uploadBytes(storageRef, pdfBlob, metadataObj);
        break; // Upload succeeded
      } catch (err) {
        if (attempt === maxRetries) throw err;
        console.warn(`[Upload] Hall Ticket upload failed, retrying in ${delays[attempt]}ms... (${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delays[attempt]));
        attempt++;
      }
    }
    
    // Upload Verification
    const metadata = await getMetadata(snapshot.ref);
//     console.log("[Upload] Verified hall ticket upload metadata:", metadata.name, metadata.size, "bytes");
    
    const downloadURL = await getDownloadURL(snapshot.ref);
//     console.log("[Upload] Hall Ticket Download URL generated:", downloadURL);
    
    return { downloadURL, fileName };
  } catch (error) {
    console.error("[Upload] Ã¢ÂÅ’ Hall Ticket upload failed:", error);
    throw error;
  }
};
