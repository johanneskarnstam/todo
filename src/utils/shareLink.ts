export const copyRouteLink = async (routeHref: string): Promise<boolean> => {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false

  try {
    await navigator.clipboard.writeText(new URL(routeHref, window.location.href).href)
    return true
  } catch {
    return false
  }
}
