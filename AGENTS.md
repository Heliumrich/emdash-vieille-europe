# Vieille-Europe / EmDash

Read README.md for architecture and deployment. Skills: `.agents/skills/building-emdash-site`, `creating-plugins` for plugin work, `emdash-cli` for CMS operations. Documentation MCP: https://docs.emdashcms.com/mcp.

- User requires static public content. Keep `output: "static"`, `getStaticPaths()` and public EmDash queries. The skill's generic all-SSR recommendation is superseded. Admin, signed previews, search and statistics remain SSR. Share templates with previews.
- Never modify CMS core, node_modules, live.config.ts or generated types. EmDash is pinned; upgrades need publication, image and preview checks.
- Image fields are objects. CmsImage renders Astro getImage variants with layout:none and WebP80. Do not add another responsive generator.
- Preserve native captions and the whole-italic paragraph convention. Keep Portable Text editable.
- entry.id is the URL slug; entry.data.id is the database ULID. Match category/tag taxonomy names to schema. Register cache hints in cached SSR routes.
- Plugin writes durable signals only. Publisher builds isolated releases; never rebuild the live tree or restart Node from a CMS request.
- Preserve data.db, uploads/, .env, .data/, .cache/, .site/, private .migration/. Do not re-seed the migrated CMS.
- No public Directus dependencies or personal postal addresses. Phones/emails explicitly approved.
- User deploys manually to /var/www/v2-vieille-europe.ch, systemd emdash. Do not claim local changes are live.
- Run meaningful tests, Astro typecheck, fixture build and static validation. Comparative benchmarks wait until the VPS is deployed.
