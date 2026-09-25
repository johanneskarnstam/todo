import packageJson from '../package.json'

export const appVersion = packageJson.version

export const formatBuildTime = (dateInput: Date | string | number): string => {
  const date = typeof dateInput === 'object' ? dateInput : new Date(dateInput)
  const day = date.getDate()
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const month = months[date.getMonth()]
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day}${month} ${hours}:${minutes}`
}

declare const __BUILD_TIME__: string | undefined

export const buildTime = typeof __BUILD_TIME__ !== 'undefined'
  ? __BUILD_TIME__
  : new Date().toISOString()

export const formattedBuildTime = formatBuildTime(buildTime)
