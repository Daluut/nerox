import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = publicSiteUrl();
  return {
    rules: { userAgent: "*", allow: ["/", "/about", "/pricing", "/contact", "/security", "/login", "/signup"], disallow: ["/api/", "/overview", "/projects", "/settings", "/invite", "/onboarding"] },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
