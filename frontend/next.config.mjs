import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

function apiUploadPatterns() {
  const patterns = [
    {
      protocol: "http",
      hostname: "localhost",
      port: "8000",
      pathname: "/uploads/**",
    },
    {
      protocol: "http",
      hostname: "127.0.0.1",
      port: "8000",
      pathname: "/uploads/**",
    },
    {
      protocol: "https",
      hostname: "upload.wikimedia.org",
      pathname: "/**",
    },
    {
      protocol: "https",
      hostname: "gapgpt.cloud",
      pathname: "/user_files/**",
    },
    {
      protocol: "https",
      hostname: "api.mapbox.com",
      pathname: "/**",
    },
    {
      protocol: "https",
      hostname: "tiles.mapbox.com",
      pathname: "/**",
    },
    {
      protocol: "https",
      hostname: "*.tiles.mapbox.com",
      pathname: "/**",
    },
  ];

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    try {
      const parsed = new URL(apiUrl);
      patterns.push({
        protocol: parsed.protocol.replace(":", ""),
        hostname: parsed.hostname,
        ...(parsed.port ? { port: parsed.port } : {}),
        pathname: "/uploads/**",
      });
    } catch {
      // Ignore invalid NEXT_PUBLIC_API_URL at build time.
    }
  }

  return patterns;
}

function localMapOrigins() {
  const urls = [
    process.env.NEXT_PUBLIC_LOCAL_MAP_PM_TILES_URL || "http://localhost:8081/halvaa.pmtiles",
    process.env.NEXT_PUBLIC_LOCAL_MAP_ASSETS_URL || "http://localhost:8081/assets/basemaps-assets-main",
    process.env.NEXT_PUBLIC_LOCAL_MAP_TERRAIN_PM_TILES_URL,
    "https://api.mapbox.com",
    "https://events.mapbox.com",
    "https://tiles.mapbox.com",
  ].filter(Boolean);

  return originsFromUrls(urls);
}

function apiOrigins() {
  return originsFromUrls([process.env.NEXT_PUBLIC_API_URL].filter(Boolean));
}

function originsFromUrls(urls) {
  return [...new Set(urls.flatMap((value) => {
    try {
      const parsed = new URL(value);
      return [parsed.origin];
    } catch {
      return [];
    }
  }))];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: apiUploadPatterns(),
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    const allowedOrigins = [...new Set([...localMapOrigins(), ...apiOrigins()])].join(" ");
    const connectSrc = ["'self'", allowedOrigins].filter(Boolean).join(" ");
    const imageSrc = ["'self'", allowedOrigins, "https://upload.wikimedia.org", "https://gapgpt.cloud", "https://api.mapbox.com", "https://tiles.mapbox.com", "https://*.tiles.mapbox.com"].filter(Boolean).join(" ");
    const assetSrc = ["'self'", allowedOrigins].filter(Boolean).join(" ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src ${connectSrc}; font-src ${assetSrc}; img-src ${imageSrc} data: blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
