import { ConflictException } from '@nestjs/common';

type Policy = { name: string; active?: boolean; acceptingApplications?: boolean; allowedGenders?: string[]; allowedInstitutions?: string[]; residenceType?: string };
export function assertResidenceEligibility(residence: Policy, gender: string, institution: string) {
  if (residence.active === false || residence.acceptingApplications === false) {
    throw new ConflictException('This residence is not accepting applications');
  }
  if (residence.allowedGenders?.length && !residence.allowedGenders.includes(gender)) {
    throw new ConflictException(`${residence.name} accepts ${residence.allowedGenders.join(' or ')} applicants only`);
  }
  if (!residence.allowedGenders?.length && residence.residenceType?.toLowerCase().includes('girls only') && gender !== 'Female') {
    throw new ConflictException(`${residence.name} is a female-only residence`);
  }
  if (residence.allowedInstitutions?.length && !residence.allowedInstitutions.includes(institution.trim())) {
    throw new ConflictException(`Choose an eligible institution for ${residence.name}`);
  }
}
