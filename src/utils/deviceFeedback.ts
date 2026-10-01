const isPhysicalMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined' || navigator.maxTouchPoints < 1) return false

  const userAgent = navigator.userAgent
  return /Android|iPhone|iPad|iPod|Windows Phone|Mobile|Tablet/i.test(userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export const vibrateOnTaskCompletion = () => {
  if (!isPhysicalMobileDevice() || typeof navigator.vibrate !== 'function') return
  navigator.vibrate(40)
}
