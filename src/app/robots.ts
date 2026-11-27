import type { MetadataRoute } from "next";

/**
 * Crawlers may read the order form and nothing else. Order links are
 * secret, and the staff screens, login and API are not for robots. The
 * pages themselves are noindex too, since robots.txt is only a request.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/*?",
        "/objednavka/",
        "/prihlaseni",
        "/dnes",
        "/nova",
        "/plan",
        "/trvale",
        "/vyrobky",
        "/design",
        "/api/",
      ],
      crawlDelay: 5,
    },
  };
}
