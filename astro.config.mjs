// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import vue from '@astrojs/vue';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
	// TODO: replace with the real domain (required for sitemap / RSS / canonical URLs)
	site: 'https://example.com',
	i18n: {
		defaultLocale: 'zh-tw',
		locales: ['zh-tw', 'en'],
		routing: { prefixDefaultLocale: false },
	},
	integrations: [react(), vue(), mdx(), sitemap()],
});
