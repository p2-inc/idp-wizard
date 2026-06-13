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
