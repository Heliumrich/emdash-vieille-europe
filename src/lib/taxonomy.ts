import { getEmDashCollection, getTerm } from 'emdash';
import { toArticle, type Article } from './content';

export async function taxonomyArticles(taxonomy: 'category' | 'tag', slug: string) {
  const term = await getTerm(taxonomy, slug);
  if (!term) return undefined;
  const articles: Article[] = [];
  let cursor: string | undefined;
  do {
    const result = await getEmDashCollection('posts', { where: { [taxonomy]: term.slug }, status: 'published', limit: 100, cursor, orderBy: { published_at: 'desc' } });
    if (result.error) throw result.error;
    articles.push(...result.entries.map(toArticle));
    cursor = result.nextCursor;
  } while (cursor);
  return { term, articles };
}
