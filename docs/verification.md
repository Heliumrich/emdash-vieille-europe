# Vérification locale du 1 novembre 2026

Environnement : Windows, Node 24.19.0, Astro 7.4.4, EmDash 1.4.0. Base et médias de test locaux ; aucune modification de la production pendant ces tests.

| Contrôle | Résultat |
| --- | --- |
| `npm test` | 27 tests réussis |
| `npm run typecheck` | 62 fichiers, zéro erreur, avertissement ou hint |
| Compilation de production statique | Réussie ; 64 fichiers HTML, dont les redirections de compatibilité |
| Validation des articles | 27 articles, textes et dates rapprochés de la fixture de migration |
| Médias intégrés | 379 images, 17 galeries, 5 vidéos et 1 tableau |
| Images générées au build | 1 575 WebP ; tous les assets référencés existent |
| Dépendances Directus dans le HTML | Aucune |
| Pagination | Dix articles par page, deux ordres chronologiques vérifiés |
| CSS sur le serveur de production local | 200, type text/css, contenu CSS |
| Image statique | image/webp ; revalidation ETag donnant 304 |
| Prévisualisation native signée | Le brouillon est visible, private/no-store et noindex |
| HTML public du même article | Ne contient pas le brouillon |
| Prévisualisation sans jeton ou jeton d’un autre contenu | 404 |
| Publication via API native EmDash | Nouveau signal durable constaté dans la file |
| Publisher réel sur cette file | Build réussi, assets copiés, lien current activé, file vide, last-success écrit |
| Recherche SSR | 200 avec résultats |
| Compteur et statistiques | 200 JSON pour le total, 200 sans cache pour la page |

Les tests du publisher couvrent notamment l’échec de compilation conservant l’ancien site et la file, une publication arrivée pendant le build, l’exclusion des builds concurrents et le refus d’écraser un asset immutable avec des octets différents. Les données modifiées pour le test de brouillon ont été restaurées.

Les compilations successives ont réutilisé le cache Astro. Ce constat fonctionnel n’est pas une mesure comparative de performances.

## Limites

- Nginx et systemd ne tournent pas sur cette machine Windows. Installer les fichiers du README sur le VPS et exécuter `nginx -t`, puis vérifier une publication réelle. Le remplacement atomique POSIX d’un lien existant reste à contrôler sur Linux ; le test local a activé une première release via une jonction Windows.
- Le navigateur a refusé l’accès au serveur local : aucune validation visuelle desktop/mobile ni interaction réelle avec la lightbox n’a été réalisée dans cette session. Les médias, variantes et légendes ont été contrôlés par tests et inspection du HTML.
- Le comparatif de performances entre les deux sites n’a pas été exécuté. Suivre `performance-protocol.md` après déploiement.
