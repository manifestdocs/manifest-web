// SPA mode: disable SSR for client-side routing
// Enable prerendering only for GitHub Pages static build
export const prerender = import.meta.env.VITE_BUILD_TARGET === 'pages' ? true : false;
export const ssr = false;
