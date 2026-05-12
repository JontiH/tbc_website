// @ts-check
import { defineConfig } from 'astro/config';

// Vite dev-server proxy. When MOCK_API_URL is set (e.g. by docker compose's
// `mock` profile), the dev server forwards /api/* and /cdn-cgi/access/* to
// the mock service so the members pages work end-to-end against a fake.
// In production, both paths are handled by Cloudflare (Worker + Access)
// and this proxy does nothing.
const MOCK_API_URL = process.env.MOCK_API_URL;
const proxy = MOCK_API_URL
  ? {
      "/api":               { target: MOCK_API_URL, changeOrigin: true },
      "/cdn-cgi/access":    { target: MOCK_API_URL, changeOrigin: true },
    }
  : undefined;

// https://astro.build/config
export default defineConfig({
  site: "https://torontobeekeeping.ca",
  output: "static",
  vite: proxy ? { server: { proxy } } : {},
});
