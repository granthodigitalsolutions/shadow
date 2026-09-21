import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  writeBatch,
  limit,
  orderBy,
  startAfter,
  DocumentSnapshot,
  Timestamp,
  onSnapshot,
  deleteField,
} from "firebase/firestore";
import { db } from "../config/firebase";
import {
  BeltTest,
  StudentRecord,
  School,
  Batch,
  AdminSettings,
  AdminUser,
} from "../types/admin";
import { filterEligibleStudents } from "../utils/batchEligibility";

// Helper function to retry operations on transient errors
export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (error.code === "permission-denied" || error.code === "not-found") {
        throw error;
      }
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw new Error("Operation failed after retries");
};

// Belt Test Service
export const firebaseBeltTestService = {
  getAll: async (programType?: "KARATE" | "SELAMBAM"): Promise<BeltTest[]> => {
    const conditions = [];
    if (programType) {
      conditions.push(where("programType", "==", programType));
    }
    const q = query(collection(db, "beltTests"), ...conditions);
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as BeltTest)
      .filter((t) => !(t as any).isDeleted);
  },

  getActive: async (
    programType?: "KARATE" | "SELAMBAM",
  ): Promise<BeltTest | null> => {
    const conditions = [where("isActive", "==", true)];
    if (programType) {
      conditions.push(where("programType", "==", programType));
    }
    const q = query(collection(db, "beltTests"), ...conditions);
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as BeltTest;
  },

  listenActive: (
    callback: (test: BeltTest | null) => void,
    programType?: "KARATE" | "SELAMBAM",
  ) => {
    const conditions = [where("isActive", "==", true)];
    if (programType) {
      conditions.push(where("programType", "==", programType));
    }
    const q = query(collection(db, "beltTests"), ...conditions);
    return onSnapshot(q, (snap) => {
      if (snap.empty) {
        callback(null);
      } else {
        callback({ id: snap.docs[0].id, ...snap.docs[0].data() } as BeltTest);
      }
    });
  },

  getById: async (id: string): Promise<BeltTest | null> => {
    const docRef = doc(db, "beltTests", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as BeltTest;
    }
    return null;
  },

  create: async (test: Omit<BeltTest, "id">): Promise<string> => {
    const docRef = await addDoc(collection(db, "beltTests"), {
      ...test,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  update: async (id: string, updates: Partial<BeltTest>): Promise<void> => {
    const docRef = doc(db, "beltTests", id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  delete: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, "beltTests", id));
  },
};

// Helper to normalize student data from Firestore
const mapStudentDoc = (doc: any): StudentRecord => {
  const data = doc.data();
  // Normalize Firestore Timestamps to ISO strings for consistent UI rendering and sorting
  let registeredAt = data.registeredAt;
  if (registeredAt && typeof registeredAt.toDate === "function") {
    registeredAt = registeredAt.toDate().toISOString();
  } else if (registeredAt && registeredAt._seconds) {
    // Fallback if the timestamp object is plain JSON without toDate method
    registeredAt = new Date(registeredAt._seconds * 1000).toISOString();
  }

  let updatedAt = data.updatedAt;
  if (updatedAt && typeof updatedAt.toDate === "function") {
    updatedAt = updatedAt.toDate().toISOString();
  } else if (updatedAt && updatedAt._seconds) {
    updatedAt = new Date(updatedAt._seconds * 1000).toISOString();
  }

  return { id: doc.id, ...data, registeredAt, updatedAt } as StudentRecord;
};

// Helper to sort students descending by registeredAt
const sortStudentsDesc = (students: StudentRecord[]) => {
  return students.sort((a, b) => {
    const timeA = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
    const timeB = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
    // Check for NaN if invalid date strings are still present
    if (isNaN(timeA) || isNaN(timeB)) return 0;
    return timeB - timeA;
  });
};

// Student Service (PROGRAM-SPECIFIC)
export const firebaseStudentService = {
  getAll: async (
    programType?: "KARATE" | "SELAMBAM",
  ): Promise<StudentRecord[]> => {
    const conditions = [];
    if (programType) {
      const lower = programType.toLowerCase();
      conditions.push(where("program", "==", lower));
    }
    const q = query(collection(db, "students"), ...conditions);
    const snap = await getDocs(q);
    const students = snap.docs
      .map(mapStudentDoc)
      .filter((s) => !(s as any).isDeleted);
    return sortStudentsDesc(students);
  },

  getByEventId: async (
    eventId: string,
    programType?: "KARATE" | "SELAMBAM",
  ): Promise<StudentRecord[]> => {
    const conditions = [];
    if (programType) {
      const lower = programType.toLowerCase();
      conditions.push(where("program", "==", lower));
    }
    conditions.push(where("beltTestId", "==", eventId));
    const q = query(collection(db, "students"), ...conditions);
    const snap = await getDocs(q);
    const students = snap.docs
      .map(mapStudentDoc)
      .filter((s) => !(s as any).isDeleted);
    return sortStudentsDesc(students);
  },

  listenAll: (
    callback: (students: StudentRecord[]) => void,
    programType?: "KARATE" | "SELAMBAM",
  ) => {
    const q = query(collection(db, "students"));
    return onSnapshot(q, (snap) => {
      let students = snap.docs
        .map(mapStudentDoc)
        .filter((s) => !(s as any).isDeleted);
      if (programType) {
        const lower = programType.toLowerCase();
        students = students.filter((s) => {
          const sProgram = (s.program || "").toLowerCase();
          const sProgramType = (s.programType || "").toLowerCase();
          return (
            sProgram === lower ||
            sProgramType === lower ||
            (!sProgram && !sProgramType && lower === "karate")
          );
        });
      }
      callback(sortStudentsDesc(students));
    });
  },

  listenByCoach: (
    coachId: string,
    callback: (students: StudentRecord[]) => void,
  ) => {
    const q = query(
      collection(db, "students"),
      where("secretaryId", "==", coachId),
    );
    return onSnapshot(q, (snap) => {
      const students = snap.docs
        .map(mapStudentDoc)
        .filter((s) => !(s as any).isDeleted);
      callback(sortStudentsDesc(students));
    });
  },

  getByCoach: async (
    coachId: string,
    programType?: "KARATE" | "SELAMBAM",
  ): Promise<StudentRecord[]> => {
    const conditions: any[] = [where("secretaryId", "==", coachId)];
    if (programType) {
      conditions.push(where("program", "==", programType.toLowerCase()));
    }
    const q = query(collection(db, "students"), ...conditions);
    const snap = await getDocs(q);
    const students = snap.docs
      .map(mapStudentDoc)
      .filter((s) => !(s as any).isDeleted);
    return sortStudentsDesc(students);
  },

  getPending: async (
    programType?: "KARATE" | "SELAMBAM",
  ): Promise<StudentRecord[]> => {
    const allStudents = await firebaseStudentService.getAll(programType);
    return allStudents.filter(
      (s) => s.paymentStatus === "pending" || !s.paymentStatus,
    );
  },

  getVerified: async (
    programType?: "KARATE" | "SELAMBAM",
  ): Promise<StudentRecord[]> => {
    const allStudents = await firebaseStudentService.getAll(programType);
    return allStudents.filter((s) => s.paymentStatus === "verified");
  },

  getIndividual: async (
    programType?: "KARATE" | "SELAMBAM",
  ): Promise<StudentRecord[]> => {
    const allStudents = await firebaseStudentService.getAll(programType);
    return allStudents.filter((s) => s.registrationType === "individual");
  },

  getPaginated: async (
    pageSize: number = 10,
    programType?: "KARATE" | "SELAMBAM",
    lastDoc?: any,
  ): Promise<{ students: StudentRecord[]; lastDoc: any; hasMore: boolean }> => {
    let baseQuery = collection(db, "students");
    let constraints: any[] = [
      orderBy("registeredAt", "desc"),
      limit(pageSize + 1),
    ];

    if (programType) {
      const programLowercase = programType.toLowerCase() as
        "karate" | "selambam";
      constraints.unshift(where("program", "==", programLowercase));
    }

    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const q = query(baseQuery, ...constraints);
    const querySnapshot = await getDocs(q);

    const hasMore = querySnapshot.docs.length > pageSize;
    const docs = hasMore
      ? querySnapshot.docs.slice(0, pageSize)
      : querySnapshot.docs;

    return {
      students: docs.map(mapStudentDoc),
      lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
      hasMore,
    };
  },

  getByEvent: async (
    eventId: string,
    programType?: string,
  ): Promise<StudentRecord[]> => {
    let constraints: any[] = [where("beltTestId", "==", eventId)];

    if (programType) {
      const programLowercase = programType.toLowerCase() as
        "karate" | "selambam";
      constraints.push(where("program", "==", programLowercase));
    }

    const q = query(collection(db, "students"), ...constraints);
    const snap = await getDocs(q);
    const students = snap.docs.map(mapStudentDoc);
    return sortStudentsDesc(students);
  },

  getById: async (id: string): Promise<StudentRecord | null> => {
    const docRef = doc(db, "students", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as StudentRecord;
    }
    return null;
  },

  add: async (student: StudentRecord): Promise<void> => {
    const docRef = doc(db, "students", student.id);
    const studentData = {
      ...student,
      programType: student.programType || "KARATE",
      program:
        student.program ||
        ((student.programType || "").toLowerCase() as "karate" | "selambam") ||
        "karate",
      registeredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(docRef, studentData);
  },

  update: async (
    id: string,
    updates: Partial<StudentRecord>,
  ): Promise<StudentRecord | null> => {
    const docRef = doc(db, "students", id);
    const updateData: any = {
      ...updates,
      updatedAt: serverTimestamp(),
    };
    if (updates.programType && !updates.program) {
      updateData.program = updates.programType.toLowerCase() as
        "karate" | "selambam";
    }

    await updateDoc(docRef, updateData);
    return null;
  },

  delete: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, "students", id));
  },

  getPendingPayments: async (
    programType?: "KARATE" | "SELAMBAM",
  ): Promise<StudentRecord[]> => {
    const allStudents = await firebaseStudentService.getAll();
    const pending = allStudents.filter(
      (s) => s.paymentStatus === "pending" || !s.paymentStatus,
    );
    return programType
      ? pending.filter((s) => s.programType === programType)
      : pending;
  },

  getPendingPaymentsPaginated: async (
    pageSize: number = 10,
    programType?: "KARATE" | "SELAMBAM",
    lastDoc?: any,
  ): Promise<{ students: StudentRecord[]; lastDoc: any; hasMore: boolean }> => {
    let constraints: any[] = [
      where("paymentStatus", "==", "pending"),
      orderBy("registeredAt", "desc"),
      limit(pageSize + 1),
    ];

    if (programType) {
      const programLowercase = programType.toLowerCase() as
        "karate" | "selambam";
      constraints.unshift(where("program", "==", programLowercase));
    }

    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const q = query(collection(db, "students"), ...constraints);
    const querySnapshot = await getDocs(q);

    const hasMore = querySnapshot.docs.length > pageSize;
    const docs = hasMore
      ? querySnapshot.docs.slice(0, pageSize)
      : querySnapshot.docs;

    return {
      students: docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as StudentRecord[],
      lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
      hasMore,
    };
  },

  getVerifiedPayments: async (
    programType?: "KARATE" | "SELAMBAM",
  ): Promise<StudentRecord[]> => {
    const allStudents = await firebaseStudentService.getAll();
    const verified = allStudents.filter((s) => s.paymentStatus === "verified");
    return programType
      ? verified.filter((s) => s.programType === programType)
      : verified;
  },

  getVerifiedPaymentsPaginated: async (
    pageSize: number = 10,
    programType?: "KARATE" | "SELAMBAM",
    lastDoc?: any,
  ): Promise<{ students: StudentRecord[]; lastDoc: any; hasMore: boolean }> => {
    let constraints: any[] = [
      where("paymentStatus", "==", "verified"),
      orderBy("registeredAt", "desc"),
      limit(pageSize + 1),
    ];

    if (programType) {
      const programLowercase = programType.toLowerCase() as
        "karate" | "selambam";
      constraints.unshift(where("program", "==", programLowercase));
    }

    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const q = query(collection(db, "students"), ...constraints);
    const querySnapshot = await getDocs(q);

    const hasMore = querySnapshot.docs.length > pageSize;
    const docs = hasMore
      ? querySnapshot.docs.slice(0, pageSize)
      : querySnapshot.docs;

    return {
      students: docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as StudentRecord[],
      lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
      hasMore,
    };
  },

  transferToSchool: async (
    studentId: string,
    schoolId: string,
    schoolName: string,
  ): Promise<void> => {
    const docRef = doc(db, "students", studentId);
    await updateDoc(docRef, {
      schoolId,
      school: schoolName,
      registrationType: "school",
      originalType: "individual",
      transferredFrom: "individual",
      transferredAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
  },
};

// ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Fee Structure Data ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
export interface FeeStructure {
  id: string;
  beltColor: string;
  fee: number;
  active: boolean;
  order: number;
  updatedAt?: string;
}

const DEFAULT_FEE_STRUCTURE: Omit<FeeStructure, "id">[] = [
  { beltColor: "Yellow", fee: 1200, active: true, order: 1 },
  { beltColor: "Orange", fee: 1200, active: true, order: 2 },
  { beltColor: "Blue", fee: 1200, active: true, order: 3 },
  { beltColor: "Green", fee: 1500, active: true, order: 4 },
  { beltColor: "II Brown", fee: 1500, active: true, order: 5 },
  { beltColor: "I Brown", fee: 1500, active: true, order: 6 },
  { beltColor: "Black Belt", fee: 2000, active: true, order: 7 },
];

export const firebaseFeeStructureService = {
  getAll: async (): Promise<FeeStructure[]> => {
    const snap = await getDocs(collection(db, "feeStructure"));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as FeeStructure)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  initialize: async (): Promise<void> => {
    for (const feeItem of DEFAULT_FEE_STRUCTURE) {
      await addDoc(collection(db, "feeStructure"), {
        ...feeItem,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  },

  resetToDefaults: async (): Promise<void> => {
    const snap = await getDocs(collection(db, "feeStructure"));
    for (const document of snap.docs) {
      await deleteDoc(document.ref);
    }

    for (const feeItem of DEFAULT_FEE_STRUCTURE) {
      await addDoc(collection(db, "feeStructure"), {
        ...feeItem,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  },

  update: async (
    id: string,
    updates: Partial<Omit<FeeStructure, "id">>,
  ): Promise<void> => {
    const docRef = doc(db, "feeStructure", id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  updateFee: async (id: string, fee: number): Promise<void> => {
    const docRef = doc(db, "feeStructure", id);
    await updateDoc(docRef, {
      fee,
      updatedAt: serverTimestamp(),
    });
  },

  toggleActive: async (id: string, active: boolean): Promise<void> => {
    const docRef = doc(db, "feeStructure", id);
    await updateDoc(docRef, {
      active,
      updatedAt: serverTimestamp(),
    });
  },

  getActive: async (): Promise<FeeStructure[]> => {
    const q = query(
      collection(db, "feeStructure"),
      where("active", "==", true),
    );
    const snap = await getDocs(q);
    const fees = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as FeeStructure,
    );
    return fees.sort((a, b) => (a.order || 0) - (b.order || 0));
  },
};

// ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Silambam Stage Fee Structure ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
export interface SilambanFeeStructure {
  id: string;
  stageNumber: number;
  stageName: string;
  fee: number;
  active: boolean;
  order: number;
  updatedAt?: string;
}

const DEFAULT_SILAMBAM_FEES: Omit<SilambanFeeStructure, "id">[] = [
  { stageNumber: 1, stageName: "Stage 1", fee: 800, active: true, order: 1 },
  { stageNumber: 2, stageName: "Stage 2", fee: 900, active: true, order: 2 },
  { stageNumber: 3, stageName: "Stage 3", fee: 1000, active: true, order: 3 },
  { stageNumber: 4, stageName: "Stage 4", fee: 1200, active: true, order: 4 },
  { stageNumber: 5, stageName: "Stage 5", fee: 1500, active: true, order: 5 },
];

export const firebaseSilambanFeeService = {
  getAll: async (): Promise<SilambanFeeStructure[]> => {
    const snap = await getDocs(collection(db, "silambanFees"));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as SilambanFeeStructure)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  getActive: async (): Promise<SilambanFeeStructure[]> => {
    let q = query(collection(db, "silambanFees"), where("active", "==", true));
    let snap = await getDocs(q);
    let fees = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as SilambanFeeStructure,
    );

    if (fees.length === 0) {
      await firebaseSilambanFeeService.initialize();
      snap = await getDocs(q);
      fees = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as SilambanFeeStructure,
      );
    }
    return fees.sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  getByStage: async (
    stageNumber: number,
  ): Promise<SilambanFeeStructure | null> => {
    const q = query(
      collection(db, "silambanFees"),
      where("stageNumber", "==", stageNumber),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as SilambanFeeStructure;
  },

  initialize: async (): Promise<void> => {
    for (const fee of DEFAULT_SILAMBAM_FEES) {
      await addDoc(collection(db, "silambanFees"), {
        ...fee,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  },

  updateFee: async (id: string, fee: number): Promise<void> => {
    await updateDoc(doc(db, "silambanFees", id), {
      fee,
      updatedAt: serverTimestamp(),
    });
  },

  updateStageName: async (id: string, stageName: string): Promise<void> => {
    await updateDoc(doc(db, "silambanFees", id), {
      stageName,
      updatedAt: serverTimestamp(),
    });
  },

  toggleActive: async (id: string, active: boolean): Promise<void> => {
    await updateDoc(doc(db, "silambanFees", id), {
      active,
      updatedAt: serverTimestamp(),
    });
  },

  deleteStage: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, "silambanFees", id));
  },

  addStage: async (stageName: string, fee: number): Promise<string> => {
    const snap = await getDocs(collection(db, "silambanFees"));
    const existing = snap.docs.map((d) => d.data()) as SilambanFeeStructure[];
    const maxOrder = existing.reduce((m, f) => Math.max(m, f.order || 0), 0);
    const maxStageNumber = existing.reduce(
      (m, f) => Math.max(m, f.stageNumber || 0),
      0,
    );
    const newStage: Omit<SilambanFeeStructure, "id"> = {
      stageName,
      stageNumber: maxStageNumber + 1,
      fee,
      active: true,
      order: maxOrder + 1,
    };
    const docRef = await addDoc(collection(db, "silambanFees"), {
      ...newStage,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  resetToDefaults: async (): Promise<void> => {
    const snap = await getDocs(collection(db, "silambanFees"));
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }

    for (const fee of DEFAULT_SILAMBAM_FEES) {
      await addDoc(collection(db, "silambanFees"), {
        ...fee,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  },
};

// School Service
export const firebaseSchoolService = {
  getAll: async (programType?: "KARATE" | "SELAMBAM"): Promise<School[]> => {
    const snap = await getDocs(collection(db, "schools"));
    const validSchools = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as School)
      .filter((s) => !(s as any).isDeleted);
    if (programType) {
      if (programType === "KARATE") {
        return validSchools.filter(
          (s) => s.programType === "KARATE" || !s.programType,
        );
      } else {
        return validSchools.filter((s) => s.programType === programType);
      }
    }
    return validSchools;
  },

  getActive: async (programType?: "KARATE" | "SELAMBAM"): Promise<School[]> => {
    const allSchools = await firebaseSchoolService.getAll(programType);
    return allSchools.filter((s) => s.active === true);
  },

  getById: async (id: string): Promise<School | null> => {
    const docRef = doc(db, "schools", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as School;
    }
    return null;
  },

  create: async (
    school: Omit<School, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> => {
    const docRef = await addDoc(collection(db, "schools"), {
      ...school,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  update: async (
    id: string,
    updates: Partial<Omit<School, "id">>,
  ): Promise<void> => {
    const docRef = doc(db, "schools", id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  delete: async (id: string): Promise<void> => {
    try {
      const colRef = collection(db, "batches");
      const q = query(colRef, where("schoolId", "==", id));
      const snapshot = await getDocs(q);
      for (const docSnap of snapshot.docs) {
        await firebaseBatchService.delete(docSnap.id);
      }
    } catch (err) {
      console.error("Error performing cascade delete of batches:", err);
    }

    await deleteDoc(doc(db, "schools", id));
  },

  toggleActive: async (id: string, active: boolean): Promise<void> => {
    const docRef = doc(db, "schools", id);
    await updateDoc(docRef, {
      active,
      updatedAt: serverTimestamp(),
    });
  },
};

// Coach <-> School Links (many-to-many: one Coach can manage multiple Schools)
export const firebaseCoachSchoolService = {
  getMySchools: async (coachId: string): Promise<School[]> => {
    const q = query(
      collection(db, "coachSchools"),
      where("secretaryId", "==", coachId),
    );
    const snap = await getDocs(q);
    const schoolIds = snap.docs.map((d) => d.data().schoolId as string);
    if (schoolIds.length === 0) return [];
    const schools = await Promise.all(
      schoolIds.map((id) => firebaseSchoolService.getById(id)),
    );
    return schools.filter((s): s is School => !!s && !(s as any).isDeleted);
  },

  getAllLinks: async (): Promise<{secretaryId: string, schoolId: string}[]> => {
    const snap = await getDocs(collection(db, "coachSchools"));
    return snap.docs.map((d) => ({
      secretaryId: d.data().secretaryId as string,
      schoolId: d.data().schoolId as string
    }));
  },

  linkSchool: async (coachId: string, schoolId: string, schoolName: string): Promise<string> => {
    const docRef = await addDoc(collection(db, "coachSchools"), {
      secretaryId: coachId,
      schoolId,
      schoolName,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  createAndLinkSchool: async (
    coachId: string,
    school: { name: string; branch: string; programType: "KARATE" | "SELAMBAM" },
  ): Promise<{ schoolId: string; linkId: string }> => {
    const schoolId = await firebaseSchoolService.create({
      name: school.name,
      branch: school.branch,
      programType: school.programType,
      active: true,
      createdBy: coachId,
    } as any);
    const linkId = await firebaseCoachSchoolService.linkSchool(coachId, schoolId, school.name);
    return { schoolId, linkId };
  },

  isSchoolLinked: async (coachId: string, schoolId: string): Promise<boolean> => {
    const q = query(
      collection(db, "coachSchools"),
      where("secretaryId", "==", coachId),
      where("schoolId", "==", schoolId),
    );
    const snap = await getDocs(q);
    return !snap.empty;
  },

  // Aggregated view of every school a Coach manages, plus rolled-up totals.
  // Used by Admin's Coach Management (card summary + "View Schools" modal).
  // A Coach account is shared across programs — pass `programType` to scope the
  // schools/students counted to the Karate or Silambam side currently being viewed.
  getCoachSummary: async (coachId: string, programType?: "KARATE" | "SELAMBAM") => {
    const [linkedSchools, allStudents] = await Promise.all([
      firebaseCoachSchoolService.getMySchools(coachId),
      firebaseStudentService.getByCoach(coachId),
    ]);

    const students = programType
      ? allStudents.filter((s: any) => (s.programType || "").toUpperCase() === programType)
      : allStudents;

    // Coaches now pick any school at registration time instead of linking
    // one first, so `coachSchools` is no longer a reliable list of "schools
    // this coach manages" — a coach can have registrations under a
    // school it was never linked to. Build the school list from the students'
    // actual `schoolId`s (falling back to any legacy links with zero students
    // yet, so a school added but not yet used still shows).
    const registeredSchoolIds = new Set(
      students.map((s: any) => s.schoolId).filter(Boolean) as string[],
    );
    const linkedSchoolsInProgram = programType
      ? linkedSchools.filter((s) =>
          programType === "KARATE" ? (s.programType === "KARATE" || !s.programType) : s.programType === programType,
        )
      : linkedSchools;
    const schoolIds = new Set<string>([
      ...registeredSchoolIds,
      ...linkedSchoolsInProgram.map((s) => s.id),
    ]);

    const linkedSchoolById = new Map(linkedSchools.map((s) => [s.id, s]));

    const schoolSummaries = await Promise.all(
      Array.from(schoolIds).map(async (schoolId) => {
        const school = linkedSchoolById.get(schoolId) || (await firebaseSchoolService.getById(schoolId));
        const schoolStudents = students.filter((s: any) => s.schoolId === schoolId);
        const confirmedCount = schoolStudents.filter((s: any) => s.paymentStatus === "verified").length;
        const pendingCount = schoolStudents.length - confirmedCount;
        const totalAmount = schoolStudents.reduce((sum: number, s: any) => sum + (s.paymentDetails?.amount || 0), 0);

        const fallbackSchool: School = {
          id: schoolId,
          name: schoolStudents[0]?.school || "Unknown School",
          branch: "",
          active: false,
          programType: (schoolStudents[0]?.programType || "KARATE") as "KARATE" | "SELAMBAM",
          createdAt: "",
          updatedAt: "",
        };

        return {
          ...(school || fallbackSchool),
          id: schoolId,
          studentCount: schoolStudents.length,
          pendingCount,
          confirmedCount,
          totalAmount,
        };
      }),
    );

    const totals = schoolSummaries.reduce(
      (acc, s) => {
        acc.totalStudents += s.studentCount;
        acc.pendingStudents += s.pendingCount;
        acc.confirmedStudents += s.confirmedCount;
        acc.totalFee += s.totalAmount;
        return acc;
      },
      { totalStudents: 0, pendingStudents: 0, confirmedStudents: 0, totalFee: 0 },
    );

    return { schools: schoolSummaries, totalSchools: schoolSummaries.length, ...totals };
  },
};

// Batch Service (PROGRAM-SPECIFIC)
export const firebaseBatchService = {
  getAll: async (programType?: "KARATE" | "SELAMBAM"): Promise<Batch[]> => {
    const snap = await getDocs(collection(db, "batches"));
    const allBatches = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Batch)
      .filter((b) => !(b as any).isDeleted);
    return programType
      ? allBatches.filter(
          (b) => b.programType === programType || !b.programType,
        )
      : allBatches;
  },

  listenAll: (
    callback: (batches: Batch[]) => void,
    programType?: "KARATE" | "SELAMBAM",
  ) => {
    const q = query(collection(db, "batches"));
    return onSnapshot(q, (snap) => {
      let allBatches = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Batch)
        .filter((b) => !(b as any).isDeleted);
      if (programType) {
        allBatches = allBatches.filter(
          (b) => b.programType === programType || !b.programType,
        );
      }
      callback(allBatches);
    });
  },

  getByBeltTest: async (
    beltTestId: string,
    programType?: "KARATE" | "SELAMBAM",
  ): Promise<Batch[]> => {
    const allBatches = await firebaseBatchService.getAll(programType);
    return allBatches.filter((b) => b.beltTestId === beltTestId);
  },

  getByReferee: async (
    refereeId: string,
    programType?: "KARATE" | "SELAMBAM",
  ): Promise<Batch[]> => {
    const conditions = [where("refereeIds", "array-contains", refereeId)];
    if (programType) {
      conditions.push(where("programType", "==", programType));
    }
    const q = query(collection(db, "batches"), ...conditions);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((b) => !(b as any).isDeleted) as Batch[];
  },

  subscribeToRefereeBatches: (
    refereeId: string,
    callback: (batches: Batch[]) => void,
    programType?: "KARATE" | "SELAMBAM",
  ) => {
    const conditions = [where("refereeIds", "array-contains", refereeId)];
    if (programType) {
      conditions.push(where("programType", "==", programType));
    }
    const q = query(collection(db, "batches"), ...conditions);
    return onSnapshot(q, (querySnapshot) => {
      const batches = querySnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((b) => !(b as any).isDeleted) as Batch[];
      callback(batches);
    });
  },

  getById: async (id: string): Promise<Batch | null> => {
    const docRef = doc(db, "batches", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Batch;
    }
    return null;
  },

  create: async (
    batch: Omit<Batch, "id" | "createdAt" | "updatedAt">,
  ): Promise<Batch> => {
    const docRef = await addDoc(collection(db, "batches"), {
      ...batch,
      studentIds: batch.studentIds || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      ...batch,
      id: docRef.id,
      studentIds: batch.studentIds || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Batch;
  },

  update: async (
    id: string,
    updates: Partial<Omit<Batch, "id">>,
  ): Promise<Batch | null> => {
    const docRef = doc(db, "batches", id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    const updatedSnap = await getDoc(docRef);
    return { id, ...updatedSnap.data() } as Batch;
  },

  delete: async (id: string): Promise<void> => {
    const batchRef = doc(db, "batches", id);
    const batchSnap = await getDoc(batchRef);

    if (batchSnap.exists()) {
      const batchData = batchSnap.data() as Batch;
      if (batchData.studentIds && batchData.studentIds.length > 0) {
        const batchOp = writeBatch(db);
        const now = serverTimestamp();

        batchData.studentIds.forEach((studentId) => {
          batchOp.update(doc(db, "students", studentId), {
            batchId: null,
            refereeId: null,
            updatedAt: now,
          });
        });

        await batchOp.commit();
      }
    }

    await deleteDoc(batchRef);
  },

  addStudentToBatch: async (
    batchId: string,
    studentId: string,
  ): Promise<void> => {
    const batchRef = doc(db, "batches", batchId);
    const batchSnap = await getDoc(batchRef);

    if (!batchSnap.exists()) {
      throw new Error("Batch not found");
    }

    const batch = batchSnap.data() as Batch;
    const studentIds = batch.studentIds || [];

    if (studentIds.includes(studentId)) {
      throw new Error("Student already in batch");
    }

    if (studentIds.length >= batch.maxSize) {
      throw new Error("Batch is full");
    }

    studentIds.push(studentId);
    const newStatus: Batch["status"] =
      studentIds.length >= batch.maxSize ? "ongoing" : "filling";

    await updateDoc(batchRef, {
      studentIds,
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
  },

  updateStatus: async (id: string, status: Batch["status"]): Promise<void> => {
    const docRef = doc(db, "batches", id);
    const fsUpdates: any = { status, updatedAt: serverTimestamp() };

    if (status === "ongoing") {
      fsUpdates.startedAt = serverTimestamp();
    }
    if (status === "completed") {
      fsUpdates.completedAt = serverTimestamp();
    }

    await updateDoc(docRef, fsUpdates);
  },

  // Undo a "Complete Batch" — only allowed for batches that were force-completed
  // while under capacity (studentIds.length < maxSize). A batch that reached
  // maxSize and was scored to completion is final and cannot be reopened here.
  reopenBatch: async (id: string): Promise<void> => {
    const docRef = doc(db, "batches", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("Batch not found");

    const batch = snap.data() as Batch;
    if (batch.status !== "completed") throw new Error("Batch is not completed");
    if ((batch.studentIds?.length || 0) >= batch.maxSize) {
      throw new Error("A fully-scored batch cannot be reopened");
    }

    await updateDoc(docRef, {
      status: "ongoing",
      completedAt: deleteField(),
      updatedAt: serverTimestamp(),
    });
  },

  allocateNewStudent: async (
    batchId: string,
    studentId: string,
    scannerRefereeId?: string,
  ): Promise<string | null> => {
    const batchRef = doc(db, "batches", batchId);
    const batchSnap = await getDoc(batchRef);
    if (!batchSnap.exists()) return null;

    const batch = batchSnap.data() as Batch;
    const refereeIds = batch.refereeIds || [];

    if (refereeIds.length === 0) {
      return null;
    }

    let assignedRefereeId = refereeIds[0];

    if (refereeIds.length === 2) {
      const studentIds = batch.studentIds || [];
      const ref1Id = refereeIds[0];
      const ref2Id = refereeIds[1];

      let ref1Count = 0;
      let ref2Count = 0;

      const studentPromises = studentIds.map((id) =>
        getDoc(doc(db, "students", id)),
      );
      const studentSnaps = await Promise.all(studentPromises);

      studentSnaps.forEach((snap) => {
        if (snap.exists()) {
          const s = snap.data() as StudentRecord;
          if (s.refereeId === ref1Id) {
            ref1Count++;
          } else if (s.refereeId === ref2Id) {
            ref2Count++;
          }
        }
      });

      const scannerRefIndex = scannerRefereeId
        ? refereeIds.indexOf(scannerRefereeId)
        : -1;

      if (scannerRefIndex !== -1) {
        const baseCap = Math.floor(batch.maxSize / 2);
        const extra = batch.maxSize % 2;
        const scannerCapacity = scannerRefIndex < extra ? baseCap + 1 : baseCap;
        const scannerCount =
          scannerRefereeId === ref1Id ? ref1Count : ref2Count;

        if (scannerCount < scannerCapacity) {
          assignedRefereeId = scannerRefereeId!;
        } else {
          assignedRefereeId = scannerRefereeId === ref1Id ? ref2Id : ref1Id;
        }
      } else {
        assignedRefereeId = ref1Count <= ref2Count ? ref1Id : ref2Id;
      }
    }

    const studentRef = doc(db, "students", studentId);
    await updateDoc(studentRef, {
      batchId,
      refereeId: assignedRefereeId,
      scannedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return assignedRefereeId;
  },

  // ---------------------------------------------------------------------
  // Generate Batch (Phase 3) — additive, parallel to the manual create flow.
  // ---------------------------------------------------------------------

  // Generates a random 6-digit numeric code and verifies it's unique among
  // existing `batches` documents, retrying up to 8 times before giving up.
  generateUniqueBatchCode: async (): Promise<string> => {
    const MAX_ATTEMPTS = 8;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const candidate = String(Math.floor(100000 + Math.random() * 900000));
      const q = query(collection(db, "batches"), where("code", "==", candidate));
      const snap = await getDocs(q);
      if (snap.empty) {
        return candidate;
      }
    }
    throw new Error(
      "Could not generate a unique batch code after several attempts. Please try again.",
    );
  },

  // Creates ONE new batch pre-populated with all currently-eligible students
  // for the given School/Belt Test/Belt combination, in a single atomic write
  // (or a small number of chunked atomic writes if the eligible count is large).
  generateBatch: async (params: {
    schoolId: string;
    isIndividual: boolean;
    beltTestId: string;
    belt: string;
    programType: "KARATE" | "SELAMBAM";
  }): Promise<Batch> => {
    const { schoolId, isIndividual, beltTestId, belt, programType } = params;

    // 1. Fetch a fresh list of students so eligibility reflects the true
    // current state (not a possibly-stale UI cache).
    const allStudents = await firebaseStudentService.getAll(programType);

    // 2. Determine eligible students via the shared filter (single source of truth).
    const eligibleStudents = filterEligibleStudents(allStudents, {
      targetSchoolId: schoolId,
      isIndividual,
      beltTestId,
      belt,
    });

    // 3. Defensive re-check — the calling UI already disables the button at 0,
    // but eligibility could have changed between render and click.
    if (eligibleStudents.length === 0) {
      throw new Error("No eligible students found");
    }

    const studentIds = eligibleStudents.map((s) => s.id);

    // 4. Unique 6-digit code.
    const code = await firebaseBatchService.generateUniqueBatchCode();

    // 5. Compute batchNumber using the same numbering sequence as the manual
    // Create Batches flow (max existing batchNumber for this beltTestId, + 1).
    const existingBatchesForTest = await firebaseBatchService.getByBeltTest(beltTestId);
    const maxBatchNumber = existingBatchesForTest.reduce(
      (max, b) => Math.max(max, b.batchNumber || 0),
      0,
    );
    const batchNumber = maxBatchNumber + 1;

    // 6. Build ONE atomic write (chunked only if the student count could
    // exceed Firestore's 500-operation writeBatch cap).
    const MAX_OPS_PER_COMMIT = 500;
    const batchDocData = {
      beltTestId,
      schoolId: isIndividual ? "individual" : schoolId,
      batchNumber,
      refereeIds: [] as string[],
      studentIds,
      maxSize: studentIds.length,
      status: "ongoing" as const,
      programType,
      code,
      isAutoGenerated: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const newBatchRef = doc(collection(db, "batches"));

    if (studentIds.length + 1 <= MAX_OPS_PER_COMMIT) {
      // Fits in a single writeBatch commit.
      const batchOp = writeBatch(db);
      batchOp.set(newBatchRef, batchDocData);
      studentIds.forEach((studentId) => {
        batchOp.update(doc(db, "students", studentId), {
          batchId: newBatchRef.id,
          updatedAt: serverTimestamp(),
        });
      });
      await batchOp.commit();
    } else {
      // Chunk across multiple atomic commits. The batch doc (with the full,
      // true studentIds list) is written in the first chunk; student
      // stamping is spread across as many commits as needed.
      const firstChunkSize = MAX_OPS_PER_COMMIT - 1;
      const firstChunkIds = studentIds.slice(0, firstChunkSize);
      const remainingIds = studentIds.slice(firstChunkSize);

      const firstOp = writeBatch(db);
      firstOp.set(newBatchRef, batchDocData);
      firstChunkIds.forEach((studentId) => {
        firstOp.update(doc(db, "students", studentId), {
          batchId: newBatchRef.id,
          updatedAt: serverTimestamp(),
        });
      });
      await firstOp.commit();

      for (let i = 0; i < remainingIds.length; i += MAX_OPS_PER_COMMIT) {
        const chunk = remainingIds.slice(i, i + MAX_OPS_PER_COMMIT);
        const chunkOp = writeBatch(db);
        chunk.forEach((studentId) => {
          chunkOp.update(doc(db, "students", studentId), {
            batchId: newBatchRef.id,
            updatedAt: serverTimestamp(),
          });
        });
        await chunkOp.commit();
      }
    }

    // 7. Return the newly created Batch immediately, no re-fetch needed.
    return {
      id: newBatchRef.id,
      beltTestId,
      schoolId: isIndividual ? "individual" : schoolId,
      batchNumber,
      refereeIds: [],
      studentIds,
      maxSize: studentIds.length,
      status: "ongoing",
      programType,
      code,
      isAutoGenerated: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Batch;
  },
};

// Admin Settings Service
const SETTINGS_DOC_ID = "systemSettings";

const getSettingsDocId = (programType?: string) => {
  if (!programType || programType === "ALL") return SETTINGS_DOC_ID;
  return `${SETTINGS_DOC_ID}_${programType}`;
};

export const firebaseAdminSettingsService = {
  get: async (programType?: string): Promise<AdminSettings> => {
    const docId = getSettingsDocId(programType);
    const docRef = doc(db, "settings", docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as AdminSettings;
    }

    const defaultSettings: AdminSettings = {
      individualModeEnabled: false,
      studentRegistrationEnabled: true,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(docRef, {
      ...defaultSettings,
      updatedAt: serverTimestamp(),
    });

    return defaultSettings;
  },

  update: async (
    updates: Partial<AdminSettings>,
    programType?: string,
  ): Promise<void> => {
    const docId = getSettingsDocId(programType);
    const docRef = doc(db, "settings", docId);
    await setDoc(
      docRef,
      {
        ...updates,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  },

  toggleIndividualMode: async (
    enabled: boolean,
    programType?: string,
  ): Promise<void> => {
    await firebaseAdminSettingsService.update(
      { individualModeEnabled: enabled },
      programType,
    );
  },
};

// Admin Auth Service for RBAC
export const firebaseAdminAuthService = {
  getAdminByUid: async (uid: string): Promise<AdminUser | null> => {
    try {
      const docRef = doc(db, "admins", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { ...docSnap.data(), uid: docSnap.id } as AdminUser;
      }
      return null;
    } catch (error) {
      console.warn(`[AUTH] Error checking admin role for ${uid}:`, error);
      return null;
    }
  },

  isAdmin: async (uid: string): Promise<boolean> => {
    const admin = await firebaseAdminAuthService.getAdminByUid(uid);
    return !!admin && admin.role === "admin" && admin.active === true;
  },

  createAdmin: async (
    uid: string,
    data: Omit<AdminUser, "uid" | "createdAt" | "role" | "active">,
  ): Promise<void> => {
    const docRef = doc(db, "admins", uid);
    await setDoc(docRef, {
      ...data,
      role: "admin",
      active: true,
      createdAt: serverTimestamp(),
    });
  },
};

// Coach Auth Service for RBAC
export const firebaseCoachAuthService = {
  getCoachByUid: async (uid: string): Promise<any | null> => {
    try {
      const docRef = doc(db, "coaches", uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() };
    } catch (error: any) {
      if (error?.code === 'permission-denied') {
        console.warn(`[AUTH] 'coaches' read denied for ${uid}, falling back to 'secretaries'.`);
        try {
          const fallbackSnap = await getDoc(doc(db, "secretaries", uid));
          if (!fallbackSnap.exists()) return null;
          return { id: fallbackSnap.id, ...fallbackSnap.data() };
        } catch (fallbackError) {
          console.warn(`[AUTH] Error checking legacy secretary role for ${uid}:`, fallbackError);
          return null;
        }
      }
      console.warn(`[AUTH] Error checking coach role for ${uid}:`, error);
      return null;
    }
  },

  isCoach: async (uid: string): Promise<boolean> => {
    const coach = await firebaseCoachAuthService.getCoachByUid(uid);
    return !!coach && coach.active === true;
  },
};

// Coach Request Service
export const firebaseCoachRequestService = {
  create: async (data: any): Promise<string> => {
    const docRef = await addDoc(collection(db, "coachRequests"), {
      ...data,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  getAll: async (programType?: string): Promise<any[]> => {
    const q = query(collection(db, "coachRequests"));
    const snapshot = await getDocs(q);
    let results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (programType && programType !== "ALL") {
      if (programType === "KARATE") {
        results = results.filter(
          (r) => r.programType === "KARATE" || !r.programType,
        );
      } else {
        results = results.filter((r) => r.programType === programType);
      }
    }
    results.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });
    return results;
  },

  getByUid: async (uid: string): Promise<any | null> => {
    const q = query(
      collection(db, "coachRequests"),
      where("uid", "==", uid),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() };
  },

  updateStatus: async (
    id: string,
    status: "approved" | "rejected",
    adminUid: string,
    reason?: string,
  ): Promise<void> => {
    const updateData: any = {
      status,
    };
    if (status === "approved") {
      updateData.approvedBy = adminUid;
      updateData.approvedAt = serverTimestamp();
    } else {
      updateData.rejectedBy = adminUid;
      updateData.rejectedAt = serverTimestamp();
      if (reason) updateData.rejectionReason = reason;
    }
    await updateDoc(doc(db, "coachRequests", id), updateData);
  },
};

// Coach Management Service
export const firebaseCoachService = {
  create: async (data: any, uid: string): Promise<string> => {
    try {
      await setDoc(doc(db, "coaches", uid), {
        ...data,
        uid,
        active: true, // Only approved coaches are created here
        createdAt: serverTimestamp(),
      });
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        console.warn("[MIGRATION] 'coaches' create denied. Falling back to 'secretaries'.");
        await setDoc(doc(db, "secretaries", uid), {
          ...data,
          uid,
          active: true,
          createdAt: serverTimestamp(),
        });
      } else {
        throw err;
      }
    }
    return uid;
  },

  getAll: async (programType?: string): Promise<any[]> => {
    let snapshot;
    try {
      const q = query(collection(db, "coaches"));
      snapshot = await getDocs(q);
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        console.warn("[MIGRATION] 'coaches' collection denied (rules not deployed?). Falling back to 'secretaries'.");
        const fallbackQ = query(collection(db, "secretaries"));
        snapshot = await getDocs(fallbackQ);
      } else {
        throw err;
      }
    }
    
    let results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (programType && programType !== "ALL") {
      if (programType === "KARATE") {
        results = results.filter(
          (r) => r.programType === "KARATE" || !r.programType,
        );
      } else {
        results = results.filter((r) => r.programType === programType);
      }
    }
    results.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });
    return results;
  },

  toggleActive: async (uid: string, active: boolean): Promise<void> => {
    try {
      await updateDoc(doc(db, "coaches", uid), { active });
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        await updateDoc(doc(db, "secretaries", uid), { active });
      } else {
        throw err;
      }
    }
  },

  update: async (uid: string, data: any): Promise<void> => {
    try {
      await updateDoc(doc(db, "coaches", uid), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        await updateDoc(doc(db, "secretaries", uid), {
          ...data,
          updatedAt: serverTimestamp(),
        });
      } else {
        throw err;
      }
    }
  },

  delete: async (uid: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, "coaches", uid));
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        await deleteDoc(doc(db, "secretaries", uid));
      } else {
        throw err;
      }
    }
  },
};

// Audit Log Service
export const firebaseAuditService = {
  logAction: async (
    action: string,
    entityType: string,
    entityId: string,
    details: any,
    performedBy: string = "SYSTEM",
  ): Promise<void> => {
    await addDoc(collection(db, "auditLogs"), {
      action,
      entityType,
      entityId,
      details,
      performedBy,
      timestamp: serverTimestamp(),
    });
  },
};

// Notification Service
export const firebaseNotificationService = {
  sendNotification: async (
    type: string,
    target: string,
    payload: any,
  ): Promise<void> => {
    //     console.log("[NOTIFICATION] Sending  to :", payload);
    // Note: Actual implementation would require a backend function (e.g. Twilio API, Nodemailer)
  },
};

