import type { MetadataRoute } from 'next';
import { urlSite } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/consulta/', '/api/'] },
    sitemap: `${urlSite()}/sitemap.xml`,
  };
}
