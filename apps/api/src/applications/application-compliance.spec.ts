import { DocumentType } from '@prisma/client';
import {
  applicationDocumentsComplete,
  missingDocumentTypesForApplication,
  requiredDocumentTypesForApplication,
} from './application-compliance';

describe('application compliance', () => {
  it('requires first-year student application documents', () => {
    expect(requiredDocumentTypesForApplication({ studyYear: 'FIRST YEAR' })).toEqual([
      DocumentType.STUDENT_ID_COPY,
      DocumentType.PROOF_OF_FUNDING,
      DocumentType.PARENT_ID_COPY,
      DocumentType.ACCEPTANCE_LETTER,
      DocumentType.PROOF_OF_REGISTRATION,
    ]);
  });

  it('requires academic records for returning or senior students', () => {
    expect(requiredDocumentTypesForApplication({ studyYear: 'SECOND YEAR', returningStudent: true })).toEqual([
      DocumentType.STUDENT_ID_COPY,
      DocumentType.PROOF_OF_FUNDING,
      DocumentType.PARENT_ID_COPY,
      DocumentType.ACADEMIC_RECORD,
    ]);
  });

  it('reports missing documents and completion', () => {
    const application = {
      studyYear: 'FIRST YEAR',
      documents: [
        { type: DocumentType.STUDENT_ID_COPY },
        { type: DocumentType.PROOF_OF_FUNDING },
        { type: DocumentType.PARENT_ID_COPY },
        { type: DocumentType.ACCEPTANCE_LETTER },
      ],
    };

    expect(missingDocumentTypesForApplication(application)).toEqual([DocumentType.PROOF_OF_REGISTRATION]);
    expect(applicationDocumentsComplete(application)).toBe(false);
  });

  it('accepts legacy uploaded document types for equivalent new requirements', () => {
    const application = {
      studyYear: 'FIRST YEAR',
      documents: [
        { type: DocumentType.APPLICANT_ID_PASSPORT },
        { type: DocumentType.PROOF_OF_FUNDING },
        { type: DocumentType.GUARANTOR_SUPPORTING_DOCUMENTS },
        { type: DocumentType.STUDENT_ACCEPTANCE_LETTER },
        { type: DocumentType.PROOF_OF_REGISTRATION },
      ],
    };

    expect(applicationDocumentsComplete(application)).toBe(true);
  });
});
