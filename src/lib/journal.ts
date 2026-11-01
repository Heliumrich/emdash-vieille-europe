import { getArticles, type Article } from './content';
import type { AstroGlobal } from 'astro';
export type JournalOrder = 'asc' | 'desc';
export const JOURNAL_PAGE_SIZE = 10;
export function journalPageHref(page: number, order: JournalOrder = 'asc'): string {
  const base = order === 'desc' ? '/recent/' : '/';
  return page === 1 ? base : `${base}page/${page}/`;
}
export async function getJournalArticles(order: JournalOrder = 'asc', astro?: Pick<AstroGlobal, 'cache'>): Promise<Article[]> {
  const articles = await getArticles(astro);
  return order === 'desc' ? articles.reverse() : articles;
}
