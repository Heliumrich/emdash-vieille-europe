import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";

export default defineConfig({
	site: process.env.EMDASH_SITE_URL || "https://test.vieille-europe.ch",
	output: "server",
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
				directory: "./uploads",
				baseUrl: "/_emdash/api/media/file",
			}),
			siteUrl: process.env.EMDASH_SITE_URL || "https://test.vieille-europe.ch",
		}),
	],
	devToolbar: { enabled: false },
});
