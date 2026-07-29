export type RoleName = 'STUDENT' | 'ADMINISTRATOR' | 'MANAGER' | 'SECURITY' | 'TECHNICIAN';

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: 'ACTIVE' | 'SUSPENDED';
  roles: RoleName[];
  studentProfile?: StudentProfile | null;
  administratorProfile?: Record<string, unknown> | null;
  latestStay?: StudentStaySummary | null;
  registrationBlocks?: StudentRegistrationBlock[];
  isRegistrationBlocked?: boolean;
};

export type StudentStayStatus = 'ACTIVE' | 'TERMINATED';

export type StudentStaySummary = {
  id: string;
  referenceCode: string;
  status: ApplicationStatus;
  stayStatus: StudentStayStatus;
  residenceName?: string | null;
  roomName?: string | null;
  fundingType?: string | null;
  acceptedAt?: string | null;
  terminatedAt?: string | null;
  terminationReason?: string | null;
};

export type StudentRegistrationBlock = {
  id: string;
  identifierType: 'EMAIL' | 'ID_NUMBER' | 'STUDENT_NUMBER';
  identifierNormalized: string;
  active: boolean;
  reason?: string | null;
  blockedAt: string;
  whitelistedAt?: string | null;
};

export type StudentProfile = {
  id?: string;
  studentNumber?: string | null;
  institution?: string | null;
  course?: string | null;
  yearOfStudy?: number | null;
  dateOfBirth?: string | null;
  idNumber?: string | null;
  address?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  profileImageOriginalName?: string | null;
  profileImageMimeType?: string | null;
  profileImageSize?: number | null;
  profileImageUploadedAt?: string | null;
  hasProfileImage?: boolean;
};

export type RoomType = {
  id: string;
  roomTypeName: string;
  totalRooms: number;
  availableRooms: number;
};

export type Residence = {
  id: string;
  name: string;
  address: string;
  residenceType: string;
  totalRooms: number;
  availableRooms: number;
  description: string;
  facilities: string[];
  amenities: string[];
  distanceToNWU: number;
  distanceToShoppingCentre: number;
  occupiedRooms?: number;
};

export type ResidenceRoomStatus = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE';

export type ResidenceRoom = {
  id: string;
  residenceId: string;
  residence?: Residence;
  roomNumber: number;
  name: string;
  genderAllocation: string;
  roomTypeName: string;
  capacity: number;
  status: ResidenceRoomStatus;
};

export type ApplicationStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'WAITLISTED'
  | 'CANCELLED'
  | 'MOVED_OUT';

export type MaintenanceStatus = 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type MaintenanceSlaStatus =
  | 'ACK_PENDING'
  | 'ACK_BREACHED'
  | 'RESOLUTION_PENDING'
  | 'RESOLUTION_BREACHED'
  | 'RESOLVED';

export type MaintenanceCategory =
  | 'PLUMBING'
  | 'ELECTRICAL'
  | 'FURNITURE'
  | 'CLEANING'
  | 'INTERNET'
  | 'SECURITY'
  | 'OTHER';

export type Application = {
  id: string;
  referenceCode: string;
  status: ApplicationStatus;
  roomType: RoomType;
  residence: Residence;
  room?: ResidenceRoom | null;
  isNwuStudent: boolean;
  studyYear: string;
  studySemester: string;
  returningStudent: boolean;
  applicantCategory?: 'NEW_STUDENT' | 'RETURNING_STUDENT' | 'TRANSFER_STUDENT' | 'INTERNATIONAL_STUDENT';
  academicRegistrationStatus?: 'REGISTERED' | 'PROVISIONALLY_ACCEPTED' | 'NOT_REGISTERED_YET';
  applicantFirstName: string;
  applicantLastName: string;
  studentIdNumber: string;
  studentNumber: string;
  studentPhone: string;
  user?: User;
  institutionName?: string;
  courseName?: string;
  dateOfOccupation?: string;
  nationality?: string;
  gender?: string;
  postalCode?: string;
  studentAdvisorDetails?: string;
  paymentTerm?: string;
  guarantorFullName?: string;
  guarantorIdPassport?: string;
  guarantorCell?: string;
  guarantorEmail?: string;
  guarantorAddress?: string;
  guarantorNationality?: string;
  guarantorEmployer?: string;
  nextOfKin1Name?: string;
  nextOfKin1Relationship?: string;
  nextOfKin1Cell?: string;
  nextOfKin2Name?: string;
  nextOfKin2Relationship?: string;
  nextOfKin2Cell?: string;
  nextOfKin3Name?: string;
  nextOfKin3Relationship?: string;
  nextOfKin3Cell?: string;
  medicalDetails?: string;
  termsAccepted: boolean;
  declarationAccepted: boolean;
  electronicSignatureName?: string;
  electronicSignatureIdPassport?: string;
  signatureDataUrl?: string;
  signedAt?: string;
  fundingType?: string;
  fundingReference?: string;
  hasMedicalConditions: boolean;
  additionalInformation?: string;
  specialRequirements?: string;
  adminNotes?: string;
  approvalExpiresAt?: string;
  acceptedAt?: string;
  stayStatus?: StudentStayStatus;
  terminatedAt?: string | null;
  terminatedById?: string | null;
  terminationReason?: string | null;
  documentsSatisfiedAt?: string;
  requiredDocumentTypes?: DocumentRecord['type'][];
  missingDocumentTypes?: DocumentRecord['type'][];
  documentsComplete?: boolean;
  documents: DocumentRecord[];
  statusHistory: Array<{
    id: string;
    fromStatus?: ApplicationStatus;
    toStatus: ApplicationStatus;
    note?: string;
    createdAt: string;
    changedBy?: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>;
  }>;
  createdAt: string;
};

export type MaintenanceRequest = {
  id: string;
  referenceCode: string;
  userId: string;
  user?: User;
  roomType?: RoomType | null;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  location?: string | null;
  title: string;
  description: string;
  acknowledgementDeadlineAt?: string | null;
  acknowledgedAt?: string | null;
  acknowledgedBy?: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'> | null;
  assignedTechnicianId?: string | null;
  assignedTechnician?: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'> | null;
  resolutionDeadlineAt?: string | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  slaAcknowledgementBreachedAt?: string | null;
  slaResolutionBreachedAt?: string | null;
  acknowledgementSlaReminderSentAt?: string | null;
  resolutionSlaReminderSentAt?: string | null;
  slaStatus?: MaintenanceSlaStatus;
  resolvedBy?: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'> | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentRecord = {
  id: string;
  applicationId: string;
  type:
    | 'ID_DOCUMENT'
    | 'PROOF_OF_REGISTRATION'
    | 'PROOF_OF_PAYMENT'
    | 'OTHER'
    | 'APPLICANT_ID_PASSPORT'
    | 'STUDENT_COLOR_ID_PHOTOS'
    | 'STUDENT_ACCEPTANCE_LETTER'
    | 'GUARANTOR_SUPPORTING_DOCUMENTS'
    | 'MEDICAL_AID_CERTIFICATE'
    | 'STUDENT_ID_COPY'
    | 'PROOF_OF_FUNDING'
    | 'PARENT_ID_COPY'
    | 'ACADEMIC_RECORD'
    | 'ACCEPTANCE_LETTER';
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type StorageRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'ITEMS_RECEIVED'
  | 'RELEASE_REQUESTED'
  | 'ITEMS_RELEASED'
  | 'CANCELLED';

export type StorageFileType = 'FORM' | 'ITEM_IMAGE';

export type StorageRequestFile = {
  id: string;
  fileType: StorageFileType;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type StorageRequest = {
  id: string;
  referenceCode: string;
  userId: string;
  user?: User;
  application?: Pick<
    Application,
    | 'id'
    | 'referenceCode'
    | 'studentNumber'
    | 'studentPhone'
    | 'institutionName'
    | 'studentIdNumber'
    | 'fundingType'
    | 'fundingReference'
    | 'acceptedAt'
    | 'status'
  > | null;
  residence?: Pick<Residence, 'id' | 'name' | 'address'> | null;
  room?: Pick<ResidenceRoom, 'id' | 'name' | 'roomNumber' | 'status'> | null;
  status: StorageRequestStatus;
  studentFullName?: string | null;
  studentNumber?: string | null;
  studentSignature?: string | null;
  studentRoomNumber?: string | null;
  numberOfItemsStored?: number | null;
  storageSite?: string | null;
  storageNoticeAccepted: boolean;
  managementSignature?: string | null;
  itemDescription?: string | null;
  reviewNotes?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
  receivedAt?: string | null;
  releasedAt?: string | null;
  files: StorageRequestFile[];
  statusHistory: Array<{
    id: string;
    fromStatus?: StorageRequestStatus | null;
    toStatus: StorageRequestStatus;
    note?: string | null;
    createdAt: string;
    changedBy?: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'> | null;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type FinanceReportRow = {
  applicationId: string;
  fullName: string;
  idNumber: string;
  studentNumber: string;
  institution: string;
  fundingType: string;
  bursaryName: string;
  studentContactNumber: string;
  nextOfKinFullName: string;
  nextOfKinContactNumber: string;
  accommodation: string;
  roomNumber: string;
  approvalDate: string;
  acceptanceDate: string;
  residencyStatus: string;
  email: string;
};

export type CommunicationRecord = {
  id: string;
  type: string;
  subject: string;
  message: string;
  residenceId?: string | null;
  residence?: Pick<Residence, 'id' | 'name'> | null;
  sentBy?: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'> | null;
  recipientCount: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
};

export type InspectionRating = 'GOOD' | 'FAIR' | 'POOR' | 'NOT_APPLICABLE';
export type InspectionStatus = 'DRAFT' | 'COMPLETED' | 'FOLLOW_UP_REQUIRED' | 'CLOSED';
export type InspectionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type InspectionPeriod = {
  id: string;
  name: string;
  year: number;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InspectionAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type Inspection = {
  id: string;
  referenceCode: string;
  periodId: string;
  period: InspectionPeriod;
  residenceId: string;
  residence: Pick<Residence, 'id' | 'name' | 'address'>;
  roomId: string;
  room: Pick<ResidenceRoom, 'id' | 'name' | 'roomNumber' | 'status'>;
  studentId?: string | null;
  student?: User | null;
  studentFullName?: string | null;
  studentNumber?: string | null;
  contactNumber?: string | null;
  emailAddress?: string | null;
  keyNumberIssued?: string | null;
  occupantNames?: string | null;
  inspector?: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'> | null;
  inspectionDate: string;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  certifiedIdCopy: boolean;
  proofOfRegistration: boolean;
  academicRecord: boolean;
  proofOfFunding: boolean;
  signedLeaseAgreement: boolean;
  moveInConditions?: Record<string, string> | null;
  moveOutConditions?: Record<string, string> | null;
  itemsBroughtIn: string[];
  generalCleanliness: InspectionRating;
  walls: InspectionRating;
  doorsAndLocks: InspectionRating;
  windows: InspectionRating;
  flooring: InspectionRating;
  ceiling: InspectionRating;
  lighting: InspectionRating;
  electricalSockets: InspectionRating;
  plumbing: InspectionRating;
  bathroomCondition: InspectionRating;
  furnitureCondition: InspectionRating;
  bedCondition: InspectionRating;
  wardrobeCondition: InspectionRating;
  appliances: InspectionRating;
  fireSafetyEquipment: InspectionRating;
  damageIdentified?: string | null;
  maintenanceRequired: boolean;
  severity: InspectionSeverity;
  comments?: string | null;
  studentAcknowledgement: boolean;
  inspectorConfirmed: boolean;
  studentConfirmed: boolean;
  followUpRequired: boolean;
  followUpDate?: string | null;
  followUpActions?: string | null;
  studentDeclaration: boolean;
  studentSignature?: string | null;
  studentSignatureDate?: string | null;
  managementSignatureIn?: string | null;
  managementSignatureOut?: string | null;
  tenantSignatureIn?: string | null;
  tenantSignatureOut?: string | null;
  status: InspectionStatus;
  completedAt?: string | null;
  attachments: InspectionAttachment[];
  createdAt: string;
  updatedAt: string;
};

export type NotificationRecord = {
  id: string;
  title: string;
  body: string;
  readAt?: string;
  createdAt: string;
};

export type VisitorLog = {
  id: string;
  visitorName: string;
  visitorPhone?: string | null;
  visitorIdNumber?: string | null;
  userId?: string | null;
  user?: User | null;
  roomId?: string | null;
  room?: Pick<ResidenceRoom, 'id' | 'name' | 'roomNumber'> | null;
  preRegistrationId?: string | null;
  residentName?: string | null;
  residenceId?: string | null;
  residence?: Pick<Residence, 'id' | 'name' | 'address'> | null;
  relationship?: string | null;
  purpose?: string | null;
  vehicleRegistration?: string | null;
  notes?: string | null;
  termsAccepted?: boolean;
  recordedById?: string | null;
  checkoutNotes?: string | null;
  overrideReason?: string | null;
  overrideAt?: string | null;
  checkedInAt: string;
  checkedOutAt?: string | null;
  checkoutReminderSentAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VisitorPreRegistration = {
  id: string;
  userId: string;
  user?: User | null;
  visitorName: string;
  visitorPhone?: string | null;
  visitorIdNumber?: string | null;
  relationship: string;
  expectedVisitDate: string;
  expectedArrivalTime: string;
  vehicleRegistration?: string | null;
  notes?: string | null;
  termsAccepted: boolean;
  status: string;
  residence?: Pick<Residence, 'id' | 'name' | 'address'> | null;
  room?: Pick<ResidenceRoom, 'id' | 'name' | 'roomNumber'> | null;
  visitorLog?: Pick<VisitorLog, 'id' | 'checkedInAt' | 'checkedOutAt'> | null;
  createdAt: string;
  updatedAt: string;
};

export type IncidentReport = {
  id: string;
  referenceCode: string;
  title: string;
  description: string;
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  residenceId?: string | null;
  location?: string | null;
  reportedById?: string | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};
