import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tanstackRouter from '@tanstack/router-plugin/vite'
import { oidcSpa } from 'oidc-spa/vite-plugin'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const issuer = env.VITE_OIDC_ISSUER_URI ?? ''
  // Keycloak server origin, e.g. http://localhost:8080 — used only to proxy
  // the SAML descriptor endpoint in dev (see proxy note below).
  const keycloakOrigin = issuer ? new URL(issuer).origin : 'http://localhost:8080'
  // The realm-paths prefix, handling both legacy (/auth/realms) and modern
  // (/realms) Keycloak path styles. Defaults to the legacy dev setup.
  const realmsPrefix = issuer
    ? new URL(issuer).pathname.replace(/\/realms\/[^/]+\/?$/, '/realms')
    : '/auth/realms'

  return {
    // Relative base: the app is mounted under /realms/{realm}/wizard/{version}/ in
    // production and at / under `vite dev`, so asset and chunk URLs must resolve
    // against the entry's own location rather than an absolute path baked in here.
    base: './',
    build: {
      // One stylesheet, so the theme template can link a predictable filename.
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          // Fixed entry names let wizard-v2.ftl reference the bundle without a
          // manifest lookup, mirroring how wizard-v1's theme template works.
          entryFileNames: 'main.js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const name = assetInfo.names?.[0] ?? ''
            return name.endsWith('.css') ? 'main.css' : 'assets/[name]-[hash][extname]'
          },
        },
      },
    },
    plugins: [
      tailwindcss(),
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      tsconfigPaths(),
      oidcSpa({
        browserRuntimeFreeze: { enabled: true },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      proxy: {
        // Keycloak's SAML descriptor endpoint emits no CORS headers, so a
        // cross-origin fetch from the :5173 dev server fails. Proxy realm
        // paths through the dev server so the same-origin-relative fetch in
        // SamlCertificateRenderer succeeds. Production serves the SPA from the
        // Keycloak origin, so this path is dev-only.
        [realmsPrefix]: { target: keycloakOrigin, changeOrigin: true },
      },
    },
  }
})
