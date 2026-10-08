# Agent Instructions & Project Context

> **Purpose:** This file defines the architecture, coding standards, Git workflows, and validation rules for all AI coding assistants working on this repository.

## 1. Tech Stack & Project Overview
- **Frontend:** Vue 3 (Composition API), Vite, TypeScript.
- **Styling:** Tailwind CSS (Mobile-first, Dark mode via `dark:` class).
- **State Management:** Pinia.
- **Backend & Database:** Firebase v10+ (Authentication, Firestore NoSQL).
- **Testing:** Vitest for unit tests and Playwright for browser-level E2E tests.
- **Runtime:** Node.js 24 or newer for the app and CI; Firebase Functions deploy with the Node.js 24 runtime.

## 2. Architecture & Structure
Maintain the established directory structure. Do not create new top-level directories without a valid reason.
- `src/components/` - Reusable, "dumb" presentational UI components.
- `src/views/` - Smart page components connected to the router.
- `src/stores/` - Pinia stores for global state and Firebase interaction.
- `src/types/` - Centralized TypeScript definitions (e.g., `src/types/index.ts`).
- `src/composables/` - Reusable Vue logic and Firebase integrations.

## 3. Mandatory Validation Workflow (Non-Negotiable)
Before marking a task as complete or finalizing code changes, you **MUST** run the project's validation scripts (For this project: `npm run type-check && npm run lint`).
- If the validation fails, analyze the errors, fix them, and re-run until it passes 100%.
- Never assume a change is safe without completing this validation.
- `npm run validate` is the complete PR validation: lint, type-check, frontend coverage, Functions unit tests, Playwright E2E/auth-gating and production build. Use it before finalizing changes whenever the environment supports it.
- Use the local `VITE_DEV_AUTH_BYPASS=true` mock-auth mode for the normal E2E suite so validation does not require Firebase credentials. Auth-gating tests without a user belong in a separate deterministic test mode.
- Preserve the coverage gate: Statements 70%, Branches 55%, Functions 65% and Lines 75%. Do not lower thresholds or add exclusions to make a refactor pass without adding or adjusting behavior tests.
- Every new user-facing feature or changed browser workflow must add or update an E2E test when its behavior can be verified through the UI. Unit tests alone are not sufficient for routing, responsive behavior, pointer interaction, or cross-component flows.
- Keep E2E tests deterministic: use stable mock data, explicit starting routes, isolated browser contexts, accessible selectors and no arbitrary sleeps. Wait for URLs, visibility, text or state changes instead of fixed millisecond delays.
- Prefer `getByRole`, `getByLabel` and stable visible text. Use `data-testid` only when a semantic contract is not available; do not use Tailwind classes or DOM position as behavioral selectors.
- Keep Playwright diagnostics enabled on failure: trace on first retry, screenshots on failure and video on failure. CI should use one worker and retain artifacts needed to diagnose a failed test.
- Test optimistic writes at unit level with explicit Firestore rejects and at E2E level with controlled test flags or routes, never random network failures.
- Run Firebase Emulator Suite tests separately from the fast mock-auth PR suite. Emulator tests must use isolated test data and never production credentials, personal accounts or a production database.

## 4. Git Workflow & Commit Rules
Always work on dedicated feature branches for new features or fixes:
1. **Create Branch:** `git checkout -b feature/brief-description`
2. **Develop & Validate:** Write code and run the project's local validation. Feature branches must run the complete CI validation suite, including tests and build, but must not deploy.
3. **Update Version:** Update the version in `package.json` according to SemVer rules *before* committing.
4. **Commit (MUST be in Swedish):**
   - Format: `<type>: <beskrivning på svenska>`
   - Examples: `feat: lägg till ny sidomeny för mappar`, `fix: justera mobilvy för tasks`
   - Execution:
     `git add .`
     `git commit -m "feat: din beskrivning på svenska"`
5. **Push & Verify:** Push the feature branch (`git push -u origin feature/brief-description`) and confirm its full CI validation passes before merging. Feature branch CI runs all validation and tests; deployment is only for `main`.
6. **Merge & Deploy:** Merge the validated feature branch into `main` (preferably through a pull request), then push the updated `main` branch. The `main` deployment workflow runs after the push. Delete the feature branch after the merge.

## 5. Versioning (SemVer)
The version in `package.json` **MUST** be incremented automatically by the AI agent when all tests pass and changes are ready to be committed in the feature branch.
- **MAJOR:** Incompatible API changes (e.g., breaking database schema changes).
- **MINOR:** Backward-compatible new functionality.
- **PATCH:** Backward-compatible bug fixes or minor adjustments (e.g., styling).

## 6. Coding Standards & Design
- **Vue 3 Best Practices:** Always use `<script setup lang="ts">`.
- **TypeScript:** Avoid `any` completely. Use explicit interfaces. Consistently use optional chaining (`?.`) and nullish coalescing (`??`).
- **Offline-first:** The app must support Firestore's local cache and use optimistic UI updates. Database calls must not block the UI with loading spinners.
- **Design Goal:** The layout should visually mimic Microsoft To Do (left sidebar, top bar with search field) and be fully responsive.
- **Maintainability:** Keep views focused on page composition, stores focused on state and persistence, and composables focused on reusable workflows. When a file combines independent responsibilities or becomes difficult to navigate, extract a cohesive module and preserve its public behavior with tests; do not split files solely to meet an arbitrary line limit.
- **Test Relevance:** Each test should protect a distinct user-visible behavior, boundary, or failure mode. Prefer assertions on accessible behavior and state over implementation details; remove or consolidate tests that only duplicate an already-covered contract.
- **Large Test Files:** Group tests by the component or domain they exercise. Split a mixed suite when finding the relevant setup/assertions becomes difficult, keeping shared setup minimal and explicit.

## 7. AI Agent Operating Guidelines
- **Context Awareness:** Read and analyze the existing project structure and nearby files before editing or creating new ones.
- **Tool Discipline:** Use file reading tools to inspect the full file context before making inline modifications.
- **Tone & Style:** Keep all responses direct, concise, technical, and actionable.
- **Node ESLint Environment:** `env.node: true` in ESLint config enables Node globals; it does not select or pin a Node.js runtime. Runtime versions belong in `package.json`, Functions runtime configuration, and CI workflows.