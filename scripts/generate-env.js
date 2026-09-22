/**
 * Environment Variable Generator & GitHub Secrets Sync
 *
 * Reads the 'firebaseConfig' object from scripts/pasted_secret_config.js
 * (you can paste the config you copied from Firebase console), then
 * generates or updates a .env file in the project root, and automatically
 * pushes those environment variables as GitHub Secrets using GitHub CLI (`gh`).
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 1. Try to load the user's pasted config from the helper file
const configPath = path.resolve(__dirname, 'pasted_secret_config.js')
let firebaseConfig = null

try {
  // Read the raw file
  const rawContent = fs.readFileSync(configPath, 'utf8')

  // Extract just the object part using an evaluator
  const match = rawContent.match(/{[\s\S]*?}/)
  if (match) {
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
  const stringVal = String(value)

  // Match the key and everything after it until a line break
  const regex = new RegExp(`^${envKey}=.*`, 'm')
  if (regex.test(envContent)) {
    // Replace the matched line with the new key=value
    envContent = envContent.replace(regex, `${envKey}=${stringVal}`)
  } else {
    const newline = envContent.endsWith('\n') || envContent === '' ? '' : '\n'
    envContent += `${newline}${envKey}=${stringVal}`
  }
  generatedVars.push({ key: envKey, value: stringVal })
}

fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8')

console.log(`\n✅ Read config from scripts/pasted_secret_config.js and updated .env!\n`)
generatedVars.forEach((v) => console.log(`   - ${v.key}`))

// 4. GitHub Secrets Integration Helpers
function isGhCliInstalled() {
  const check = spawnSync('gh', ['--version'])
  return check.status === 0
}

function isGhAuthenticated() {
  const check = spawnSync('gh', ['auth', 'status'])
  return check.status === 0
}

function syncToGitHubSecrets(vars) {
  console.log('\n🚀 Syncing variables to GitHub Secrets...')

  if (!isGhCliInstalled()) {
    console.warn(
      '⚠️  GitHub CLI (`gh`) is not installed. Local .env updated, but secrets were NOT pushed to GitHub.\n' +
      '   Install gh CLI from https://cli.github.com/ and run `gh auth login` to enable GitHub sync.'
    )
    return
  }

  if (!isGhAuthenticated()) {
    console.warn(
      '⚠️  You are not logged in to GitHub CLI. Please run `gh auth login` in your terminal and try again.'
    )
    return
  }

  let syncedCount = 0
  for (const { key, value } of vars) {
    // Pass key and value securely using spawnSync args to avoid shell escaping issues
    const result = spawnSync('gh', ['secret', 'set', key, '-b', value])

    if (result.status === 0) {
      console.log(`   🔒 GitHub Secret updated: ${key}`)
      syncedCount++
    } else {
      const errorMsg = result.stderr ? result.stderr.toString().trim() : 'Unknown error'
      console.error(`   ❌ Failed to set GitHub Secret ${key}: ${errorMsg}`)
    }
  }

  console.log(`\n🎉 Successfully pushed ${syncedCount}/${vars.length} secrets to GitHub Repository!`)
}

// Execute GitHub Sync
syncToGitHubSecrets(generatedVars)

console.log(
  `\n⚠️ Make sure scripts/pasted_secret_config.js is in your .gitignore so your secrets remain hidden.\n`,
)
