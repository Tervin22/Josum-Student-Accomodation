import { allowedCorsOrigin } from './cors-policy';

describe('Production CORS policy', () => {
  const origins = ['https://portal.client.example'];
  it('allows only explicitly configured browser origins in production', () => {
    expect(allowedCorsOrigin(origins[0], origins, true)).toBe(true);
    for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3001', 'https://other.example', 'null']) {
      expect(allowedCorsOrigin(origin, origins, true)).toBe(false);
    }
  });
  it('allows server requests without an Origin header', () => {
    expect(allowedCorsOrigin(undefined, origins, true)).toBe(true);
  });
  it('retains local development access', () => {
    expect(allowedCorsOrigin('http://localhost:3000', [], false)).toBe(true);
    expect(allowedCorsOrigin('http://localhost:5555', [], false)).toBe(false);
  });
});
