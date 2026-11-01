import { getEmDashCollection, getTaxonomyTerms } from 'emdash';
import { taxonomyArticles } from '../src/lib/taxonomy';

export async function publishedPaths(collection: 'posts' | 'pages') {
  const entries = [];
  let cursor: string | undefined;
  do {
    const result = await getEmDashCollection(collection, { status: 'published', limit: 100, cursor });
    if (result.error) throw result.error;
    entries.push(...result.entries);
    cursor = result.nextCursor;
  } while (cursor);
  return entries.map(entry => ({ params: { slug: entry.id } }));
}
export async function journalPaths() {
  const entries = await publishedPaths('posts');
  return Array.from({ length: Math.max(0, Math.ceil(entries.length / 10) - 1) }, (_, index) => ({ params: { page: String(index + 2) } }));
}
export async function taxonomyPaths(taxonomy: 'category' | 'tag', paginated = false) {
  const terms = await getTaxonomyTerms(taxonomy, { includeCounts: false });
  if (!paginated) return terms.map(term => ({ params: { slug: term.slug } }));
  const paths: { params: { slug: string; page: string } }[] = [];
  for (const term of terms) {
    const result = await taxonomyArticles(taxonomy, term.slug);
    const pages = Math.ceil((result?.articles.length || 0) / 10);
    for (let page = 2; page <= pages; page++) paths.push({ params: { slug: term.slug, page: String(page) } });
  }
  return paths;
}
