import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai'
import { app } from '@/firebase'

export const TASK_BREAKDOWN_MODEL_OPTIONS = [
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite' },
] as const

export const DEFAULT_TASK_BREAKDOWN_MODEL_ID = 'gemini-3.8-flash'

export const TASK_BREAKDOWN_MODEL_IDS = [
  DEFAULT_TASK_BREAKDOWN_MODEL_ID,
  ...TASK_BREAKDOWN_MODEL_OPTIONS.map((model) => model.id),
] as const

export type TaskBreakdownModelId = (typeof TASK_BREAKDOWN_MODEL_IDS)[number]

export type TaskBreakdownErrorKind =
  | 'invalid-input'
  | 'overloaded'
  | 'quota'
  | 'network'
  | 'app-check'
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

let aiInstance: ReturnType<typeof getAI> | null = null
const getAiInstance = () => (aiInstance ??= getAI(app, { backend: new GoogleAIBackend() }))

const responseSchema = Schema.object({
  properties: {
    steps: Schema.array({
      items: Schema.string(),
      maxItems: MAX_STEP_COUNT,
    }),
  },
})

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
  const modelId = input.modelId ?? DEFAULT_TASK_BREAKDOWN_MODEL_ID

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
  if (!TASK_BREAKDOWN_MODEL_IDS.includes(modelId)) {
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

  return {
    code: typeof candidate.code === 'string' ? candidate.code.toLowerCase() : '',
    message: typeof candidate.message === 'string' ? candidate.message : String(error),
    status: typeof candidate.customErrorData?.status === 'number' ? candidate.customErrorData.status : undefined,
  }
}

export const classifyTaskBreakdownError = (error: unknown): TaskBreakdownError => {
  if (error instanceof TaskBreakdownError) return error

  const { code, message, status } = getErrorDetails(error)
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('app check') || lowerMessage.includes('app_check')) {
    return new TaskBreakdownError('app-check', 'App Check kunde inte verifiera appen. Kontrollera Firebase App Check-konfigurationen och försök igen.')
  }

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
    return new TaskBreakdownError('configuration', 'Firebase AI Logic kunde inte använda den valda modellen. Kontrollera projekt-, API- och modellkonfigurationen.')
  }

  return new TaskBreakdownError('unknown', 'Det gick inte att generera delsteg just nu. Försök igen senare.')
}

export const generateTaskBreakdown = async (input: TaskBreakdownInput): Promise<TaskBreakdownResult> => {
  const normalizedInput = normalizeInput(input)
  const model = getGenerativeModel(getAiInstance(), {
    model: normalizedInput.modelId,
    systemInstruction,
    generationConfig: {
      maxOutputTokens: 1200,
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.35,
    },
  })

  try {
    const result = await model.generateContent(buildPrompt(normalizedInput))
    return {
      modelId: normalizedInput.modelId,
      steps: parseSteps(result.response.text()),
    }
  } catch (error) {
    throw classifyTaskBreakdownError(error)
  }
}
