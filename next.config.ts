import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  distDir: "build",
  // sql.js loads its WebAssembly file at runtime. Keeping it external makes
  // the package (and the .wasm file copied by the Docker image) resolvable in
  // both `next dev` and the standalone server.
  serverExternalPackages: ["sql.js"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
