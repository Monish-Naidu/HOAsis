import type { MetadataRoute } from "next";

/**
 * Keep the prototype out of search results. Remove this file when there is a
 * real marketing site worth indexing.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
