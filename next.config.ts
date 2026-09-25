import type { NextConfig } from 'next';

/**
 * Cabeçalhos de segurança fixos (FASE-13 §3). A CSP é por requisição (nonce)
 * e sai do proxy.ts. HSTS sem `preload` de início: é difícil de reverter —
 * acrescentar depois de duas semanas estáveis em produção.
 */
const SEGURANCA = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // AVIF primeiro (menor), WebP de reserva — o retrato do hero é o LCP.
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31_536_000,
  },
  async headers() {
    return [
      { source: '/:path*', headers: SEGURANCA },
      // Painel e gestão de consulta: nunca indexar, nunca guardar em cache compartilhado.
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'private, no-store' }] },
      { source: '/admin', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'private, no-store' }] },
      { source: '/consulta/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'private, no-store' }] },
    ];
  },
};

export default nextConfig;
