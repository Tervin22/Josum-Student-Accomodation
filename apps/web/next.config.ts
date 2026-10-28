import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import path from 'path';

const standalone = process.env.NEXT_STANDALONE === 'true';
const isProduction = process.env.NODE_ENV === 'production';
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').origin;

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https://josumres.co.za https://botlogileres.co.za https://romares.co.za",
  "style-src 'self' 'unsafe-inline'",
  isProduction ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  isProduction
    ? `connect-src 'self' ${apiOrigin}`
    : "connect-src 'self' http: https:",
].join('; ');

const nextConfig = (phase: string): NextConfig => {
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    poweredByHeader: false,
    distDir: process.env.NEXT_DIST_DIR ?? (isDevServer ? '.next-dev' : '.next'),
    outputFileTracingRoot: path.join(process.cwd(), '../..'),
    eslint: {
      ignoreDuringBuilds: true,
    },
    images: {
      remotePatterns: ['josumres.co.za', 'botlogileres.co.za', 'romares.co.za'].map(hostname => ({ protocol: 'https' as const, hostname })),
    },
    async headers() {
      const headers = [
        { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
      ];
      if (isProduction) {
        headers.push({ key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' });
      }
      return [
        {
          source: '/:path*',
          headers,
        },
      ];
    },
    ...(standalone
      ? {
          output: 'standalone',
        }
      : {}),
  };
};

export default nextConfig;
