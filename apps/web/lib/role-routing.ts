export const staffRoles = ['ADMINISTRATOR', 'MANAGER', 'SECURITY', 'TECHNICIAN'];

export function hasAnyRole(userRoles: string[] | undefined, allowedRoles: string[]) {
  return allowedRoles.some((role) => userRoles?.includes(role));
}

export function dashboardPathForRoles(userRoles: string[] | undefined, studentDestination = '/student/dashboard') {
  if (userRoles?.includes('ADMINISTRATOR')) return '/admin/dashboard';
  if (userRoles?.includes('MANAGER')) return '/manager/dashboard';
  if (userRoles?.includes('SECURITY')) return '/security/dashboard';
  if (userRoles?.includes('TECHNICIAN')) return '/technician/dashboard';
  if (userRoles?.includes('STUDENT')) return studentDestination;
  return '/login';
}
