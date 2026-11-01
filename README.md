# Vieille-Europe · Astro et EmDash

Le carnet ferroviaire de Michel Pousaz : thème du blog historique, contenu éditable dans EmDash et **pages publiques statiques**. Administration, prévisualisation, recherche et statistiques restent dynamiques.

## Stack et données

- Node.js 24, Astro 7 et adaptateur Node standalone ; versions résolues dans `package-lock.json`.
- EmDash **1.4.0**, volontairement fixé. React sert à son administration ; le thème public ne charge pas d’application React.
- SQLite (`data.db`), médias locaux (`uploads/`), Sharp via l’API publique `getImage()` d’Astro.
- Nginx pour les fichiers publics ; systemd pour le CMS et les reconstructions.
- Compression gzip du HTML, CSS, JS, JSON, XML et SVG ; pas de recompression des WebP.
- Une seconde base SQLite, `.data/statistics.sqlite`, pour les statistiques, sans service supplémentaire.

La migration reprend 27 articles, la présentation, dates et slugs historiques, 379 images intégrées, 17 galeries, cinq vidéos YouTube et un tableau éditable. Les 389 fichiers Directus ont été copiés et convertis en WebP 80 %, soit 370 médias distincts après déduplication EmDash. Téléphones et courriels sont conservés conformément à la consigne ; les adresses postales personnelles sont retirées.

**Directus n’est utilisé ni au build, ni au démarrage, ni pendant une visite.** Les scripts de reprise restent dans `scripts/`, leurs sauvegardes privées dans `.migration/`, ignoré par Git. Ne pas réimporter le seed sur le CMS déjà migré.

Le contenu utilise les blocs natifs Portable Text : paragraphes, images, galeries, tableaux et vidéos. Aucun article n’est enfermé dans du HTML opaque.

## Thème et composants

`src/layouts/BaseLayout.astro` assemble métadonnées natives EmDash, en-tête, contenu, pied de page et visionneuse. `src/styles/vieille-europe.css` définit mise en page, couleurs et adaptations mobiles. Libre Baskerville et Source Sans 3 sont hébergées localement.

`ArticlePage.astro`, `PresentationPage.astro` et `ContentPage.astro` sont partagés par le rendu statique et la prévisualisation SSR. `ArticleList.astro` et `Pagination.astro` gèrent les listes de dix articles et les deux ordres chronologiques. `ArticleBody.astro`, `Photograph.astro` et `Gallery.astro` rendent les blocs natifs.

Une légende native d’image est prioritaire. Sinon, un paragraphe entièrement en italique immédiatement après une image ou une galerie devient son `figcaption`. Liens et gras sont conservés. Un paragraphe vide sépare un récit en italique d’une légende. La galerie garde ses colonnes sur mobile et partage sa légende avec la visionneuse.

`ImageViewer.astro` utilise un dialogue accessible : clavier, Échap, zoom, résolution adaptée et préchargement des images voisines. Les vidéos YouTube ne chargent leur iframe qu’après un clic. Aucun fichier du paquet EmDash n’est modifié. Les composants inutilisés du modèle initial encore présents ne définissent pas le thème actuel.

## Routes et rendu

`astro.config.mjs` définit `output: "static"`. Les routes publiques interrogent les API EmDash au build ; `getStaticPaths()` énumère les contenus publiés. L’intégration EmDash conserve ses propres routes en SSR.

| Routes | Rendu et usage |
| --- | --- |
| `/`, `/page/{n}/` | Statique, anciens d’abord, dix articles par page |
| `/recent/`, `/recent/page/{n}/` | Statique, récents d’abord, noindex |
| `/blog/{slug}/` | Statique, article et récits voisins |
| `/presentation/`, `/{slug}/` | Statique, pages publiées |
| `/category/{slug}/`, `/tag/{slug}/`, puis `page/{n}/` | Statique, archives filtrées paginées |
| `/rss.xml`, `/sitemap.xml`, `/robots.txt`, `/404.html` | Statique |
| `/_astro/*` | CSS, JS, WebP et polices hachés, servis par Nginx |
| `/_emdash/*` | SSR natif : admin, API, MCP, originaux des médias |
| `/preview/posts/{id}/`, `/preview/pages/{id}/` | SSR, jeton natif obligatoire, privé et sans cache |
| `/_image` | Transformations natives pour les prévisualisations ; cache disque |
| `/search/` | SSR, recherche native EmDash |
| `/statistiques/`, `/api/statistiques/count/`, `/api/statistiques/visit/` | SSR, statistiques et API du compteur |

Nginx redirige `/posts/{slug}/` vers `/blog/{slug}/`, `/pages/{slug}/` vers `/{slug}/`, et `/posts/` vers `/`. Les routes Astro de compatibilité restent utiles en développement.

La prévisualisation emploie l’option native `EMDASH_PREVIEW_PATH_PATTERN=/preview/{collection}/{id}/`, également définie au build par `scripts/astro.mjs`. Le lien admin utilise l’identifiant interne du contenu et va directement vers le rendu SSR partagé. Un brouillon ne remplace jamais le HTML public. Nginx réécrit aussi les anciens liens publics `?_preview=…`.

Le compteur est une petite île JS sans hydratation React. Il lit le total à l’approche du pied de page et enregistre les visites après le chargement. Sa base garde des identifiants hachés et des agrégats, sans IP ni URL visitée ; DNT/GPC et robots sont exclus. L’historique du compteur de l’ancien site n’est pas importé automatiquement.

## Images et préchauffage automatique

`src/lib/image-variants.ts` appelle Astro/Sharp avec **WebP qualité 80**, `layout: 'none'` et largeur plafonnée à celle de l’original. `CmsImage.astro` rend les `srcset` et `sizes` ; aucun deuxième générateur responsive EmDash ne crée de variantes inutilisées.

| Usage | Largeurs proposées, en pixels |
| --- | --- |
| Vignettes | 240, 360, 480, 720 |
| Article | 400, 600, 800, 1200, 1600, 2000 |
| Galerie | 240, 400, 600, 800, 1200 |
| Visionneuse et zoom | 800, 1200, 1600, 2000, 2400, 3200, 4000 |

Le navigateur choisit selon la place et la densité de l’écran. Les variantes de lightbox sont générées même si personne ne l’a encore ouverte. Le contenu migré vérifié produit **1 575 WebP**, partagés entre les pages.

**Une publication dans l’admin génère automatiquement les nouvelles variantes.** Aucun préchauffage manuel n’est nécessaire. Un nouvel original JPEG peut rester dans la médiathèque pour l’édition ; les visiteurs des articles et de la lightbox reçoivent les WebP.

Trois caches distincts :

1. `.cache/astro/` conserve les transformations Astro entre builds, même après `npm ci`.
2. `.site/assets/_astro/` conserve les fichiers hachés des publications, servis un an en `immutable`. Les anciens assets restent accessibles aux onglets déjà ouverts.
3. `.cache/image-variants/` accélère `/_image` en prévisualisation. `image-cache.ts` entoure le moteur natif, conserve ETag/304 et vérifie toujours l’original.

`media-version.mjs` ajoute une empreinte du fichier source à l’URL transmise à Astro : remplacer un média sans changer son identifiant crée de nouveaux noms de variantes. Le middleware observe aussi les remplacements dans l’admin.

Conserver les caches entre déploiements. Le pool immutable n’est pas purgé automatiquement : surveiller son volume à long terme. `warm:images` reste un diagnostic pour l’ancien rendu SSR et n’est plus nécessaire au fonctionnement statique.

## Reconstruction après publication

Le plugin natif `plugins/static-publisher/` utilise les hooks publics EmDash de publication, dépublication, suppression, restauration, upload et modification d’auteur. Il écrit un signal durable dans `.site/queue/`. Un enregistrement de brouillon ne publie rien. Le middleware ajoute des signaux après les écritures REST réussies de réglages, menus, taxonomies et remplacements de médias.

Le timer systemd vérifie la file environ toutes les quinze secondes. Sans signal, il sort immédiatement. Sinon `scripts/publisher.mjs` regroupe les changements, verrouille la compilation et construit dans `.site/releases/`. Il vérifie HTML, CSS et variantes, refuse les dépendances Directus, ajoute les assets au pool puis bascule atomiquement `.site/current`.

Un changement pendant le build entraîne une nouvelle passe ou reste en file. Un échec conserve l’ancien site et la file, avec nouvelle tentative après deux minutes. Les trois dernières releases sont gardées, plus celles utilisées par `current` et `runtime`.

Le CMS ne lance pas de commande système : la compilation utilise un service séparé, les mêmes données et les médias du CMS existant. **Le CMS doit fonctionner et son URL publique être accessible pendant le premier build.** Une publication de contenu ne redémarre pas Node. Pour déployer du code, `deploy:prepare` déplace aussi `.site/runtime`, puis on redémarre le service.

Une écriture directe en SQLite ou certains réglages par un autre canal n’émettent pas nécessairement de signal : utiliser `npm run publish:static -- --force`. État dans `.site/last-success.json`, erreurs dans `.site/failure.json` et le journal systemd.

## Installation sur le VPS existant

Chemin `/var/www/v2-vieille-europe.ch`, compte `almalinux`, service `emdash`, port local `4321`. Les fichiers de `docs/vps/` reprennent ce domaine et ses certificats Certbot.

Conserver **`data.db`, `uploads/`, `.data/`, `.env`, `.cache/`, `.site/`**. Sauvegarder SQLite de manière cohérente et les uploads avant une mise à jour CMS. Ne pas réinitialiser la base ni le seed.

### Première bascule

Garder le service actuel en marche pendant la préparation :

```bash
cd /var/www/v2-vieille-europe.ch
git pull --ff-only
npm ci --include=dev
# Vérifier .env à partir de .env.example sans écraser les valeurs existantes.
EMDASH_SITE_URL=https://test.vieille-europe.ch npm run deploy:prepare
npm run verify:static -- .site/current
```

Le build doit réussir avant la suite. Il prépare les liens et les assets ; l’ancien serveur utilise encore `dist/server/entry.mjs`.

Sauvegarder la configuration puis installer les fichiers :

```bash
sudo cp /etc/systemd/system/emdash.service /etc/systemd/system/emdash.service.before-static
sudo cp /etc/nginx/conf.d/test.vieille-europe.ch.conf /etc/nginx/conf.d/test.vieille-europe.ch.conf.before-static
sudo install -d /etc/nginx/snippets
sudo install -m 644 docs/vps/emdash.service /etc/systemd/system/emdash.service
sudo install -m 644 docs/vps/emdash-static-publish.service /etc/systemd/system/emdash-static-publish.service
sudo install -m 644 docs/vps/emdash-static-publish.timer /etc/systemd/system/emdash-static-publish.timer
sudo install -m 644 docs/vps/vieille-europe-emdash-proxy.conf /etc/nginx/snippets/vieille-europe-emdash-proxy.conf
sudo install -m 644 docs/vps/test.vieille-europe.ch.conf /etc/nginx/conf.d/test.vieille-europe.ch.conf
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl restart emdash
sudo systemctl reload nginx
sudo systemctl enable --now emdash-static-publish.timer
```

Corriger un échec de `nginx -t` avant de recharger Nginx. `almalinux` doit pouvoir écrire données, releases et caches ; Nginx doit traverser et lire les fichiers statiques. Sur AlmaLinux, vérifier droits et labels SELinux en cas de 403, sans désactiver SELinux.

Configurer la même `EMDASH_SITE_URL` au build et au runtime. Les options figurent dans `.env.example` et les unités ; ne pas fixer `VE_ASTRO_OUT_DIR` dans le `.env` permanent. Authentification et jetons de prévisualisation restent natifs.

### Déploiements de code suivants

```bash
cd /var/www/v2-vieille-europe.ch
git pull --ff-only
bash scripts/deploy-vps.sh
```

Le script installe les dépendances, prépare une release isolée, bascule les liens, redémarre `emdash` et vérifie/recharge Nginx. Réinstaller les unités/configurations si ces fichiers ont changé. `npm run build` seul ne bascule pas la release active.

### Contrôles

```bash
sudo systemctl status emdash emdash-static-publish.timer
sudo journalctl -u emdash-static-publish.service -n 60 --no-pager
cat .site/last-success.json
npm run verify:static -- .site/current
curl -I https://test.vieille-europe.ch/
# Une URL CSS réellement référencée par le HTML doit répondre 200 text/css.
```

Publier ensuite une petite modification depuis l’admin, attendre timer et build, vérifier le HTML et `last-success.json`. Un brouillon doit rester visible seulement par son lien signé. La configuration Nginx/systemd doit être validée sur le VPS ; les essais locaux Windows ne remplacent pas ce contrôle Linux.

L’incident CSS initial venait d’un ancien processus Node servant des références de fichiers disparus après le build. Les URLs CSS répondaient **404 HTML**, donc étaient refusées avec `nosniff`. Avec l’ancien déploiement, redémarrer `emdash` après le build corrige le décalage. La nouvelle publication conserve les assets des versions antérieures. Ne pas retirer `nosniff` ni déguiser une 404 en CSS.

Pour forcer une reconstruction : `npm run publish:static -- --force`. Consulter le journal en cas d’échec. Un retour à un ancien code doit tenir compte des éventuelles migrations SQLite.

## Développement et vérifications

```bash
npm ci --include=dev
npm test
npm run typecheck
npm run dev -- --host 127.0.0.1
npm run build
npm run verify:static
```

Le build nécessite une base EmDash et des médias accessibles à l’URL configurée. Une base vide ne remplace pas les données du CMS. `local-preview.mjs`, limité à localhost, prépare la fixture par les API natives à partir des données privées de migration.

Les tests couvrent légendes, galeries, tableaux, cache d’image, remplacement d’original, file, échec de build, collision d’assets, exclusion des builds concurrents et statistiques. `verify:static` inspecte le build ; `verify:site` rapproche articles et pagination de la fixture. `verify-preview.mjs` crée puis restaure un brouillon **sur localhost uniquement** et contrôle prévisualisation, absence de fuite et signal de publication.

Les résultats et limites de la vérification locale sont consignés dans [docs/verification.md](docs/verification.md).

Le correctif `overrides` de Zod traite une dépendance transitive vulnérable du modèle. Garder le lockfile et vérifier `npm audit` lors des mises à jour. Les avertissements EmDash sur `request.headers` au prérendu proviennent du SDK actuel et n’empêchent pas la génération statique.

## Maintenabilité

Le site reste un projet Astro : composants du thème, API publiques et blocs EmDash, `getStaticPaths()`, `getImage()`. Aucun fork ni patch de `node_modules`, aucun deuxième moteur de rendu. Les personnalisations sensibles sont isolées : plugin, publisher, prévisualisation, cache/versionnement des images et statistiques.

File, timer et releases ajoutent de l’exploitation par rapport à un SSR simple. C’est la contrepartie du contenu public précompilé. EmDash étant récent, aucune garantie de compatibilité avec toutes ses mises à jour n’est possible : version 1.4.0 fixée, mises à jour volontaires sur copie de base, tests publication/dépublication/remplacement d’image/prévisualisation, puis sauvegarde et déploiement.

Pour ce blog riche en photos et peu modifié, le compromis paraît raisonnable : édition EmDash et visites principalement Astro/Nginx. L’ancien Astro/Directus reste plus éprouvé. Le bénéfice d’EmDash est surtout son éditeur et son intégration ; aucun gain de performance n’est affirmé avant mesure.

Le protocole à exécuter plus tard est dans [docs/performance-protocol.md](docs/performance-protocol.md). Le comparatif de charge attend le déploiement propre.

Références : [Astro SSR](https://docs.astro.build/en/guides/on-demand-rendering/), [images Astro](https://docs.astro.build/en/guides/images/), [EmDash](https://docs.emdashcms.com/), [Nginx try_files](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files).
