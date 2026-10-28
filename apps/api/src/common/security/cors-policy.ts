export function allowedCorsOrigin(origin: string | undefined, configured: string[], production: boolean) {
  if (!origin || configured.includes(origin)) return true;
  if (production) return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && ['3000', '3001'].includes(url.port);
  } catch {
    return false;
  }
}
