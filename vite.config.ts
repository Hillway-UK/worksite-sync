import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  
  // Security headers with Stripe support
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' https://js.stripe.com 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com",
    "script-src-elem 'self' https://js.stripe.com 'unsafe-inline'",
    "connect-src 'self' https://api.stripe.com https://m.stripe.com https://*.supabase.co wss://*.supabase.co",
    "frame-src https://js.stripe.com https://hooks.stripe.com" + (isDev ? " https://*.lovable.dev https://*.lovable.app" : ""),
    "img-src 'self' data: https: blob: https://*.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');

  const frameAncestors = isDev ? "'self' https://*.lovable.dev https://*.lovable.app" : "'self'";

  return {
    server: {
      host: "::",
      port: 8080,
      headers: {
        'Content-Security-Policy': cspDirectives,
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
