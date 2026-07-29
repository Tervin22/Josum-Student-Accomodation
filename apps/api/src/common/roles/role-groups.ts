import { RoleName } from '@prisma/client';

export const STAFF_REGISTRATION_ROLES = [RoleName.MANAGER, RoleName.SECURITY, RoleName.TECHNICIAN] as const;
export const STAFF_PORTAL_ROLES = [RoleName.ADMINISTRATOR, ...STAFF_REGISTRATION_ROLES] as const;
export const APPLICATION_REVIEW_ROLES = [RoleName.ADMINISTRATOR, RoleName.MANAGER] as const;
export const STUDENT_RECORD_ROLES = [RoleName.ADMINISTRATOR, RoleName.MANAGER] as const;
export const STUDENT_STATUS_ROLES = [RoleName.ADMINISTRATOR] as const;
export const MAINTENANCE_WORKFLOW_ROLES = [RoleName.ADMINISTRATOR, RoleName.MANAGER, RoleName.TECHNICIAN] as const;
export const ROOM_VIEW_ROLES = [RoleName.STUDENT, RoleName.ADMINISTRATOR, RoleName.MANAGER, RoleName.SECURITY, RoleName.TECHNICIAN] as const;
export const ROOM_MANAGEMENT_ROLES = [RoleName.ADMINISTRATOR, RoleName.MANAGER] as const;
export const ROOM_TYPE_MANAGEMENT_ROLES = [RoleName.ADMINISTRATOR, RoleName.MANAGER] as const;
export const DOCUMENT_REVIEW_ROLES = [RoleName.ADMINISTRATOR, RoleName.MANAGER] as const;
export const SECURITY_OPERATION_ROLES = [RoleName.ADMINISTRATOR, RoleName.MANAGER, RoleName.SECURITY] as const;
export const STORAGE_MANAGEMENT_ROLES = [RoleName.ADMINISTRATOR, RoleName.MANAGER] as const;
export const COMMUNICATION_MANAGEMENT_ROLES = [RoleName.ADMINISTRATOR, RoleName.MANAGER, RoleName.TECHNICIAN] as const;
export const INSPECTION_MANAGEMENT_ROLES = [RoleName.ADMINISTRATOR, RoleName.MANAGER] as const;

export function hasAnyRole(userRoles: readonly string[] | undefined, allowedRoles: readonly RoleName[]) {
  return allowedRoles.some((role) => userRoles?.includes(role));
}
