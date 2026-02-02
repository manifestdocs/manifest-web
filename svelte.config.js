import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const isPages = process.env.VITE_BUILD_TARGET === 'pages';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      fallback: 'index.html', // SPA mode for client-side routing
    }),
    paths: {
      base: isPages ? '/manifest' : '',
    },
  },
};

export default config;
