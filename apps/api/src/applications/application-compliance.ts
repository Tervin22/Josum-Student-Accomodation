import { DocumentType } from '@prisma/client';

export type ComplianceDocument = { type: DocumentType };
export type ComplianceApplication = {
  nationality?: string | null;
  fundingType?: string | null;
  studyYear?: string | null;
  applicantCategory?: string | null;
  returningStudent?: boolean | null;
  documents?: ComplianceDocument[] | null;
};

const sharedRequiredDocuments = [
  DocumentType.STUDENT_ID_COPY,
  DocumentType.PROOF_OF_FUNDING,
  DocumentType.PARENT_ID_COPY,
] as const;

const legacyDocumentAliases: Partial<Record<DocumentType, readonly DocumentType[]>> = {
  [DocumentType.STUDENT_ID_COPY]: [DocumentType.ID_DOCUMENT, DocumentType.APPLICANT_ID_PASSPORT],
  [DocumentType.PARENT_ID_COPY]: [DocumentType.GUARANTOR_SUPPORTING_DOCUMENTS],
  [DocumentType.ACCEPTANCE_LETTER]: [DocumentType.STUDENT_ACCEPTANCE_LETTER],
};

export function requiredDocumentTypesForApplication(application: ComplianceApplication) {
  const required = new Set<DocumentType>(sharedRequiredDocuments);
  if (isFirstYearApplication(application)) {
    required.add(DocumentType.ACCEPTANCE_LETTER);
    required.add(DocumentType.PROOF_OF_REGISTRATION);
  } else {
    required.add(DocumentType.ACADEMIC_RECORD);
  }
  return [...required];
}

export function missingDocumentTypesForApplication(application: ComplianceApplication) {
  const uploaded = new Set((application.documents ?? []).map((document) => document.type));
  return requiredDocumentTypesForApplication(application).filter((type) => !documentTypeUploaded(type, uploaded));
}

export function applicationDocumentsComplete(application: ComplianceApplication) {
  return missingDocumentTypesForApplication(application).length === 0;
}

function normalize(value?: string | null) {
  return value?.trim().toUpperCase() ?? '';
}

function isFirstYearApplication(application: ComplianceApplication) {
  const studyYear = normalize(application.studyYear);
  if (studyYear) return studyYear === 'FIRST YEAR';
  return normalize(application.applicantCategory) === 'NEW_STUDENT' && !application.returningStudent;
}

function documentTypeUploaded(requiredType: DocumentType, uploaded: Set<DocumentType>) {
  if (uploaded.has(requiredType)) return true;
  return (legacyDocumentAliases[requiredType] ?? []).some((alias) => uploaded.has(alias));
}
