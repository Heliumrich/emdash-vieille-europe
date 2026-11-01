# Vieille-Europe · EmDash

Le carnet ferroviaire de Michel Pousaz, recréé avec Astro et EmDash. Le thème reprend les couleurs, les polices, les photographies, la navigation, les légendes et la visionneuse du blog précédent.

## Contenu

Les textes et les médias sont enregistrés dans **l’instance EmDash existante**. Le site ne lit plus Directus, ni au démarrage, ni pendant la compilation, ni lors des visites.

- 27 articles publiés avec leurs slugs et dates historiques, plus la présentation.
- 379 images dans les articles, 17 galeries, cinq vidéos YouTube chargées à la demande et un tableau éditable.
- Les 389 fichiers de la médiathèque Directus ont été copiés et convertis en WebP 80 %. EmDash conserve 370 médias distincts après déduplication.
- Les téléphones et courriels ont été conservés conformément à la consigne ; les adresses postales personnelles ont été retirées.
- Aucun contenu de démonstration n’est ajouté par le seed.

Les articles utilisent les blocs natifs Portable Text : texte, image, galerie, tableau et iframe. Aucun article n’est stocké dans un bloc HTML opaque. Les futures modifications et publications s’effectuent dans `/_emdash/admin` et apparaissent directement sur le site.

## Routes

| Route | Contenu |
| --- | --- |
| `/`, `/page/2/`, etc. | Journal, dix articles par page, anciens d’abord |
| `/recent/`, `/recent/page/2/`, etc. | Journal, récents d’abord |
| `/blog/{slug}/` | Article, photographies et récits voisins |
| `/presentation/` | Présentation de l’auteur |
| `/{slug}/` | Autres pages publiées dans EmDash |
| `/search/` | Recherche native EmDash |
| `/rss.xml`, `/sitemap.xml` | Flux et sitemap |

Les anciennes routes du modèle EmDash `/posts/…` et `/pages/…` redirigent vers les routes du thème.

## Images, légendes et cache

Une légende native d’image est prioritaire. Un paragraphe entièrement en italique immédiatement après une image sans légende ou une galerie devient sa légende. Un paragraphe vide sépare un récit en italique d’une légende. Les liens et le gras sont conservés. Une galerie garde ses colonnes sur téléphone et partage sa légende avec la visionneuse.

`Image` d’EmDash et le moteur Sharp d’Astro produisent des WebP de qualité 80. Les variantes sont distinctes selon l’usage, limitées à la largeur réelle de l’original :

| Usage | Largeurs proposées, en pixels |
| --- | --- |
| Vignettes | 240, 360, 480, 720 |
| Lecture | 400, 600, 800, 1200, 1600, 2000 |
| Galeries | 240, 400, 600, 800, 1200 |
| Visionneuse et zoom | 800, 1200, 1600, 2000, 2400, 3200, 4000 |

Les attributs `srcset` et `sizes` permettent au navigateur de choisir selon la place disponible et la densité de l’écran. La visionneuse charge les variantes adaptées au zoom et précharge les photographies voisines.

Le middleware de `src/lib/image-cache.ts` conserve les résultats du **moteur natif EmDash**, dans `.cache/image-variants/`. Il lit les originaux directement dans `uploads/`. Le cache dépend des paramètres de transformation et de la version du fichier original : remplacer un original invalide immédiatement ses anciennes variantes. Les validateurs HTTP natifs, les réponses `304`, les contrôles de type et les protections EmDash restent en place. `X-Image-Cache: HIT` permet de contrôler sa réutilisation.

Le cache est persistant entre redémarrages. Conserver son dossier entre déploiements pour éviter les recalculs. La suppression d’un original empêche également de servir sa variante en cache.

## Déploiement manuel sur l’instance existante

Node.js 24 est utilisé pour le développement et la vérification. Depuis le dépôt du serveur :

```bash
git pull --ff-only
npm ci
npm run build
```

Redémarrer ensuite le service Node existant qui lance `node dist/server/entry.mjs`. **Conserver `data.db`, `uploads/` et le cache**, qui ne sont pas versionnés. Ne pas réinitialiser le CMS ni réimporter le seed sur l’instance déjà migrée.

Configurer `EMDASH_SITE_URL=https://test.vieille-europe.ch` lors du build et pour le service. `.env.example` décrit aussi le chemin de base de données et le dossier de cache. Le compte du service doit pouvoir écrire dans `uploads/` et dans le cache. Nginx doit autoriser les uploads (`client_max_body_size 64m;`) et transmettre les en-têtes de proxy habituels.

Après le redémarrage, pré-générer les variantes réellement utilisées par les listes, les articles et la visionneuse :

```bash
EMDASH_SITE_URL=https://test.vieille-europe.ch npm run warm:images
```

Ce script parcourt le site public, relit ses vrais `srcset` et effectue deux requêtes simultanées maximum. Il réutilise les variantes déjà en cache et peut être relancé après une interruption. Le lancer après une nouvelle série de photos pour éviter à leurs premiers visiteurs le coût du calcul.

## Vérification et développement

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run dev -- --host 127.0.0.1
```

Les 17 tests portent sur les légendes, les galeries, le tableau éditable et le cache. La compilation et les types Astro sont vérifiés. Le correctif ciblé de Zod dans `overrides` corrige la dépendance vulnérable du modèle EmDash ; l’audit npm ne signale aucune vulnérabilité à la livraison.

Les outils `prepare-migration.mjs`, `download-directus-media.mjs`, `convert-media-webp.mjs` et `rewrite-media.mjs` documentent la reprise. Leurs données et sauvegardes privées restent dans `.migration/`, exclu de Git. `local-preview.mjs` ne fonctionne que sur localhost et prépare une fixture avec les API natives ; `verify:site` utilise cette fixture pour rapprocher les 27 pages de leur source.

Le compteur de visites de l’ancien blog dépendait d’un service distinct et n’est pas installé par ce thème.
