import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || "https://pflix.com.br";

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/register", "/forgot-password", "/reset-password"],
      disallow: [
        "/admin",
        "/api",
        "/watch",
        "/title",
        "/browse",
        "/profiles",
        "/settings",
        "/payments",
        "/subscribe",
        "/pending-approval",
        "/solicitacoes",
        "/solicitacao",
      ],
    },
    sitemap: `${baseUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
