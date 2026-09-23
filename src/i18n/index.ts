import { computed, ref } from 'vue'

export type Locale = 'sv' | 'en'

type TranslationKey =
  | 'appName'
  | 'search'
  | 'myDay'
  | 'important'
  | 'planned'
  | 'tasks'
  | 'settings'
  | 'newFolder'
  | 'newList'
  | 'add'
  | 'addTask'
  | 'withoutFolder'
  | 'moveTo'
  | 'settingsTitle'
  | 'language'
  | 'languageDescription'
  | 'swedish'
  | 'english'
  | 'save'
  | 'close'
  | 'taskDetails'
  | 'steps'
  | 'addStep'
  | 'notes'
  | 'addNote'
  | 'deleteTask'
  | 'addToMyDay'
  | 'removeFromMyDay'
  | 'dueDate'
  | 'completeStep'
  | 'editStep'
  | 'deleteStep'
  | 'confirmDeleteTask'
  | 'deleteTaskDescription'
  | 'cancel'
  | 'confirm'
  | 'logout'
  | 'account'
  | 'user'

const messages: Record<Locale, Record<TranslationKey, string>> = {
  sv: {
    appName: 'Att göra',
    search: 'Sök',
    myDay: 'Min dag',
    important: 'Viktigt',
    planned: 'Planerat',
    tasks: 'Uppgifter',
    settings: 'Inställningar',
    newFolder: 'Ny mapp',
    newList: 'Ny lista',
    add: 'Lägg till',
    addTask: 'Lägg till en uppgift',
    withoutFolder: 'Utan mapp',
    moveTo: 'Flytta till',
    settingsTitle: 'Inställningar',
    language: 'Språk',
    languageDescription: 'Välj språk för appens gränssnitt.',
    swedish: 'Svenska',
    english: 'Engelska',
    save: 'Spara',
    close: 'Stäng',
    taskDetails: 'Uppgiftsdetaljer',
    steps: 'Delsteg',
    addStep: 'Lägg till delsteg',
    notes: 'Anteckningar',
    addNote: 'Lägg till en anteckning',
    deleteTask: 'Ta bort uppgift',
    addToMyDay: 'Lägg till i Min dag',
    removeFromMyDay: 'Ta bort från Min dag',
    dueDate: 'Förfallodatum',
    completeStep: 'Markera delsteg som klart',
    editStep: 'Redigera delsteg',
    deleteStep: 'Ta bort delsteg',
    confirmDeleteTask: 'Ta bort uppgiften?',
    deleteTaskDescription: 'Är du säker på att du vill ta bort den här uppgiften? Den går inte att återställa.',
    cancel: 'Avbryt',
    confirm: 'Ta bort',
    logout: 'Logga ut',
    account: 'Konto',
    user: 'Användare',
  },
  en: {
    appName: 'To Do',
    search: 'Search',
    myDay: 'My day',
    important: 'Important',
    planned: 'Planned',
    tasks: 'Tasks',
    settings: 'Settings',
    newFolder: 'New folder',
    newList: 'New list',
    add: 'Add',
    addTask: 'Add a task',
    withoutFolder: 'Without folder',
    moveTo: 'Move to',
    settingsTitle: 'Settings',
    language: 'Language',
    languageDescription: 'Choose the language for the app interface.',
    swedish: 'Swedish',
    english: 'English',
    save: 'Save',
    close: 'Close',
    taskDetails: 'Task details',
    steps: 'Steps',
    addStep: 'Add step',
    notes: 'Notes',
    addNote: 'Add a note',
    deleteTask: 'Delete task',
    addToMyDay: 'Add to My day',
    removeFromMyDay: 'Remove from My day',
    dueDate: 'Due date',
    completeStep: 'Complete step',
    editStep: 'Edit step',
    deleteStep: 'Delete step',
    confirmDeleteTask: 'Delete task?',
    deleteTaskDescription: 'Are you sure you want to delete this task? This cannot be undone.',
    cancel: 'Cancel',
    confirm: 'Delete',
    logout: 'Log out',
    account: 'Account',
    user: 'User',
  },
}

const storedLocale = typeof localStorage !== 'undefined' ? localStorage.getItem('todo-locale') : null
const locale = ref<Locale>(storedLocale === 'sv' || storedLocale === 'en' ? storedLocale : 'en')

export const useI18n = () => {
  const t = (key: TranslationKey) => messages[locale.value][key]
  const currentLocale = computed(() => locale.value)

  const setLocale = (nextLocale: Locale) => {
    locale.value = nextLocale
    localStorage.setItem('todo-locale', nextLocale)
  }

  return { locale: currentLocale, t, setLocale }
}
