import type { NextConfig } from "next";
import path from 'path'
import { fileURLToPath } from 'url'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  // better-sqlite3 is a native Node.js module — must not be bundled by webpack
  serverExternalPackages: ['better-sqlite3'],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
