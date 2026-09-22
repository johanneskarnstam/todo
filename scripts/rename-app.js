/**
 * App Rename Script
 *
 * Renames the app from its current "boiler" identity to a new name.
 *
 * Usage:
 *   node scripts/rename-app.js <new-name>
 *
 * Examples:
 *   node scripts/rename-app.js my-app
 *   node scripts/rename-app.js "My Awesome App"
 *
 * What it updates:
 *   - package.json            -> "name" field (kebab-cased slug)
 *   - index.html              -> <title> tag
 *   - vite.config.ts          -> PWA manifest name, short_name, description; base path
 *   - src/views/LoginView.vue -> <h1> heading and description paragraph
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import readline from 'readline'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// --- Name derivations --------------------------------------------------------

/** "my awesome app" -> "my-awesome-app"  (safe npm package name / URL segment) */
function toSlug(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** "my-awesome-app" -> "MyAwesomeApp"  (PascalCase, used for PWA short_name) */
function toPascalCase(slug) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
}

/** "my-awesome-app" -> "My Awesome App"  (Title Case, used for display names) */
function toTitleCase(slug) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// --- File helpers -------------------------------------------------------------

function readFile(relPath) {
  const abs = path.join(ROOT, relPath)
  if (!fs.existsSync(abs)) {
    console.warn(`  File not found, skipping: ${relPath}`)
    return null
  }
  return fs.readFileSync(abs, 'utf-8')
}

function writeFile(relPath, content) {
  fs.writeFileSync(path.join(ROOT, relPath), content, 'utf-8')
}

/** Replace the first occurrence of a literal string. Warns if not found. */
function replaceLiteral(content, from, to, description) {
  if (!content.includes(from)) {
    console.warn(`  Could not find "${from}" (${description}) - skipping`)
    return content
  }
  return content.replace(from, to)
}

// --- Individual file updaters -------------------------------------------------

function updatePackageJson(slug) {
  const rel = 'package.json'
  const content = readFile(rel)
  if (!content) return

  const parsed = JSON.parse(content)
  const oldName = parsed.name
  parsed.name = slug
  writeFile(rel, JSON.stringify(parsed, null, 2) + '\n')
  console.log(`  package.json       "name": "${oldName}" -> "${slug}"`)
}

function updateIndexHtml(titleCase) {
  const rel = 'index.html'
  let content = readFile(rel)
  if (!content) return

  content = replaceLiteral(content, 'Vue Firebase Boilerplate', titleCase, '<title> tag')
  writeFile(rel, content)
  console.log(`  index.html         <title> -> "${titleCase}"`)
}

function updateViteConfig(titleCase, pascalCase, slug) {
  const rel = 'vite.config.ts'
  let content = readFile(rel)
  if (!content) return

  content = replaceLiteral(
    content,
    "'Vue Firebase Boilerplate'",
    "'" + titleCase + "'",
    'PWA manifest name',
  )
  content = replaceLiteral(
    content,
    "'VueBoiler'",
    "'" + pascalCase + "'",
    'PWA manifest short_name',
  )
  content = replaceLiteral(
    content,
    "'A minimalist Vue 3 Boilerplate with Firebase Auth'",
    "'" + titleCase + "'",
    'PWA manifest description',
  )
  content = replaceLiteral(content, "base: '/boiler/'", "base: '/" + slug + "/'", 'Vite base path')
  writeFile(rel, content)
  console.log(
    `  vite.config.ts     PWA name -> "${titleCase}", short_name -> "${pascalCase}", base -> "/${slug}/"`,
  )
}

function updateLoginView(titleCase) {
  const rel = 'src/views/LoginView.vue'
  let content = readFile(rel)
  if (!content) return

  content = replaceLiteral(content, 'Boilerplate App', titleCase, '<h1> heading')
  content = replaceLiteral(
    content,
    'This is a minimal boilerplate application using Vue 3 and Firebase Authentication. It\n        contains no complex UI frameworks, just clean CSS and functional structure.',
    `This is ${titleCase}, built with Vue 3 and Firebase Authentication.`,
    'description paragraph',
  )
  writeFile(rel, content)
  console.log(`  LoginView.vue      <h1> -> "${titleCase}"`)
}

// --- Confirmation prompt ------------------------------------------------------

function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase())
    })
  })
}

// --- Main --------------------------------------------------------------------

async function main() {
  const rawName = process.argv[2]

  if (!rawName) {
    console.error('Usage: node scripts/rename-app.js <new-name>')
    console.error('Example: node scripts/rename-app.js my-app')
    process.exit(1)
  }

  const slug = toSlug(rawName)
  const titleCase = toTitleCase(slug)
  const pascalCase = toPascalCase(slug)

  if (!slug) {
    console.error(`"${rawName}" produced an empty slug. Use letters, numbers, or hyphens.`)
    process.exit(1)
  }

  console.log('\nRename plan:')
  console.log(`  Input name  : ${rawName}`)
  console.log(`  Slug        : ${slug}`)
  console.log(`  Title case  : ${titleCase}`)
  console.log(`  Pascal case : ${pascalCase}`)
  console.log('\nFiles to be updated:')
  console.log('  package.json, index.html, vite.config.ts, src/views/LoginView.vue')

  const answer = await confirm('\nProceed? [y/N] ')
  if (answer !== 'y' && answer !== 'yes') {
    console.log('Aborted.')
    process.exit(0)
  }

  console.log('\nApplying changes...')
  updatePackageJson(slug)
  updateIndexHtml(titleCase)
  updateViteConfig(titleCase, pascalCase, slug)
  updateLoginView(titleCase)

  console.log('\nDone! Run `npm install` to update package-lock.json.')
}

main()
