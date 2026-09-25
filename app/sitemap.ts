import type { MetadataRoute } from 'next';
import { urlSite } from '@/lib/seo';

/** /admin e /consulta/* ficam FORA: são privados e levam noindex. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = urlSite();
  return [
    { url: `${base}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/agendar`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/sobre`, changeFrequency: 'yearly', priority: 0.7 },
    { url: `${base}/politica-de-privacidade`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/termos-de-uso`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
