// This file provides backward compatibility wrapper for Firebase services
// Import Firebase services instead of localStorage
export { firebaseBeltTestService as beltTestService } from "../services/firebaseData";
export { firebaseStudentService as studentService } from "../services/firebaseData";
export { firebaseFeeStructureService as feeStructureService } from "../services/firebaseData";
export { firebaseAuthService as adminAuth } from "../services/firebaseAuth";
