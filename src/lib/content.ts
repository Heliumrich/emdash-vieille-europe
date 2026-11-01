import { getEmDashCollection, type ContentEntry } from 'emdash';
import type { Post } from '../../emdash-env';
import type { AstroGlobal } from 'astro';
import type { ImageValue } from 'emdash';

export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  date: string;
  cover?: string;
  image?: ImageValue;
  readingMinutes: number;
}

function plainText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  if (Array.isArray(value)) return value.map(plainText).join(' ');
  const record = value as Record<string, unknown>;
  if (record._type === 'span') return String(record.text || '');
  return ['children', 'rows', 'cells', 'content'].map(key => plainText(record[key])).join(' ');
}

export function toArticle(entry: ContentEntry<Post>): Article {
  const { data } = entry;
  const image = data.featured_image;
  return {
    id: data.id, slug: entry.id, title: data.title, excerpt: data.excerpt || '',
    date: (data.publishedAt || data.createdAt).toISOString(),
    cover: image?.src || (image?.id ? `/_emdash/api/media/file/${image.meta?.storageKey || image.id}` : undefined), image,
    readingMinutes: Math.max(1, Math.ceil(plainText(data.content).trim().split(/\s+/).length / 200)),
  };
}

// Fetch every cursor so numbered archives and neighbours also work past 100 posts.
export async function getArticles(astro?: AstroGlobal): Promise<Article[]> {
  const articles: Article[] = [];
  let cursor: string | undefined;
  do {
    const result = await getEmDashCollection('posts', { status: 'published', limit: 100, cursor, orderBy: { published_at: 'asc' } });
    if (result.error) throw result.error;
    if (astro?.cache?.enabled) astro.cache.set(result.cacheHint);
    articles.push(...result.entries.map(toArticle));
    cursor = result.nextCursor;
  } while (cursor);
  return articles;
}
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Zurich' }).format(new Date(date));
}
