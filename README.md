# .

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) 
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

## Quick Start

1. **Set up your Firebase configuration:**
   - Copy the `firebaseConfig` object from your Firebase console.
   - Paste it into `scripts/pasted_secret_config.js`.
   - Run `npm run generate-env` to create/update your `.env` file.

2. **Start the development server:**
   ```sh
   npm run dev
   ```

@todo: implement next step https://medium.com/@guilhermehenrique_23468/streamlining-github-secrets-management-with-a-bash-script-8b757a047e0e
### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
<br />
<br />


### Adding your Firebase configuration

Rather than typing the variables by hand, you can simply copy the `firebaseConfig`
object from the Firebase console (usually the snippet that starts with
`const firebaseConfig = {...}`) and paste it into
`scripts/pasted_secret_config.js` in the root of this project. The file is
already ignored by Git so your secrets won't be committed.

Once pasted, run the helper script to generate a `.env` file with the
correct keys:

```sh
npm run generate-env      # or node scripts/generate-env.js
```

The script will detect your framework (Vite, Next, CRA, etc.) and prefix the
variables appropriately. It will update an existing `.env` or create one if
needed.

After running it you should see output like:

```
✅ Read config from scripts/pasted_secret_config.js and updated .env!
   - VITE_FIREBASE_API_KEY
   - VITE_FIREBASE_AUTH_DOMAIN
   - …
```

The resulting `.env` will contain the values you need, e.g.:  
```sh
VITE_FIREBASE_API_KEY=AAA-BBB
VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-app
…
```

You can now start the dev server as usual (`npm run dev`).

---

### Add a .env file with this content
```sh
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```


### Rename app

```sh
npm run rename -- "My Cool App"
```
