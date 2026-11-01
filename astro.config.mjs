import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";
import { resolve } from 'node:path';

const siteUrl = process.env.EMDASH_SITE_URL || 'https://test.vieille-europe.ch';

export default defineConfig({
  site: siteUrl,
  output: "static",
  cacheDir: './.cache/astro',
  outDir: process.env.VE_ASTRO_OUT_DIR || './dist',
	adapter: node({
		mode: "standalone",
	}),
	security: {
	    allowedDomains: [
	      { hostname: "test.vieille-europe.ch", protocol: "https" },
	      { hostname: "test.vieille-europe.ch", protocol: "http" },
	    ],
	},
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
			database: sqlite({ url: process.env.EMDASH_DATABASE_URL || "file:./data.db" }),
			storage: local({
        directory: resolve(process.env.EMDASH_UPLOADS_DIR || './uploads'),
				baseUrl: "/_emdash/api/media/file",
			}),
      siteUrl,
      plugins: [{ id: 'vieille-europe-publisher', version: '1.0.0', entrypoint: '@vieille-europe/static-publisher', options: {} }],
		}),
	],
	devToolbar: { enabled: false },
});
