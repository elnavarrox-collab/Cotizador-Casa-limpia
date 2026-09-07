import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const developmentEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self' https://*.clerk.com https://*.clerk.accounts.dev https://accounts.google.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      `script-src 'self' 'unsafe-inline'${developmentEval} https://*.clerk.com https://*.clerk.accounts.dev`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://img.clerk.com https://*.clerk.com https://*.googleusercontent.com",
      "font-src 'self' data:",
      "connect-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://accounts.google.com",
      "frame-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://accounts.google.com",
      "worker-src 'self' blob:",
      "upgrade-insecure-requests",
    ].join("; ");
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    }];
  },
};

export default nextConfig;
