# Comparatif à exécuter après déploiement

Ce document prépare les mesures ; ce benchmark n’a pas été exécuté pendant la refonte.

## Préparation et scénarios

Comparer https://vieille-europe.ch (Astro/Directus) et https://test.vieille-europe.ch (Astro/EmDash) après vérification du nouveau déploiement. Noter commits, versions, date, configuration Nginx et charge VPS. Suspendre publications et builds pendant les séries.

Même client, région, navigateur, viewport, densité et profil réseau. Séries desktop/mobile distinctes, contextes isolés sans ancien service worker ni cache HTTP client. L’instrumentation automatisée doit être exclue du compteur.

| Scénario | Mesures |
| --- | --- |
| Accueil | DNS/TLS séparés, TTFB HTML, transfert HTML/CSS/polices, FCP, LCP, CLS |
| Défilement identique | Vignettes choisies, dimensions, octets, délais et erreurs |
| Même article court puis long avec galerie | HTML, FCP/LCP, variantes et lazy loading |
| Lightbox, image suivante et zoom | Clic vers image décodée/visible, résolution, poids et préchargement |
| Navigation vers un autre article | Réutilisation des ressources communes |

Utiliser les mêmes slugs/contenus. Déclencher réellement les interactions. La lightbox inclut décodage et affichage, pas seulement téléchargement. Conserver dimensions et captures : une image moins détaillée n’est pas une comparaison visuelle équivalente.

## Caches et cycles

1. Un cycle complet non comptabilisé par site amorce transformations et caches serveur éventuels. Attendre 60–120 secondes avant les mesures.
2. Série client sans cache : contextes neufs, cache navigateur désactivé, en-têtes Cache-Control:no-cache. Cela ne vide pas cache OS, images générées ou nécessairement proxy : relever Age, Cache-Control, ETag et HIT/MISS séparément.
3. Série cache client autorisé : première navigation froide du contexte, puis ressources réutilisées. Ne pas agréger ces conditions.
4. Trois blocs de six cycles par site/condition, soit 18 observations. Alterner A/B puis B/A. Espacer requêtes de 1–2 s, scénarios d’au moins 5 s, blocs et changements de site de 60–120 s. Relever événements parasites et charge si accessibles.
5. Une mesure réellement froide côté serveur exige une série contrôlée séparée. Ne pas vider les caches système du VPS partagé pour les essais ordinaires.

Le nouveau Nginx sert les fichiers précompilés sans proxy-cache HTML ; distinguer cela des transformations Directus à la demande.

## Analyse

Archiver observations brutes, HAR/JSON, erreurs et paramètres. Pour chaque scénario/condition : n, médiane, quartiles, p95, min/max ; différences appariées ou ratios EmDash/Directus par bloc et intervalle bootstrap. Documenter les exclusions sans masquer les extrêmes. Ne pas mélanger temps HTML, images et navigation dans une moyenne globale.

FCP/LCP exigent un vrai navigateur avec instrumentation identique. Mesurer les requêtes réseau séparément. Présenter écarts absolus et relatifs avec dispersion avant de conclure.

Concurrence facultative 2 puis 4 : HTML et une image préparée, débit plafonné, pauses et arrêt aux erreurs. Séparer du test de navigation ; éviter une charge prolongée sur le VPS partagé.

Le rapport distinguera vitesse de visite, coût de reconstruction, espace disque et exploitation. Ergonomie de l’éditeur et stabilité des API restent indépendantes du benchmark.
