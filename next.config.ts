import type { NextConfig } from "next";
import WebpackObfuscator from "webpack-obfuscator";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  webpack(config, { dev, isServer }) {
    if (!dev && !isServer) {
      config.plugins.push(
        new WebpackObfuscator(
          {
            compact: true,
            controlFlowFlattening: true,
            deadCodeInjection: true,
            simplify: true,
            stringArray: true,
            stringArrayEncoding: ["base64"],
            selfDefending: true,
            disableConsoleOutput: true,
          },
          ["framework-*.js", "main-*.js", "polyfills-*.js"],
        ),
      );
    }

    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
