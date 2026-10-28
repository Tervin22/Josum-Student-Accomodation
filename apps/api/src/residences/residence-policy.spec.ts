import { residenceCatalogue } from '../../prisma/residence-catalogue';
import { assertResidenceEligibility } from './residence-policy';

describe('Published residence eligibility', () => {
  it.each(residenceCatalogue)('accepts every published institution and gender for $name', residence => {
    for (const institution of residence.allowedInstitutions) {
      for (const gender of residence.allowedGenders) {
        expect(() => assertResidenceEligibility(residence, gender, institution)).not.toThrow();
      }
    }
  });
  it.each(residenceCatalogue.filter(residence => residence.allowedGenders.length === 1))('rejects male applicants for $name', residence => {
    expect(() => assertResidenceEligibility(residence, 'Male', residence.allowedInstitutions[0])).toThrow();
  });
  it.each(residenceCatalogue)('rejects unsupported institutions for $name', residence => {
    expect(() => assertResidenceEligibility(residence, 'Female', 'Unlisted college')).toThrow();
  });
  it('does not admit Westcol or Sedibeng applicants at the wrong location', () => {
    expect(() => assertResidenceEligibility(residenceCatalogue[0], 'Female', 'Sedibeng College (Heidelberg)')).toThrow();
    expect(() => assertResidenceEligibility(residenceCatalogue[4], 'Female', 'Westcol (Krugersdorp)')).toThrow();
  });
  it('rejects inactive or closed locations', () => {
    expect(() => assertResidenceEligibility({ ...residenceCatalogue[0], active: false }, 'Female', 'NWU (Vaal Triangle)')).toThrow();
    expect(() => assertResidenceEligibility({ ...residenceCatalogue[0], acceptingApplications: false }, 'Female', 'NWU (Vaal Triangle)')).toThrow();
  });
});
