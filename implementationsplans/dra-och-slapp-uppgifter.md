# Implementationsplan: Vertikal dra och släpp för manuell sortering av uppgifter inom en lista

## 1. Nulägesanalys

### Datamodell
Fältet `order?: number` finns redan på `Task`-interfacet (src/types/index.ts:35) men används inkonsekvent. Sorteringsfunktionen `sortTasks` (src/stores/taskStore.ts:32-40) fallbackar till `createdAt` om `order` saknas eller är lika.

### Rendering
`HomeView.vue` renderar uppgifter i tre sektioner:

| Sektion | Computed | Template-rad |
|---------|----------|--------------|
| Aktiva | `filteredActiveTasks` | rad 460–476 |
| Slutförda | `filteredCompletedTasks` | rad 478–494 |
| Planerat (grupperat) | `plannedGroups` | rad 439–458 |

Varje uppgift renderas via `TaskRow.vue` som redan har touch-swipe-logik (rad 88–113) – drag-and-drop måste samexistera med denna.

### Persistering
- **Firebase-läge:** `updateTask` (taskStore.ts:326-344) skriver `Partial<Pick<Task, ...>>` till Firestore – men `order` ingår **inte** i den tillåtna update-typen idag.
- **Mock-läge:** `persistMockTasks` (taskStore.ts:68-75) serialiserar hela `tasks`-arrayen till `localStorage`.

### Befintliga tester
E2E-testerna i `e2e/tasks.spec.ts` testar CRUD, smartvyer och ångra-radering. Inget test för ordning.

---

## 2. Scope & Avgränsningar

> **Kärnidé:** Användaren ska kunna dra en uppgift **uppåt eller nedåt** (vertikalt) inom samma lista för att manuellt bestämma ordningen. Inga uppgifter flyttas mellan listor, kolumner eller sektioner.

### I scope
- **Vertikal dra-och-släpp** inom listan med aktiva (ej slutförda) uppgifter i **listvyn** (`TaskView.type === 'list'`).
- Uppgifter dras **enbart uppåt/nedåt** inom sin egen lista för att ändra sorteringsordning.
- Stöd för **mus** (desktop) och **touch** (mobil).
- Tangentbordstillgänglighet (flytta upp/ner med `Alt+↑` / `Alt+↓`).
- `order`-fältet persisteras till Firestore + localStorage (mock).
- E2E-tester för den nya funktionaliteten.

### Explicit utanför scope
- ❌ Dra uppgifter **mellan olika listor** – `listId` ändras aldrig.
- ❌ Dra uppgifter **mellan kolumner eller sektioner** (aktiva ↔ slutförda).
- ❌ Omsortering av slutförda uppgifter.
- ❌ Omsortering i smartvyer (Min dag, Viktigt, Planerat, Tagg) – dessa har egen sorteringslogik.
- ❌ Dra och släpp i sidomenyn (listor/mappar).

---

## 3. Tekniskt val: Implementationsansats

### Alternativ A – HTML5 Drag and Drop API (nativt)
- Inga nya beroenden.
- Kräver manuell hantering av drag-events, ghost-element, drop-target.
- Touch-stöd kräver polyfill (`mobile-drag-drop`) eller egen touch-implementering.

### Alternativ B – `vuedraggable` / `vue.draggable.next` (tredjepartslib)
- Wrapprar SortableJS för Vue 3 – mogen, beprövad.
- Touch-stöd inbyggt via SortableJS.
- Komponent-baserat API, enkel integration med `v-for` och Pinia.
- ~15 kB gzipped.

### Alternativ C – Egen composable med Pointer Events
- Inga beroenden.
- Pointer Events funerar cross-device (mus + touch + penna).
- Full kontroll men mer kod att underhålla.

### ✅ Rekommendation: **Alternativ C – Egen composable med Pointer Events**

Motivering:
1. Projektet har redan en touch-swipe-mekanism i `TaskRow` – en composable ger full kontroll för att separera horisontella swipes (befintlig radering/stjärnmarkering) från vertikala drags (omsortering).
2. Inga extra beroenden, i linje med projektets minimala `dependencies`.
3. Pointer Events API har full webbläsarstöd och hanterar mus, touch och penna enhetligt.
4. Logiken kan kapslas i en `useDragReorder`-composable som är återanvändbar (även för eventuell framtida sidebar-sortering).

---

## 4. Detaljerad implementation

### Fas 1: Datalagret (store & typer)

#### 4.1 `src/types/index.ts` – Inga ändringar behövs
`order?: number` finns redan. Inget nytt fält.

#### 4.2 `src/stores/taskStore.ts` – Ny action `reorderTasks`

Lägg till i update-typen och exponera ny action:

```typescript
// Utöka updateTask-signaturen att inkludera 'order'
const updateTask = async (
  taskId: string,
  updates: Partial<Pick<Task, 'completed' | 'important' | 'myDay' | 'title' | 'dueDate' | 'note' | 'tags' | 'order'>>
    & { reminder?: TaskReminder | null },
) => { /* ... */ }

// Ny action
const reorderTasks = async (listId: string, orderedIds: string[]) => {
  // 1. Bygg ny order-mappning: orderedIds[i] → order = i
  // 2. Optimistiskt: uppdatera tasks i minnet, sortera om
  // 3. Persistera: batch-uppdatera order-fältet i Firestore (eller localStorage i mock-läge)
  // 4. Felhantering: återställ vid misslyckande
}
```

**Persistering i Firebase-läge:**
Använd `writeBatch` från Firestore för att atomärt uppdatera alla `order`-fält i en batch (max 500 dokument per batch – mer än tillräckligt för uppgifter i en lista).

```typescript
import { writeBatch } from 'firebase/firestore'

// Inuti reorderTasks:
const batch = writeBatch(db)
orderedIds.forEach((id, index) => {
  batch.update(doc(userCollection(), id), { order: index })
})
await trackWrite(() => batch.commit())
```

**Persistering i mock-läge:**
Anropa `persistMockTasks(tasks.value)` efter att ha uppdaterat order-fälten i minnet.

#### 4.3 `src/stores/taskStore.ts` – Justera `createTask`
`createTask` sätter redan `order` baserat på `tasks.value.filter(t => t.listId === input.listId).length` (rad 295) – det fungerar korrekt med den nya logiken.

---

### Fas 2: Composable `useDragReorder`

#### 4.4 Ny fil: `src/composables/useDragReorder.ts`

```typescript
// Komposabel som hanterar drag-and-drop-omsortering
// - Tar emot: ref till container-element, lista av items med id
// - Returnerar: drag-state (isDragging, dragIndex, dropIndex), event-handlers
// - Emittar: onReorder(orderedIds: string[])

export function useDragReorder(options: {
  items: Ref<{ id: string }[]>
  onReorder: (orderedIds: string[]) => void
  direction?: 'vertical' | 'horizontal'
})
```

**Nyckellogik:**

1. **`pointerdown` på drag-handle** → spara startposition, markera element som dragged.
2. **`pointermove`** → beräkna delta-Y, flytta elementet visuellt (CSS `transform`), bestäm nytt drop-index baserat på elementhöjder.
3. **`pointerup`** → beräkna slutgiltig position, anropa `onReorder` med ny ordning, städa.
4. **Vertikalt tröskelvärde**: Kräv minst 8px vertikal rörelse innan drag initieras – detta förhindrar att horisontella swipes i `TaskRow` triggar drag.
5. **`touch-action: none`** på drag-handle för att förhindra scroll under drag.

**Visuell feedback:**
- Element som dras: `opacity: 0.5`, `scale(1.03)`, `box-shadow`.
- Drop-target: animerad linje/gap som visar var elementet kommer att hamna.
- Övriga element: animeras smidigt uppåt/neråt med `transition: transform 150ms`.

---

### Fas 3: UI-integration

#### 4.5 `src/components/TaskRow.vue` – Lägg till drag-handle

Lägg till ett synligt drag-handtag (grip-ikon) till vänster om kryssrutan. Visa det **bara** om drag-mode är aktiv (dvs. `TaskView.type === 'list'` och uppgiften inte är slutförd):

```html
<!-- Ny prop -->
<script setup>
  defineProps<{
    // ... befintliga
    draggable?: boolean
  }>()
  defineEmits<{
    // ... befintliga
    (event: 'dragstart'): void
  }>()
</script>

<!-- I template, före kryssrutan -->
<span
  v-if="draggable"
  class="cursor-grab touch-none text-slate-400 hover:text-slate-600"
  aria-hidden="true"
  data-drag-handle
>
  ⠿  <!-- eller GripVertical-ikon från Lucide -->
</span>
```

**Konflikten med befintlig touch-swipe:** Lösning: drag-handle fångar `pointerdown` och sätter `pointer-capture`. Swipe-logiken (rad 88–113) triggas bara om `pointerdown` **inte** är på drag-handtaget.

#### 4.6 `src/views/HomeView.vue` – Integrera composable

```typescript
import { useDragReorder } from '@/composables/useDragReorder'

const taskListContainer = ref<HTMLElement | null>(null)
const canDrag = computed(() => taskStore.activeView?.type === 'list')

const { isDragging } = useDragReorder({
  containerRef: taskListContainer,
  items: filteredActiveTasks,
  onReorder: (orderedIds) => {
    const listId = taskStore.activeView?.type === 'list' ? taskStore.activeView.listId : null
    if (listId) void taskStore.reorderTasks(listId, orderedIds)
  },
  enabled: canDrag,
})
```

Template-ändring – wrappa task-listan i ett `div` med `ref`:

```html
<div ref="taskListContainer" class="overflow-hidden rounded-xl ...">
  <TaskRow
    v-for="task in filteredActiveTasks"
    :key="task.id"
    :task="task"
    :draggable="canDrag"
    ...
  />
</div>
```

---

### Fas 4: Tangentbordstillgänglighet

#### 4.7 Keyboard-reorder i `TaskRow.vue`

Lägg till `Alt+↑` och `Alt+↓` i `handleKeydown`:

```typescript
if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
  event.preventDefault()
  emit('move', event.key === 'ArrowUp' ? -1 : 1)
}
```

Ny emit `move(direction: -1 | 1)` hanteras i `HomeView`:

```typescript
const handleMoveTask = (taskId: string, direction: -1 | 1) => {
  const ids = filteredActiveTasks.value.map(t => t.id)
  const index = ids.indexOf(taskId)
  if (index < 0) return
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= ids.length) return
  ;[ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]]
  const listId = taskStore.activeView?.type === 'list' ? taskStore.activeView.listId : null
  if (listId) void taskStore.reorderTasks(listId, ids)
}
```

**ARIA:** Lägg till `aria-roledescription="Sorterbar uppgift"` och `aria-label` som inkluderar position: `"Uppgift: {title}, position {n} av {total}"` på `TaskRow` när drag är aktiverat.

---

### Fas 5: E2E-tester

#### 4.8 Nytt E2E-test: `e2e/task-reorder.spec.ts`

```typescript
import { expect, test } from '@playwright/test'

test.describe('task drag-and-drop reorder', () => {
  test('reorders tasks with keyboard shortcuts', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Jag har sett detta' }).click()

    // Uppgift "Kontrollera mobilvyn" bör ligga efter "Testa dra och släppa uppgifter"
    const tasks = page.locator('[data-task-id]')
    await expect(tasks.first()).toContainText('Testa dra och släppa uppgifter')
    await expect(tasks.nth(1)).toContainText('Kontrollera mobilvyn')

    // Flytta andra uppgiften uppåt med Alt+↑
    await tasks.nth(1).focus()
    await page.keyboard.press('Alt+ArrowUp')

    // Nu bör ordningen vara omvänd
    await expect(tasks.first()).toContainText('Kontrollera mobilvyn')
    await expect(tasks.nth(1)).toContainText('Testa dra och släppa uppgifter')

    // Ordningen bevaras efter omladdning
    await page.reload()
    await expect(tasks.first()).toContainText('Kontrollera mobilvyn')
  })

  test('shows drag handle on hover in list view', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Jag har sett detta' }).click()

    const firstTask = page.getByRole('group', { name: /Uppgift:/ }).first()
    await firstTask.hover()
    await expect(firstTask.locator('[data-drag-handle]')).toBeVisible()
  })

  test('does not show drag handle in smart views', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Jag har sett detta' }).click()
    await page.getByRole('button', { name: 'Viktigt' }).click()

    const task = page.getByRole('group', { name: /Uppgift:/ }).first()
    await task.hover()
    await expect(task.locator('[data-drag-handle]')).toHaveCount(0)
  })
})
```

---

## 5. Berörda filer – sammanfattning

| Fil | Typ av ändring |
|-----|----------------|
| `src/types/index.ts` | Ingen ändring (order finns) |
| `src/stores/taskStore.ts` | Ny `reorderTasks`-action, utöka `updateTask`-signaturen med `order`, importera `writeBatch` |
| `src/composables/useDragReorder.ts` | **Ny fil** – composable för pointer-baserad drag-and-drop |
| `src/components/TaskRow.vue` | Ny prop `draggable`, ny emit `move`, drag-handle-element, ARIA-attribut, keyboard-stöd |
| `src/views/HomeView.vue` | Integrera `useDragReorder`, container-ref, `handleMoveTask` |
| `e2e/task-reorder.spec.ts` | **Ny fil** – E2E-tester för omsortering |

---

## 6. Leveransordning

### Steg-för-steg:
1. **Fas 1:** `taskStore` – lägg till `reorderTasks`, utöka `updateTask`, importera `writeBatch`.
2. **Fas 2:** Skapa `useDragReorder.ts` composable.
3. **Fas 3:** Uppdatera `TaskRow` med drag-handle, prop, emit. Integrera i `HomeView`.
4. **Fas 4:** Keyboard-stöd (`Alt+↑`/`Alt+↓`) + ARIA.
5. **Fas 5:** E2E-tester + `npm run type-check && npm run lint` + fullständig validering.

---

## 7. Risker & överväganden

| Risk | Mitigering |
|------|-----------|
| Touch-swipe-konflikt med drag | Separera via drag-handle – bara handle initierar drag, resten av raden behåller swipe |
| Firestore batch-skrivningar vid varje drag | Debounce `reorderTasks` (300 ms) – samla flera snabba omplaceringar till en batch |
| Stora listor (100+ uppgifter) | Pointer Events + CSS transform är snabba; inga DOM-manipulationer under drag |
| Order-gap efter radering av uppgifter | Normalisera order vid fetch (ej strikt nödvändigt – `sortTasks` hanterar redan gaps) |

---

## 8. Versionering

Denna feature är bakåtkompatibel (befintliga uppgifter utan `order` fungerar via fallback i `sortTasks`). Inkrementera **MINOR**: `0.14.0` → `0.15.0`.
