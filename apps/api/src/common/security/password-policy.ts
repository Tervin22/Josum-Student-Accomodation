export const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;

export const strongPasswordMessage =
  'password must be 12-128 characters and include uppercase, lowercase, numeric, and special characters';
