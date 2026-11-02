import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Use the TS compiler API: detached CLI subprocess output is unavailable
    // in some sandboxed production-build environments.
    useTypeScriptCli: false,
    // Restricted security incident evidence accepts validated PDFs up to 25 MiB.
    // CSRF origin checks and server-side signature / size checks remain enforced.
    serverActions: { bodySizeLimit: "26mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
