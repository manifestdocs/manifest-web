import adapterNode from '@sveltejs/adapter-node';
import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const isPages = process.env.VITE_BUILD_TARGET === 'pages';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: isPages
      ? adapterStatic({ fallback: 'index.html' })
      : adapterNode(),
    paths: {
      base: isPages ? '/manifest' : '',
    },
    csrf: {
      trustedOrigins: [],
    },
  },
};

export default config;
