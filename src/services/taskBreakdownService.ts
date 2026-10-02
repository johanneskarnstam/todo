import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai'

export const TASK_BREAKDOWN_MODEL_OPTIONS = [
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite' },
] as const

export const DEFAULT_TASK_BREAKDOWN_MODEL_ID = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.8-flash'
export const TASK_BREAKDOWN_FALLBACK_MODEL_ID = 'gemini-2.5-flash'
export const TASK_BREAKDOWN_MODEL_STORAGE_KEY = 'todo-gemini-selected-model'
export const TASK_BREAKDOWN_MODELS_CACHE_KEY = 'todo-gemini-models-cache'

export const TASK_BREAKDOWN_MODEL_IDS = [
  DEFAULT_TASK_BREAKDOWN_MODEL_ID,
  ...TASK_BREAKDOWN_MODEL_OPTIONS.map((model) => model.id),
] as const

export type TaskBreakdownModelId = string

export interface TaskBreakdownModelOption {
  id: TaskBreakdownModelId
  name: string
  description?: string
  performanceIndex?: number
}

export type TaskBreakdownErrorKind =
  | 'invalid-input'
  | 'overloaded'
  | 'quota'
  | 'network'
  | 'configuration'
  | 'invalid-response'
  | 'unknown'

export interface TaskBreakdownInput {
  title: string
  note?: string
  additionalPrompt?: string
  modelId?: TaskBreakdownModelId
}

export interface TaskBreakdownResult {
  modelId: TaskBreakdownModelId
  steps: string[]
}

export class TaskBreakdownError extends Error {
  constructor(
    readonly kind: TaskBreakdownErrorKind,
    message: string,
  ) {
    super(message)
    this.name = 'TaskBreakdownError'
  }
}

const MAX_TITLE_LENGTH = 200
const MAX_NOTE_LENGTH = 4000
const MAX_ADDITIONAL_PROMPT_LENGTH = 1000
const MAX_STEP_COUNT = 20
const MAX_STEP_TITLE_LENGTH = 180
const MAX_OUTPUT_TOKENS = 4096

const MODEL_CACHE_TTL = 24 * 60 * 60 * 1000
const FALLBACK_MODELS: TaskBreakdownModelOption[] = [
  { id: DEFAULT_TASK_BREAKDOWN_MODEL_ID, name: `${DEFAULT_TASK_BREAKDOWN_MODEL_ID} (standard)` },
  ...TASK_BREAKDOWN_MODEL_OPTIONS,
]
const EXCLUDED_MODEL_KEYWORDS = [
  'embedding', 'aqa', 'image', 'banana', 'imagen', 'tts', 'audio', 'transcribe',
  'robotics', 'computer-use', 'customtools', 'vision',
]
const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    steps: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
  },
  required: ['steps'],
}

const getGeminiApiKey = () =>
  import.meta.env.VITE_GEMINI_KEY?.trim() || import.meta.env.VITE_GEMINI_API_KEY?.trim() || ''

const isValidModelId = (modelId: string): boolean => /^gemini-[a-z0-9.-]+$/i.test(modelId)

export const getSelectedTaskBreakdownModelId = (): TaskBreakdownModelId => {
  try {
    const saved = localStorage.getItem(TASK_BREAKDOWN_MODEL_STORAGE_KEY)?.trim()
    if (saved && isValidModelId(saved)) return saved
  } catch {
    // Use the configured default when browser storage is unavailable.
  }
  return DEFAULT_TASK_BREAKDOWN_MODEL_ID
}

export const setSelectedTaskBreakdownModelId = (modelId: TaskBreakdownModelId): void => {
  if (!isValidModelId(modelId)) return
  try {
    localStorage.setItem(TASK_BREAKDOWN_MODEL_STORAGE_KEY, modelId)
  } catch {
    // Model selection remains usable for the current session.
  }
}

const scoreModel = (modelId: string): number => {
  const version = modelId.match(/(\d+)(?:\.(\d+))?/)?.slice(1)
  const versionScore = version ? Number(version[0]) * 1000 + Number(version[1] ?? 0) * 100 : 0
  const tierScore = modelId.includes('flash') ? 90 : modelId.includes('pro') ? 85 : 0
  return versionScore + tierScore - (modelId.includes('preview') ? 15 : 0)
}

interface CachedModelOptions {
  timestamp: number
  models: TaskBreakdownModelOption[]
}

const readCachedModels = (): TaskBreakdownModelOption[] | null => {
  try {
    const cached = JSON.parse(localStorage.getItem(TASK_BREAKDOWN_MODELS_CACHE_KEY) ?? 'null') as Partial<CachedModelOptions> | null
    if (!cached || typeof cached.timestamp !== 'number' || !Array.isArray(cached.models)) return null
    if (Date.now() - cached.timestamp >= MODEL_CACHE_TTL) return null
    const models = cached.models.filter((model): model is TaskBreakdownModelOption =>
      typeof model?.id === 'string' && isValidModelId(model.id) && typeof model.name === 'string',
    )
    return models.length ? models : null
  } catch {
    return null
  }
}

export const fetchAvailableTaskBreakdownModels = async (forceRefresh = false): Promise<TaskBreakdownModelOption[]> => {
  if (!forceRefresh) {
    const cached = readCachedModels()
    if (cached) return cached
  }

  const apiKey = getGeminiApiKey()
  if (!apiKey) return FALLBACK_MODELS

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    )
    if (!response.ok) return FALLBACK_MODELS

    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object' || !('models' in payload) || !Array.isArray(payload.models)) {
      return FALLBACK_MODELS
    }

    const models = payload.models
      .filter((model): model is { name: string; displayName?: string; supportedGenerationMethods?: string[] } =>
        typeof model === 'object' && model !== null &&
        'name' in model && typeof model.name === 'string' &&
        'supportedGenerationMethods' in model && Array.isArray(model.supportedGenerationMethods) &&
        model.supportedGenerationMethods.includes('generateContent'),
      )
      .map((model) => {
        const id = model.name.replace(/^models\//, '')
        const displayName = typeof model.displayName === 'string' ? model.displayName : id
        return { id, name: displayName }
      })
      .filter((model) =>
        isValidModelId(model.id) &&
        !EXCLUDED_MODEL_KEYWORDS.some((keyword) => `${model.id} ${model.name}`.toLowerCase().includes(keyword)),
      )
      .sort((first, second) => scoreModel(second.id) - scoreModel(first.id))

    if (!models.length) return FALLBACK_MODELS
    try {
      localStorage.setItem(TASK_BREAKDOWN_MODELS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), models }))
    } catch {
      // The fetched list is still available for this session.
    }
    return models
  } catch {
    return FALLBACK_MODELS
  }
}

const systemInstruction = [
  'Du hjälper till att bryta ner en uppgift i små, konkreta och handlingsbara delsteg.',
  'Svara alltid på svenska och följ den efterfrågade JSON-strukturen.',
  'Använd titel, anteckning och extra instruktion som kontext för uppgiften.',
  'Föreslå endast delsteg som behövs för att slutföra uppgiften, i logisk ordning.',
  'Hitta inte på begränsningar eller detaljer som saknar stöd i kontexten.',
].join(' ')

const normalizeInput = (input: TaskBreakdownInput) => {
  const title = input.title.trim()
  const note = input.note?.trim() ?? ''
  const additionalPrompt = input.additionalPrompt?.trim() ?? ''
  const modelId = input.modelId ?? getSelectedTaskBreakdownModelId()

  if (!title) {
    throw new TaskBreakdownError('invalid-input', 'Skriv en uppgiftstitel innan du ber AI om delsteg.')
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new TaskBreakdownError('invalid-input', `Uppgiftstiteln får vara högst ${MAX_TITLE_LENGTH} tecken.`)
  }
  if (note.length > MAX_NOTE_LENGTH) {
    throw new TaskBreakdownError('invalid-input', `Anteckningen får vara högst ${MAX_NOTE_LENGTH} tecken.`)
  }
  if (additionalPrompt.length > MAX_ADDITIONAL_PROMPT_LENGTH) {
    throw new TaskBreakdownError('invalid-input', `Extratexten får vara högst ${MAX_ADDITIONAL_PROMPT_LENGTH} tecken.`)
  }
  if (!isValidModelId(modelId)) {
    throw new TaskBreakdownError('invalid-input', 'Den valda AI-modellen är inte tillgänglig.')
  }
  return { title, note, additionalPrompt, modelId }
}

const buildPrompt = (input: ReturnType<typeof normalizeInput>) => [
  `UPPGIFTSTITEL:\n${input.title}`,
  input.note ? `ANTECKNING:\n${input.note}` : '',
  input.additionalPrompt ? `EXTRA INSTRUKTION:\n${input.additionalPrompt}` : '',
  `Föreslå högst ${MAX_STEP_COUNT} delsteg. Varje delsteg ska vara en kort åtgärd och högst ${MAX_STEP_TITLE_LENGTH} tecken.`,
].filter(Boolean).join('\n\n')

const parseSteps = (responseText: string): string[] => {
  let parsed: unknown
  try {
    parsed = JSON.parse(responseText)
  } catch {
    throw new TaskBreakdownError('invalid-response', 'AI:n returnerade ett svar som inte gick att läsa. Försök generera nya förslag.')
  }

  if (!parsed || typeof parsed !== 'object' || !('steps' in parsed) || !Array.isArray(parsed.steps)) {
    throw new TaskBreakdownError('invalid-response', 'AI:n returnerade ett svar utan delsteg. Försök generera nya förslag.')
  }

  if (parsed.steps.length > MAX_STEP_COUNT || parsed.steps.some((step) => typeof step !== 'string')) {
    throw new TaskBreakdownError('invalid-response', 'AI:n returnerade för många delsteg eller ett ogiltigt svar. Försök igen.')
  }

  const seen = new Set<string>()
  const steps = parsed.steps
    .map((step) => step.trim())
    .filter((step) => {
      if (!step || step.length > MAX_STEP_TITLE_LENGTH) return false
      const normalized = step.replace(/\s+/g, ' ').toLocaleLowerCase('sv-SE')
      if (seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })

  if (steps.length === 0) {
    throw new TaskBreakdownError('invalid-response', 'AI:n hittade inga användbara delsteg. Ändra kontexten och försök igen.')
  }

  return steps
}

const getErrorDetails = (error: unknown) => {
  if (!error || typeof error !== 'object') return { code: '', message: String(error), status: undefined }

  const candidate = error as {
    code?: unknown
    message?: unknown
    customErrorData?: { status?: unknown; statusText?: unknown }
  }

  const message = typeof candidate.message === 'string' ? candidate.message : String(error)
  return {
    code: typeof candidate.code === 'string' ? candidate.code.toLowerCase() : '',
    message,
    status: typeof candidate.customErrorData?.status === 'number'
      ? candidate.customErrorData.status
      : Number(message.match(/\[(\d{3})\b/)?.[1]) || undefined,
  }
}

export const classifyTaskBreakdownError = (error: unknown): TaskBreakdownError => {
  if (error instanceof TaskBreakdownError) return error

  const { code, message, status } = getErrorDetails(error)
  const lowerMessage = message.toLowerCase()

  if (
    status === 429 &&
    /resource exhausted|high demand|capacity|overload/.test(lowerMessage)
  ) {
    return new TaskBreakdownError('overloaded', 'AI-modellen är tillfälligt överbelastad. Välj en annan modell och försök igen.')
  }

  if (status === 503 || status === 504 || /high demand|capacity|overloaded|temporarily unavailable/.test(lowerMessage)) {
    return new TaskBreakdownError('overloaded', 'AI-modellen är tillfälligt överbelastad. Välj en annan modell och försök igen.')
  }

  if (status === 429 || /quota|rate limit|too many requests|billing/.test(lowerMessage)) {
    return new TaskBreakdownError('quota', 'AI-kvoten är nådd eller fakturering saknas. Kontrollera projektets kvot och faktureringsstatus; ett modellbyte löser inte detta fel.')
  }

  if (code.includes('fetch-error') || error instanceof TypeError || /failed to fetch|fetch failed|network error|offline/.test(lowerMessage)) {
    return new TaskBreakdownError('network', 'Kunde inte nå AI-tjänsten. Kontrollera nätverksanslutningen och försök igen.')
  }

  if (status === 401 || status === 403 || status === 404 || /api key not valid|api not enabled|model .*not found|permission_denied/.test(lowerMessage)) {
    return new TaskBreakdownError('configuration', 'Gemini kunde inte använda den valda modellen. Kontrollera API-nyckel, API- och modellkonfiguration.')
  }

  return new TaskBreakdownError('unknown', 'Det gick inte att generera delsteg just nu. Försök igen senare.')
}

const generateWithModel = async (
  client: GoogleGenerativeAI,
  modelId: TaskBreakdownModelId,
  input: ReturnType<typeof normalizeInput>,
): Promise<TaskBreakdownResult> => {
  const model = client.getGenerativeModel({
    model: modelId,
    systemInstruction,
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.35,
    },
  })
  const result = await model.generateContent(buildPrompt(input))
  if (result.response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
    throw new TaskBreakdownError(
      'invalid-response',
      'AI-svaret blev avklippt när modellens svarstak nåddes. Försök igen eller välj en annan modell.',
    )
  }
  return {
    modelId,
    steps: parseSteps(result.response.text()),
  }
}

export const generateTaskBreakdown = async (input: TaskBreakdownInput): Promise<TaskBreakdownResult> => {
  const normalizedInput = normalizeInput(input)
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new TaskBreakdownError('configuration', 'Gemini API-nyckel saknas. Kontrollera VITE_GEMINI_KEY i deployment-konfigurationen.')
  }

  const client = new GoogleGenerativeAI(apiKey)
  try {
    return await generateWithModel(client, normalizedInput.modelId, normalizedInput)
  } catch (error) {
    const classified = classifyTaskBreakdownError(error)
    if (classified.kind !== 'overloaded' || normalizedInput.modelId === TASK_BREAKDOWN_FALLBACK_MODEL_ID) {
      throw classified
    }
    try {
      return await generateWithModel(client, TASK_BREAKDOWN_FALLBACK_MODEL_ID, normalizedInput)
    } catch (fallbackError) {
      throw classifyTaskBreakdownError(fallbackError)
    }
  }
}
