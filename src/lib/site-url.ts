/**
 * The site's public address, used for canonical links, the sitemap and social
 * previews. Set NEXT_PUBLIC_SITE_URL to your domain (e.g. https://nerox.cc).
 */
export function publicSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return raw.replace(/\/$/, "");
}
