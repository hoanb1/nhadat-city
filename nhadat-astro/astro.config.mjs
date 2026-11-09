import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://nhadat.city',
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  server: {
    port: 3006,
    host: '0.0.0.0',
  },
  integrations: [
    tailwind({
      applyBaseStyles: true,
    }),
  ],
  compressHTML: true,
});
