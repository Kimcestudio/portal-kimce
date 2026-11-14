/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development'

const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.KIMCE_BUILD_DIR || '.next',
  ...(isDev ? { async rewrites() { return [{ source: '/api/projects/gantt', destination: `https://us-central1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'kimce-app'}.cloudfunctions.net/publicProjectGantt` }] } } : {}),
  // In dev, skip static-export so dynamic routes work freely.
  // In production, 'export' generates the static files for Firebase Hosting.
  output: isDev ? undefined : 'export',
  // API routes are handled by Firebase Cloud Functions (functions/notionApi.js).
  // Firebase Hosting rewrites /api/* to those functions — see firebase.json.
  images: {
    unoptimized: true,
  },
  webpack: (config, { webpack, isServer }) => {
    if (!isServer) {
      // Strip "node:" protocol prefix so webpack can apply fallback rules.
      // pptxgenjs and xlsx import node:fs / node:https which webpack can't handle
      // in browser bundles without this plugin.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:/,
          (resource) => {
            resource.request = resource.request.replace(/^node:/, '')
          }
        )
      )
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        http: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        buffer: false,
        zlib: false,
        url: false,
        net: false,
        tls: false,
      }
    }
    return config
  },
};

module.exports = nextConfig;
