# Implementationsplan: Automatisk beroendeuppdatering med Renovate Bot

## Mål och syfte

Automatisera uppdateringar av npm-beroenden i projektet för både frontend (Vue 3 / Vite) och backend (`functions/`) med hjälp av **Renovate Bot**. Målet är att:
1. Hålla alla bibliotek uppdaterade, säkra och stabila utan manuellt letande efter nya versioner.
2. Minimera PR-brus genom intelligent gruppering (t.ex. samla alla devDependencies, Vue-paket eller testverktyg i enstaka PR:ar).
3. Skydda projektet mot trasiga releaser genom karantän/stabilitetsdagar ("stability days").
4. Integrera med projektets CI-validering (`npm run validate`) och eventuellt möjliggöra automerge för säkra patch-uppdateringar.
5. Få en tydlig översikt i GitHub via Renovates *Dependency Dashboard*.

---

## Bakgrund & jämförelse med befintlig Dependabot

Projektet har i dagsläget en grundläggande `.github/dependabot.yml`. Dependabot har dock begränsningar jämfört med Renovate:
- **Gruppering:** Renovate har mycket kraftfullare regler för att gruppera paket (t.ex. monorepos, delade ekosystem som Vue/Vite/Vitest) och kan hantera rotkatalog och `functions/` i samma PR om önskat.
- **Automerge:** Renovate stödjer inbyggd automerge (via GitHub squash/merge eller rebase) när CI har passerat med grönt ljus.
- **Stabilitetsdagar:** Renovate kan vänta t.ex. 3–5 dagar efter att ett npm-paket publicerats innan det skapar en PR, vilket minskar risken för trasiga "zero-day"-släpp eller kapade npm-paket.
- **Dashboard:** Ger ett interaktivt GitHub Issue där man kan se väntande uppdateringar och manuellt trigga omskapande av PR:ar med en enkel checkbox.

---

## Rekommenderad arkitektur & konfiguration

### 1. Installationsmodell
- **Renovate GitHub App (Mend Renovate):** Installeras kostnadsfritt på GitHub-organisationen eller användarens konto och ges åtkomst till repositoryt `johanneskarnstam/todo`.
- Den körs helt utan egen driftserver och hanteras via GitHub webhooks.

### 2. Konfigurationsfil: `renovate.json`
Placeras i projektets rotkatalog. Följande principer tillämpas:
- **Paket-ekosystem:** npm (`package.json` i roten och `functions/package.json`).
- **Tidsschema (Schedule):** Kör uppdateringar utanför kontorstid (t.ex. måndagar före kl. 07:00 svensk tid) så att utveckling under dagen inte störs av konstanta PR-notiser.
- **Stabilitetsdagar:** 3 dagars fördröjning för produktions- och dev-beroenden.
- **Commit-meddelanden:** Anpassade efter projektets format (t.ex. `chore(deps): <beskrivning>`).
- **Grupperingar:**
  - *Vue & Tooling:* `vue`, `vue-router`, `pinia`, `@vitejs/plugin-vue`, `vite`.
  - *Testing:* `vitest`, `@vitest/*`, `@playwright/test`, `@vue/test-utils`.
  - *Lint & Format:* `eslint`, `prettier`, `@vue/eslint*`, `@vitest/eslint-plugin`.
  - *Tailwind & CSS:* `tailwindcss`, `@tailwindcss/*`, `postcss`, `autoprefixer`.
  - *Firebase:* `firebase`, `firebase-admin`, `firebase-functions`, `@firebase/*`.
  - *Minor & Patch samling:* Icke-brytande devDependencies kan grupperas till månatliga eller veckovisa samlingar.
- **Major versions:** Skapas alltid som separata PR:ar och kräver manuell granskning/godkännande.

---

## Avbockningsbar genomförandeplan

### Fas 1: Förberedelser & GitHub-installation
- [x] 1.1 Gå till [GitHub Marketplace: Renovate](https://github.com/marketplace/renovate) eller [Renovate App](https://github.com/apps/renovate).
- [x] 1.2 Klicka på **Install** / **Configure** och välj repositoryt `johanneskarnstam/todo`.
- [x] 1.3 Säkerställ att appen har rättigheter att skapa pull requests och issues (för Dependency Dashboard).
- [x] 1.4 Kontrollera i GitHub Repository Settings -> Actions -> General -> Workflow permissions:
  - Välj **Read and write permissions**.
  - Bocka i **Allow GitHub Actions to create and approve pull requests** (nödvändigt om automerge via Actions används).

### Fas 2: Skapa Renovate-konfiguration i projektet
- [x] 2.1 Skapa en dedikerad feature-branch enligt projektets regler: `git checkout -b feature/setup-renovate`.
- [x] 2.2 Skapa konfigurationsfilen `renovate.json` i projektroten (se förslag nedan).
- [x] 2.3 Konfigurera `packageRules` för Vue, Vite, Vitest, Playwright, Tailwind och Firebase.
- [x] 2.4 Konfigurera stöd för både roten (`package.json`) och Firebase Cloud Functions (`functions/package.json`).
- [x] 2.5 Konfigurera `rangeStrategy: "bump"` eller `"pin"` enligt projektets önskemål för `package.json`.
- [x] 2.6 Lägg till svensk eller konventionell commit-prefix (`chore(deps): ...`).

### Fas 3: Anpassning av CI/CD & GitHub Actions
- [x] 3.1 Granska `.github/workflows/deploy.yml` och säkerställ att workflow triggas på Renovate PR:ar (t.ex. `pull_request: branches: ['main']` körs när Renovate öppnar PR mot `main`).
- [x] 3.2 Kontrollera att `npm run validate` körs och rapporterar statuschecks som Renovate kan lyssna på.
- [ ] 3.3 (Valfritt) Konfigurera automerge för patch-uppdateringar av devDependencies om alla CI-steg är gröna:
  - Sätt `"automerge": true` och `"automergeType": "pr"` för specifika säkra paketregler.
  - Aktivera GitHub Auto-merge i repository-inställningarna om plattformsbaserad automerge ska nyttjas.

### Fas 4: Hantering av befintlig Dependabot
- [x] 4.1 Utvärdera överlappningen med `.github/dependabot.yml`.
- [x] 4.2 Inaktivera `npm`-uppdateringar i `.github/dependabot.yml` för att förhindra dubbla PR:ar för samma paket.
- [x] 4.3 (Valfritt) Ta bort `.github/dependabot.yml` då Renovate ersätter all npm-beroendehantering.

### Fas 5: Onboarding PR & Verifiering
- [ ] 5.1 När Renovate App har installerats skapar Renovate en "Configure Renovate"-onboarding-PR.
- [ ] 5.2 Granska onboarding-PR:n och jämför den med projektets skapade `renovate.json`.
- [ ] 5.3 Slå ihop onboarding-PR:n eller merga din egen branch som inkluderar `renovate.json`.
- [ ] 5.4 Kontrollera att Renovate öppnar "Dependency Dashboard" under GitHub Issues.
- [ ] 5.5 Granska den första genererade uppdaterings-PR:n från Renovate.
- [ ] 5.6 Verifiera att GitHub Actions CI (`validate`) startar automatiskt och går igenom utan fel.

### Fas 6: Versionshantering & Slutförande
- [x] 6.1 Uppdatera versionsnumret i `package.json` (SemVer patch/minor) enligt projektreglerna.
- [x] 6.2 Kör lokal validering: `npm run validate`.
- [ ] 6.3 Committa på svenska: `git commit -m "feat: konfigurera renovate för automatisk beroendehantering"`.
- [ ] 6.4 Pusha feature-branchen och skapa pull request till `main`.
- [ ] 6.5 Efter godkänd CI: merga till `main`.

---

## Konfigurationsförslag (`renovate.json`)

Här är en rekommenderad grundkonfiguration anpassad för detta projekt:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    ":dependencyDashboard"
  ],
  "timezone": "Europe/Stockholm",
  "schedule": ["before 7am on monday"],
  "minimumReleaseAge": "3 days",
  "prConcurrentLimit": 5,
  "prHourlyLimit": 2,
  "labels": ["dependencies", "automated"],
  "commitMessagePrefix": "chore(deps):",
  "commitMessageAction": "uppdatera",
  "packageRules": [
    {
      "description": "Gruppera alla Vue-relaterade paket",
      "groupName": "vue-ekosystem",
      "matchPackageNames": ["vue", "vue-router", "pinia", "@vitejs/plugin-vue", "@vue/*"]
    },
    {
      "description": "Gruppera testramverk",
      "groupName": "test-verktyg",
      "matchPackageNames": ["vitest", "@vitest/*", "@playwright/test", "@vue/test-utils"]
    },
    {
      "description": "Gruppera linter och formatering",
      "groupName": "kodkvalitet-och-lint",
      "matchPackageNames": ["eslint", "eslint-plugin-vue", "@vue/eslint-config-*", "prettier", "@vue/tsconfig"]
    },
    {
      "description": "Gruppera Tailwind och CSS-verktyg",
      "groupName": "styling-och-css",
      "matchPackageNames": ["tailwindcss", "@tailwindcss/*", "postcss", "autoprefixer"]
    },
    {
      "description": "Gruppera Firebase SDK",
      "groupName": "firebase-sdk",
      "matchPackageNames": ["firebase", "@firebase/*", "firebase-admin", "firebase-functions"]
    },
    {
      "description": "Separera alla major-uppdateringar så att de granskas manuellt",
      "matchUpdateTypes": ["major"],
      "groupName": null,
      "automerge": false
    },
    {
      "description": "Gruppera icke-kritiska dev-dependencies för minor och patch",
      "matchDepTypes": ["devDependencies"],
      "matchUpdateTypes": ["minor", "patch"],
      "groupName": "alla dev-beroenden (non-major)"
    }
  ],
  "npm": {
    "fileFilters": ["**/package.json"]
  }
}
```

---

## Risker och hantering

| Risk | Sannolikhet | Konsekvens | Hantering |
| :--- | :--- | :--- | :--- |
| **Trasiga npm-paket direkt vid release** | Medel | Hög | Använd `minimumReleaseAge: "3 days"` så att problematiska releaser hinner dras tillbaka innan Renovate föreslår dem. |
| **PR-storm som överväldigar inkorgen** | Hög | Medel | Använd `groupName` för att samla paket, samt begränsa antal öppna PR:ar med `prConcurrentLimit: 5` och `schedule`. |
| **Breaking changes vid major-uppdateringar** | Låg | Hög | Major-uppdateringar grupperas aldrig ihop och har alltid `automerge: false`. |
| **Krockar mellan Dependabot och Renovate** | Medel | Låg | Inaktivera npm-sektionen i `.github/dependabot.yml` när Renovate har driftsatts. |
| **CI-resurser förbrukas i onödan** | Låg | Låg | Begränsat schema (måndagsmorgnar) och `prHourlyLimit: 2` förhindrar att många GitHub Actions-jobb startar samtidigt. |

---

## Klart när

- [ ] `renovate.json` är skapad och committad i repot.
- [ ] Renovate GitHub App är installerad och har tillgång till `johanneskarnstam/todo`.
- [ ] Dependency Dashboard är synlig och aktiv under GitHub Issues.
- [ ] Renovate skapar grupperade PR:ar enligt uppsatta `packageRules`.
- [ ] GitHub Actions kör full validering (`npm run validate`) på Renovate-PR:ar.
- [ ] Överlappande konfiguration i `dependabot.yml` har städats upp.
