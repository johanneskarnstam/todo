# Holistisk Teststrategi för To Do

## Inledning

Detta dokument sammanfattar och integrerar teststrategin för To Do-applikationen, baserat på [E2E-teststrategi](./e2e-teststrategi.md) och [kompletterande teststrategi](./teststrategi-komplettering.md). Syftet är att skapa ett enhetligt, holistiskt testskydd som täcker alla kritiska aspekter av applikationen.

## Översikt

Teststrategin bygger på tre huvudsakliga testnivåer:

1. **Unit- och komponenttester** (Vitest) - För ren logik, Pinia-state och komponentkontrakt
2. **E2E-tester** (Playwright) - För routing, riktig DOM, viewport, pointer-events och användarflöden
3. **Integrationstester** (Firebase Emulator Suite) - För riktig auth och Firestore-regler

### Nuvarande status

- **6 Vitest-filer** med 56 godkända unit-/komponenttester
- **4 Playwright-filer** med 19 godkända E2E-tester
- **Coverage-gate** införd med globala minimikrav:
  - Statements: 70%
  - Branches: 55%
  - Functions: 65%
  - Lines: 75%
- **Senaste baslinje** (efter P0/P1):
  - Statements: 77,47%
  - Branches: 66,78%
  - Functions: 74,10%
  - Lines: 82,51%

---

## Vad som testas