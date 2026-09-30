const pendingKey = (userId: string) => `todo-feature-overview-pending:${userId}`

export const markFeatureOverviewPending = (userId: string) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(pendingKey(userId), 'true')
}

export const hasPendingFeatureOverview = (userId: string) =>
  typeof localStorage !== 'undefined' && localStorage.getItem(pendingKey(userId)) === 'true'

export const markFeatureOverviewComplete = (userId: string) => {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(pendingKey(userId))
}