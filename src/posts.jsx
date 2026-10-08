import { postsMeta } from './posts-meta.js'

// JSX content keyed by slug. Metadata lives in posts-meta.js.
const content = {}

// Merge metadata + content into the shape the app expects.
export const posts = postsMeta.map((meta) => ({
  ...meta,
  en: { ...meta.en, content: content[meta.slug]?.en },
  zh: { ...meta.zh, content: content[meta.slug]?.zh },
}))
