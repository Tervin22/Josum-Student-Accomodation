import { RoleName } from '@prisma/client';
import {
  APPLICATION_REVIEW_ROLES,
  COMMUNICATION_MANAGEMENT_ROLES,
  DOCUMENT_REVIEW_ROLES,
  INSPECTION_MANAGEMENT_ROLES,
  MAINTENANCE_WORKFLOW_ROLES,
  SECURITY_OPERATION_ROLES,
  STAFF_PORTAL_ROLES,
  STAFF_REGISTRATION_ROLES,
  STORAGE_MANAGEMENT_ROLES,
  hasAnyRole,
} from './role-groups';

describe('role groups', () => {
  it('keeps staff self-registration scoped to non-admin staff roles', () => {
    expect(STAFF_REGISTRATION_ROLES).toEqual([RoleName.MANAGER, RoleName.SECURITY, RoleName.TECHNICIAN]);
    expect(STAFF_REGISTRATION_ROLES).not.toContain(RoleName.ADMINISTRATOR);
  });

  it('allows managers to review applications and documents without granting settings access', () => {
    expect(APPLICATION_REVIEW_ROLES).toContain(RoleName.MANAGER);
    expect(DOCUMENT_REVIEW_ROLES).toContain(RoleName.MANAGER);
    expect(STAFF_PORTAL_ROLES).toContain(RoleName.MANAGER);
  });

  it('keeps technicians on the maintenance workflow boundary', () => {
    expect(MAINTENANCE_WORKFLOW_ROLES).toContain(RoleName.TECHNICIAN);
    expect(APPLICATION_REVIEW_ROLES).not.toContain(RoleName.TECHNICIAN);
  });

  it('keeps security users on the security workflow boundary', () => {
    expect(SECURITY_OPERATION_ROLES).toContain(RoleName.SECURITY);
    expect(SECURITY_OPERATION_ROLES).toContain(RoleName.MANAGER);
    expect(SECURITY_OPERATION_ROLES).not.toContain(RoleName.TECHNICIAN);
    expect(APPLICATION_REVIEW_ROLES).not.toContain(RoleName.SECURITY);
  });

  it('keeps storage management scoped to administrators and managers', () => {
    expect(STORAGE_MANAGEMENT_ROLES).toEqual([RoleName.ADMINISTRATOR, RoleName.MANAGER]);
    expect(STORAGE_MANAGEMENT_ROLES).not.toContain(RoleName.SECURITY);
    expect(STORAGE_MANAGEMENT_ROLES).not.toContain(RoleName.TECHNICIAN);
  });

  it('allows technicians to send maintenance communications without finance access', () => {
    expect(COMMUNICATION_MANAGEMENT_ROLES).toContain(RoleName.TECHNICIAN);
    expect(COMMUNICATION_MANAGEMENT_ROLES).toContain(RoleName.MANAGER);
    expect(COMMUNICATION_MANAGEMENT_ROLES).not.toContain(RoleName.SECURITY);
  });

  it('keeps inspection management scoped to reporting administrators and managers', () => {
    expect(INSPECTION_MANAGEMENT_ROLES).toEqual([RoleName.ADMINISTRATOR, RoleName.MANAGER]);
    expect(INSPECTION_MANAGEMENT_ROLES).not.toContain(RoleName.SECURITY);
    expect(INSPECTION_MANAGEMENT_ROLES).not.toContain(RoleName.TECHNICIAN);
  });

  it('matches roles defensively', () => {
    expect(hasAnyRole(['TECHNICIAN'], MAINTENANCE_WORKFLOW_ROLES)).toBe(true);
    expect(hasAnyRole(['STUDENT'], MAINTENANCE_WORKFLOW_ROLES)).toBe(false);
    expect(hasAnyRole(undefined, MAINTENANCE_WORKFLOW_ROLES)).toBe(false);
  });
});
