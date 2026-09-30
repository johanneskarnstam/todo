export const normalizeTag = (tag: string) => tag.trim().toLowerCase().replace(/\s+/g, '-')

export const normalizeTags = (tags: string[]) =>
  [...new Set(tags.map(normalizeTag).filter(Boolean))]