import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicSiteUrl();
  return ["", "/pricing", "/about", "/security", "/contact", "/signup"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/pricing" ? 0.8 : 0.5,
  }));
}
