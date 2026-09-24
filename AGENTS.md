# Agent Instructions & Project Context

> **Purpose:** This file defines the architecture, coding standards, Git workflows, and validation rules for all AI coding assistants working on this repository.

## 1. Tech Stack & Project Overview
- **Frontend:** Vue 3 (Composition API), Vite, TypeScript.
- **Styling:** Tailwind CSS (Mobile-first, Dark mode via `dark:` class).
- **State Management:** Pinia.
- **Backend & Database:** Firebase v10+ (Authentication, Firestore NoSQL).
- **Testing:** Vitest for unit tests and Playwright for browser-level E2E tests.

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
- `npm run validate` also runs the Playwright E2E suite. Use the local mock-auth mode so validation does not require Firebase credentials.
- Every new user-facing feature or changed browser workflow must add or update an E2E test when its behavior can be verified through the UI. Unit tests alone are not sufficient for routing, responsive behavior, pointer interaction, or cross-component flows.
- Keep E2E tests deterministic: use stable mock data, accessible selectors, isolated browser contexts, and no arbitrary sleeps.

## 4. Git Workflow & Commit Rules
Always work on dedicated feature branches for new features or fixes:
1. **Create Branch:** `git checkout -b feature/brief-description`
2. **Develop & Validate:** Write code and ensure the validation passes 100%.
3. **Update Version:** Update the version in `package.json` according to SemVer rules *before* committing.
4. **Commit (MUST be in Swedish):**
   - Format: `<type>: <beskrivning på svenska>`
   - Examples: `feat: lägg till ny sidomeny för mappar`, `fix: justera mobilvy för tasks`
   - Execution:
     `git add .`
     `git commit -m "feat: din beskrivning på svenska"`
5. **Merge:** Switch to main (`git checkout main`), merge the branch (`git merge feature/...`), and then delete the feature branch.

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

## 7. AI Agent Operating Guidelines
- **Context Awareness:** Read and analyze the existing project structure and nearby files before editing or creating new ones.
- **Tool Discipline:** Use file reading tools to inspect the full file context before making inline modifications.
- **Tone & Style:** Keep all responses direct, concise, technical, and actionable.