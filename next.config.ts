import type { NextConfig } from 'next'

// Pages used Spanish paths before; keep old bookmarks working.
const LEGACY_PATHS = {
  '/transacciones': '/transactions',
  '/presupuesto': '/budget',
  '/categorias': '/categories',
  '/informes': '/reports',
  '/importar': '/import',
}

const nextConfig: NextConfig = {
  async redirects() {
    return Object.entries(LEGACY_PATHS).map(([source, destination]) => ({
      source,
      destination,
      permanent: true,
    }))
  },
}

export default nextConfig
