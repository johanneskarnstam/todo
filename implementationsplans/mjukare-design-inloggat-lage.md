# Implementationsplan: Mjukare och Rundare Design i Inloggat Läge

## Bakgrund

Användaren önskar en mjukare och mer rundad design i det inloggade läget, inspirerat av Microsoft To Do men med mindre kantiga element. Login-sidan har redan en mjuk design med `rounded-full`, `rounded-2xl` och `rounded-lg`, men det inloggade läget (sidomeny, header, huvudinnehåll) har för kantiga element.

## Nuvarande Status

### Kantiga element som behöver mjukas upp:

#### 1. **TodoHeader.vue**
- Menyknapp: `rounded-sm` → för kantig
- Tema-växlingsknapp: `rounded-sm` → för kantig
- Header själv: Ingen rundning alls (`bg-[#2564cf]`)
- App-ikonen: `rounded-lg` → kan behålla eller göra rund

#### 2. **TodoSidebar.vue**
- Sidomenyn: Ingen rundning alls
- Knappar och länkar: `rounded` (standard) eller ingen rundning
- Input-fält: `rounded` (standard)
- Profilbild: `rounded-full` ✓ (redan bra)

#### 3. **HomeView.vue**
- Huvudinnehåll: Ingen rundning
- Uppgiftsrader: `rounded` (standard)
- Dialogrutor: `rounded` (standard)

#### 4. **TaskRow.vue**
- Uppgiftskort: `rounded` (standard)
- Checkbox: `rounded` (standard)

#### 5. **TaskDetailsPanel.vue**
- Panelen: `rounded` (standard)
- Knappar: `rounded` (standard)

## Mål

Skapa en enhetlig, mjuk och modern design i det inloggade läget genom att:
1. Öka rundningen på alla interaktiva element
2. Lägga till rundning på container-element
3. Använda konsekventa rundningsstorlekar
4. Bevara den befintliga färgpaletten och funktionaliteten

## Designbeslut

### Rundningshierarki (Tailwind-klasser)

| Element | Nuvarande | Ny | Motivering |
|---------|-----------|----|------------|
| **Containers** (sidomeny, huvudinnehåll, header) | Ingen/rounded | `rounded-xl` eller `rounded-2xl` | Stora ytor behöver mer rundning |
| **Kort** (uppgifter, dialoger, paneler) | `rounded` | `rounded-lg` eller `rounded-xl` | Mjukare utseende |
| **Knappar** | `rounded` eller `rounded-sm` | `rounded-lg` | Mer komfortabel känsla |
| **Input-fält** | `rounded` | `rounded-lg` | Konsistens med knappar |
| **Checkbox/ikoner** | `rounded` | `rounded-full` | Cirklade element |

## Specifika Ändringar

### 1. TodoHeader.vue
- Header: Lägg till `rounded-b-xl` (rundad nederkant)
- Menyknapp: `rounded-sm` → `rounded-lg`
- Tema-knapp: `rounded-sm` → `rounded-lg`
- App-ikon: `rounded-lg` → `rounded-full`

### 2. TodoSidebar.vue
- Sidomeny: Lägg till `rounded-r-xl` (rundad högerkant)
- Sökfält: `rounded` → `rounded-lg`
- Navigeringslänkar: Lägg till `rounded-lg`
- Input-fält: `rounded` → `rounded-lg`
- Knappar: Lägg till `rounded-lg`

### 3. HomeView.vue
- Huvudinnehåll: Lägg till `rounded-t-xl sm:rounded-t-none`
- Uppgiftssektion: `rounded` → `rounded-lg`
- Dialogrutor: `rounded` → `rounded-xl`
- Knappar i dialoger: `rounded` → `rounded-lg`

### 4. TaskRow.vue
- Uppgiftsrad: `rounded` → `rounded-lg`
- Checkbox: `rounded` → `rounded-full`
- Stjärnknapp: `rounded` → `rounded-full`

### 5. TaskDetailsPanel.vue
- Panel: Lägg till `rounded-l-xl`
- Knappar: `rounded` → `rounded-lg`
- Input-fält: `rounded` → `rounded-lg`
- Textarea: `rounded` → `rounded-lg`

## Implementationssteg

### Steg 1: Förberedelse (1 timme)
- [ ] Skapa backup av nuvarande kod
- [ ] Granska alla berörda filer en gång till
- [ ] Testa nuvarande utseende i olika skärmstorlekar

### Steg 2: Header (30 minuter)
- [ ] Uppdatera `TodoHeader.vue`
- [ ] Testa på mobil och desktop

### Steg 3: Sidomeny (1 timme)
- [ ] Uppdatera `TodoSidebar.vue`
- [ ] Testa alla länkar och knappar

### Steg 4: Huvudinnehåll (1 timme)
- [ ] Uppdatera `HomeView.vue`
- [ ] Testa uppgiftslistan och dialoger

### Steg 5: Uppgiftskomponenter (1 timme)
- [ ] Uppdatera `TaskRow.vue`
- [ ] Uppdatera `TaskDetailsPanel.vue`

### Steg 6: Övriga komponenter (30 minuter)
- [ ] Granska och uppdatera `ToastHost.vue` om nödvändigt

### Steg 7: Testning och justering (2 timmar)
- [ ] Testa på mobil (320px - 768px)
- [ ] Testa på tablet (768px - 1024px)
- [ ] Testa på desktop (1024px+)
- [ ] Testa i både ljust och mörkt läge
- [ ] Justera rundningsstorlekar om nödvändigt

### Steg 8: Validering (30 minuter)
- [ ] Kör `npm run type-check`
- [ ] Kör `npm run lint`
- [ ] Fixa eventuella fel

## Förväntat Resultat

Ett enhetligt, mjukt och modernt utseende i det inloggade läget som:
- Har rundade hörn på alla viktiga element
- Bevarar den befintliga färgpaletten
- Behåller all funktionalitet
- Ser bra ut på alla skärmstorlekar
- Matchar den mjuka designen från inloggningssidan

## Risker och Mitigation

1. **Rundningen ser konstig ut på vissa element** → Justera under testningen
2. **Designen blir för "bubblig"** → Använd `rounded-lg` som standard
3. **Inkonsistens mellan ljust och mörkt läge** → Testa noggrant i båda

## Tidsuppskattning

**Total tid:** 6-7 timmar

## Prioritet

Hög prioritet för att förbättra användarupplevelsen.
