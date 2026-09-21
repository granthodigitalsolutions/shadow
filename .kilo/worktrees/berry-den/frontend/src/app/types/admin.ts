export interface BeltTest {
  id: string;
  name: string;
  date: string;
  time: string;
  venue?: string;
  locationLink?: string; // Google Maps Link for WhatsApp override
  locationAddress?: string; // Full Location Address
  isActive: boolean; // Multiple tests can be active now
  belts: BeltConfig[];
  scoringParameters?: ScoringParameter[]; // Made optional for the new scoring system
  allowedSchoolIds: string[]; // empty = all schools allowed
  maxStudentsPerBatch: number; // default: 10
  programType: 'KARATE' | 'SELAMBAM'; // CRITICAL: Program identifier - ISOLATED
  
  // Registration timeframe
  registrationStartDate?: string;
  registrationEndDate?: string;
  
  // NEW FIELDS for multi-branch architecture
  programId?: string;       // ðŸ”¥ Program filter (e.g., "karate", "selambam")
  branchId?: string;        // ðŸ”¥ Branch filter
  
  createdAt: string;
  updatedAt: string;
}

export interface BeltConfig {
  id: string;
  name: string;
  fee: number;
}

export interface ScoringParameter {
  id: string;
  order: number;
  name: string;
  maxPoints: number;
  lessonNumber?: number; // Lesson number (1-30) for the question
}

export interface StudentRecord {
  id: string;
  name: string;
  gender: string;

  // Registration type
  registrationType: "school" | "individual"; // How student registered

  // School association
  schoolId: string | null; // null for individual, school ID for school students
  school: string; // school name (kept for backward compatibility)
  standard: string;

  // Transfer tracking
  originalType?: "school" | "individual"; // Original registration type
  transferredFrom?: string; // Original schoolId if transferred
  transferredAt?: string; // When transferred to a school

  // Duplicate Detection
  eventId?: string; // The event this student is registered for (beltTestId)
  registrationFingerprint?: string; // Deterministic fingerprint to prevent duplicates
  qrData?: string; // Original QR payload string

  // Sticker Print Tracking
  stickerPrinted?: boolean;
  stickerPrintedAt?: any; // Firestore Timestamp
  stickerPrintedBy?: string; // Admin UID

  contact: string;
  whatsapp: string;
  beltLevel?: string; // For Karate
  beltIndex?: number; // For Karate
  stageLevel?: number; // For Selambam
  secretaryId?: string; // For Secretary portal ownership

  // Test & Batch assignment
  beltTestId: string;
  batchId: string | null; // assigned when scanned by referee
  refereeId: string | null; // who scored this student

  paymentStatus: "pending" | "verified" | "rejected";
  testStatus: "pending" | "passed" | "failed";

  score?: number;
  percentage?: number;
  result?: "pass" | "fail"; // explicit result field

  paymentDetails?: PaymentDetails;
  scoringResults?: ScoringResult[];
  subCategoryResults?: SubCategoryResult[];
  ranking?: number; // rank within the belt test (1 = highest score)

  programType: 'KARATE' | 'SELAMBAM'; // CRITICAL: Program identifier (uppercase for code) - ISOLATED
  program: 'karate' | 'selambam'; // CRITICAL: Program identifier (lowercase for database) - ISOLATED
  
  // NEW FIELDS for multi-branch architecture
  programId?: string;       // ðŸ”¥ CRITICAL: Program isolation (e.g., "karate", "selambam")
  branchId?: string;        // ðŸ”¥ CRITICAL: Branch isolation

  registeredAt: string;
  testDate?: string;
  scannedAt?: string; // when added to batch
  scoredAt?: string; // when scoring completed
  
  // PDF & Result Tracking
  resultPdfUrl?: string; 
  resultPdfPath?: string;
  resultPdfFileName?: string;
  storageFolder?: string;
  uploadedAt?: any;
  lastScoreUpdatedAt?: any;
  resultFinalized?: boolean;
  resultLocked?: boolean;
  pdfVersion?: number;
  pdfStatus?: "pending" | "generating" | "ready" | "failed"; // New PDF tracking status
  pdfUploadStatus?: "uploading" | "uploaded" | "failed"; // Legacy
  pdfUploadError?: string | null;

  resultSentAt?: string; // For WhatsApp Integration
  examinerRemarks?: string; // For Examiner/Referee feedback
  
  // WhatsApp Meta Integration Status
  whatsappStatus?: "pending" | "queued" | "sending" | "sent" | "delivered" | "read" | "failed";
  lastCampaignId?: string;
  messageId?: string;
  lastAttemptAt?: string;
  retryCount?: number;
  failureReason?: string;
  
  // Delivery Timeline Timestamps
  queuedAt?: any;
  workerStartedAt?: any;
  sentToMetaAt?: any;
  deliveredAt?: any;
  readAt?: any;
  failedAt?: any;
}

export interface PaymentDetails {
  amount: number;
  method: string;
  transactionId: string;
  paymentDate: string;
  testDate: string;
  testTime: string;
}

export interface ScoringResult {
  parameterId: string;
  parameterName: string;
  score: number;
  maxScore: number;
  lessonNumber?: number; // Optional lesson number for Technical and Athletics points
}

export interface SubCategoryResult {
  category: 'technical' | 'athletic';
  id: string;
  name: string;
  weight: number;
  score: number;
  maxScore: number;
}

// PROGRAM-SPECIFIC: School Interface
export interface School {
  id: string;
  name: string;
  branch: string; // Kept for backward compatibility
  contactPerson?: string;
  contactNumber?: string;
  active: boolean;

  programType: 'KARATE' | 'SELAMBAM'; // CRITICAL: Program identifier - ISOLATED

  // NEW FIELDS for multi-branch architecture
  programId?: string;       // ðŸ”¥ Which program this school belongs to
  branchId?: string;        // ðŸ”¥ Which branch this school belongs to

  createdBy?: string;       // Secretary uid, if this school was self-created by a Secretary

  createdAt: string;
  updatedAt: string;
}

// ISOLATED: Batch Interface
export interface Batch {
  id: string;
  beltTestId: string;
  schoolId: string; // School ID or "individual" for Individual group batches

  batchNumber: number;
  customName?: string; // Optional custom name for batch (e.g., "Morning Session", "Advanced Group")
  refereeIds: string[]; // Array of assigned referees

  studentIds: string[]; // filled dynamically via QR scan
  maxSize: number; // default: 10

  status: "waiting" | "filling" | "ongoing" | "completed";

  programType: 'KARATE' | 'SELAMBAM'; // CRITICAL: Program identifier - ISOLATED

  // NEW FIELDS for multi-branch architecture
  programId?: string;       // ðŸ”¥ Program filter
  branchId?: string;        // ðŸ”¥ Branch filter

  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  
  // PDF Batch Tracking
  pdfStatus?: "pending" | "generating" | "ready" | "failed";
  batchPdfStatus?: "idle" | "generating" | "completed" | "failed"; // Legacy
  batchGeneratedAt?: string;
  batchGenerationProgress?: {
    total: number;
    completed: number;
    failed: number;
  };

  // WhatsApp Batch Tracking (Cache Summary)
  whatsappStatus?: "pending" | "sending" | "completed" | "failed";
  totalStudents?: number;
  queuedCount?: number;
  sendingCount?: number;
  sentCount?: number;
  deliveredCount?: number;
  readCount?: number;
  failedCount?: number;
  pendingCount?: number;

  resultsSent?: boolean; // Legacy
  resultsSentAt?: string; // Legacy
  updatedAt: string;
}

export interface DeliveryCampaign {
  id: string;
  batchId: string;
  type: 'result' | 'registration';
  status: 'sending' | 'completed' | 'failed';
  totalJobs: number;
  
  // Extended reporting stats
  queuedJobs?: number;
  sentJobs?: number;
  processedJobs?: number;
  deliveredJobs?: number;
  readJobs?: number;
  failedJobs?: number;
  
  startedAt: any;
  completedAt?: any;
  durationMs?: number;
  createdBy?: string;
}

export interface WhatsAppLog {
  id: string;
  campaignId: string;
  studentId: string;
  batchId: string;
  messageId?: string;
  status: "queued" | "sending" | "sent" | "delivered" | "read" | "failed";
  failureReason?: string;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  entity: string;
  entityId: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "RESTORE";
  performedBy: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  correlationId?: string;
  ip?: string;
  userAgent?: string;
  timestamp: any;
}

// PROGRAM-SPECIFIC: Referee Interface
export interface Referee {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: "referee";

  // School Association
  schoolId?: string; // Which school this referee belongs to (optional, assigned at batch creation)

  // Firebase Auth UID
  uid: string;

  assignedBatchIds: string[];

  active: boolean;
  isActive?: boolean; // For global referee compatibility

  // Mirrors `active`. Referees are "active" from the moment they register —
  // there is no admin approval step, so there is no "pending" state.
  status?: "active" | "inactive";

  programType?: 'KARATE' | 'SELAMBAM'; // CRITICAL: Program identifier - ISOLATED

  // NEW FIELDS for multi-branch architecture
  programId?: string;       // ðŸ”¥ Which program this referee works for
  branchId?: string;        // ðŸ”¥ Which branch this referee belongs to

  createdAt: string;
  updatedAt: string;
}

// Admin Settings Interface
export interface AdminSettings {
  // Registration Settings
  individualModeEnabled: boolean; // Toggle for Individual registration mode
  studentRegistrationEnabled?: boolean; // Global toggle to enable/disable student registrations

  // Data Sharing Settings (optional cross-program data sharing)
  allowSharedSchools?: boolean;   // If true, schools can be shared between Karate and Silambam
  allowSharedReferees?: boolean;  // If true, referees can work across both programs

  // Scoring Settings
  minimumPassingPercentage?: number;  // Default: 60
  defaultBatchSize?: number;          // Default: 10
  enableLessonNumbers?: boolean;      // Show lesson numbers in scoring parameters

  // Notification Settings
  emailNotificationsEnabled?: boolean;
  smsNotificationsEnabled?: boolean;
  notificationEmail?: string;
  notificationPhone?: string;

  // System Branding
  systemName?: string;
  systemTagline?: string;

  // Advanced Settings
  enableQRScanner?: boolean;          // Enable QR code scanning for batches
  enableRefereeMode?: boolean;        // Enable referee portal
  enablePublicResults?: boolean;      // Allow public result viewing
  maintenanceMode?: boolean;          // Put system in maintenance mode

  // Security Settings
  allowLateRegistrations?: boolean;      // Allow registrations after test starts
  maxRefereesPerBatch?: number;          // Max referees allowed per batch (default: 1)

  // Data Management
  autoBackupEnabled?: boolean;
  backupFrequency?: 'daily' | 'weekly' | 'monthly';
  lastBackupDate?: string;

  updatedAt: string;
}

// Admin User Interface
export interface AdminUser {
  uid: string;
  email: string;
  name: string;
  role: "admin";
  active: boolean;
  createdAt?: any;
}
export interface SecretaryRequest {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  academy?: string;
  district?: string;
  state?: string;
  address?: string;
  status: 'pending' | 'approved' | 'rejected';
  uid: string; // Auth UID
  createdAt: any;
  approvedBy?: string;
  approvedAt?: any;
  rejectedBy?: string;
  rejectedAt?: any;
  rejectionReason?: string;
}

export interface Secretary {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  academy?: string;
  district?: string;
  state?: string;
  address?: string;
  uid: string; // Auth UID
  active: boolean; // Must be true to login
  createdAt: any;
  approvedBy?: string;
  approvedAt?: any;
}

export interface RefereeRequest {
  id?: string;
  name: string;
  email: string;
  phoneNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  uid: string; // Auth UID
  createdAt: any;
  approvedBy?: string;
  approvedAt?: any;
  rejectedBy?: string;
  rejectedAt?: any;
  rejectionReason?: string;
}
