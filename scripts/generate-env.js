/**
 * Environment Variable Generator
 *
 * Reads the 'firebaseConfig' object from scripts/pasted_secret_config.js
 * (you can paste the config you copied from Firebase console) and then
 * generates or updates a .env file in the project root. The helper auto-
 * prefixes variable names based on the framework detected in package.json.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 1. Try to load the user's pasted config from the helper file
const configPath = path.resolve(__dirname, 'pasted_secret_config.js')
let firebaseConfig = null

try {
  // Read the raw file
  const rawContent = fs.readFileSync(configPath, 'utf8')

  // Extract just the object part using an evaluator or regex
  // since the file might just contain `const firebaseConfig = { ... }` natively pasted.
  const match = rawContent.match(/{[\s\S]*?}/)
  if (match) {
    // A bit hacky but safe since it's a local dev script
    firebaseConfig = new Function('return ' + match[0])()
  }
} catch (_err) {
  console.error(
    `❌ Could not read or parse ${configPath}. Please ensure it contains your javascript const.`,
  )
  process.exit(1)
}

if (!firebaseConfig || !firebaseConfig.apiKey) {
  console.error(`❌ Failed to extract a valid firebaseConfig object from ${configPath}.`)
  process.exit(1)
}

// 2. Auto-detect framework
function getEnvPrefix() {
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json')
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }

      if (deps['vite']) return 'VITE_'
      if (deps['next']) return 'NEXT_PUBLIC_'
      if (deps['react-scripts']) return 'REACT_APP_'
      if (deps['nuxt']) return 'NUXT_PUBLIC_'
      if (deps['gatsby']) return 'GATSBY_'
      if (deps['@vue/cli-service']) return 'VUE_APP_'
      if (deps['svelte']) return 'VITE_'
    }
  } catch (_error) {
    // Ignore error
  }
  return ''
}

function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()
}

// 3. Update the .env file
const prefix = getEnvPrefix()
const envPath = path.resolve(process.cwd(), '.env')

let envContent = ''
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf-8')
}

const generatedVars = []

for (const [key, value] of Object.entries(firebaseConfig)) {
  const snakeKey = toSnakeCase(key)
  const envKey = `${prefix}FIREBASE_${snakeKey}`

  // Match the key and everything after it until a line break
  const regex = new RegExp(`^${envKey}=.*`, 'm')
  if (regex.test(envContent)) {
    // Replace the matched line with the new key=value
    envContent = envContent.replace(regex, `${envKey}=${value}`)
  } else {
    const newline = envContent.endsWith('\n') || envContent === '' ? '' : '\n'
    envContent += `${newline}${envKey}=${value}`
  }
  generatedVars.push({ key: envKey, value })
}

fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8')

console.log(`\n✅ Read config from scripts/pasted_secret_config.js and updated .env!\n`)
generatedVars.forEach((v) => console.log(`   - ${v.key}`))
console.log(
  `\n⚠️ Make sure scripts/pasted_secret_config.js is in your .gitignore so your secrets remain hidden.\n`,
)
