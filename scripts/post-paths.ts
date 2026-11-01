import { publishedPaths } from './content-paths';
export async function getStaticPaths() { return publishedPaths('posts'); }
