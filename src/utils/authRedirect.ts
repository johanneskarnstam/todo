export const safeRedirectPath = (target: unknown): string => {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) return '/'
  return target
}
