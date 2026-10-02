import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  classifyTaskBreakdownError,
  DEFAULT_TASK_BREAKDOWN_MODEL_ID,
  generateTaskBreakdown,
  TASK_BREAKDOWN_MODEL_OPTIONS,
  TaskBreakdownError,
} from '@/services/taskBreakdownService'

const aiMocks = vi.hoisted(() => ({
  getAI: vi.fn(() => ({})),
  getGenerativeModel: vi.fn(),
  generateContent: vi.fn(),
}))

vi.mock('@/firebase', () => ({ app: {} }))

vi.mock('firebase/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/ai')>()
  return {
    ...actual,
    getAI: aiMocks.getAI,
    getGenerativeModel: aiMocks.getGenerativeModel,
  }
})

const response = (steps: unknown) => ({
  response: { text: () => JSON.stringify({ steps }) },
})

describe('generateTaskBreakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    aiMocks.getGenerativeModel.mockReturnValue({ generateContent: aiMocks.generateContent })
    aiMocks.generateContent.mockResolvedValue(response(['  Köp färg  ', 'Köp färg', 'Mät väggen']))
  })

  it('uses the default model, sends available context and normalizes returned steps', async () => {
    const result = await generateTaskBreakdown({
      title: '  Måla sovrummet  ',
      note: 'Väggen behöver grundmålas.',
      additionalPrompt: 'Dela upp arbetet över två dagar.',
    })

    expect(result).toEqual({
      modelId: DEFAULT_TASK_BREAKDOWN_MODEL_ID,
      steps: ['Köp färg', 'Mät väggen'],
    })
    expect(aiMocks.getGenerativeModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ model: DEFAULT_TASK_BREAKDOWN_MODEL_ID }),
    )
    expect(aiMocks.generateContent).toHaveBeenCalledWith(
      expect.stringContaining('ANTECKNING:\nVäggen behöver grundmålas.'),
    )
    expect(aiMocks.generateContent).toHaveBeenCalledWith(
      expect.stringContaining('EXTRA INSTRUKTION:\nDela upp arbetet över två dagar.'),
    )
  })

  it('accepts only the configured alternative models', async () => {
    const modelId = TASK_BREAKDOWN_MODEL_OPTIONS[0].id

    const result = await generateTaskBreakdown({ title: 'Packa inför flytt', modelId })

    expect(result.modelId).toBe(modelId)
    expect(aiMocks.getGenerativeModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ model: modelId }),
    )
  })

  it('rejects empty titles and unsupported models without calling the provider', async () => {
    await expect(generateTaskBreakdown({ title: '   ' })).rejects.toMatchObject({ kind: 'invalid-input' })
    await expect(generateTaskBreakdown({ title: 'Planera resa', modelId: 'unlisted-model' as never }))
      .rejects.toMatchObject({ kind: 'invalid-input' })
    expect(aiMocks.generateContent).not.toHaveBeenCalled()
  })

  it('rejects oversized context before calling the provider', async () => {
    await expect(generateTaskBreakdown({ title: 'Uppgift', note: 'x'.repeat(4001) }))
      .rejects.toMatchObject({ kind: 'invalid-input' })
    expect(aiMocks.generateContent).not.toHaveBeenCalled()
  })

  it('rejects malformed or oversized model responses', async () => {
    aiMocks.generateContent.mockResolvedValueOnce({ response: { text: () => 'not json' } })
    await expect(generateTaskBreakdown({ title: 'Planera resa' }))
      .rejects.toMatchObject({ kind: 'invalid-response' })

    aiMocks.generateContent.mockResolvedValueOnce(response(Array.from({ length: 21 }, (_, index) => `Steg ${index}`)))
    await expect(generateTaskBreakdown({ title: 'Planera resa' }))
      .rejects.toMatchObject({ kind: 'invalid-response' })
  })
})

describe('classifyTaskBreakdownError', () => {
  it('offers alternative models only for recoverable model-capacity errors', () => {
    expect(classifyTaskBreakdownError(Object.assign(new Error('Resource exhausted'), {
      customErrorData: { status: 429 },
    })).kind).toBe('overloaded')
    expect(classifyTaskBreakdownError(Object.assign(new Error('Quota exceeded'), {
      customErrorData: { status: 429 },
    })).kind).toBe('quota')
    expect(classifyTaskBreakdownError(Object.assign(new Error('AI API unavailable'), {
      customErrorData: { status: 503 },
    })).kind).toBe('overloaded')
  })

  it('returns distinct actionable categories for network, App Check and setup failures', () => {
    expect(classifyTaskBreakdownError(Object.assign(new Error('App Check token rejected'), {
      customErrorData: { status: 403 },
    })).kind).toBe('app-check')
    expect(classifyTaskBreakdownError(new TypeError('Failed to fetch')).kind).toBe('network')
    expect(classifyTaskBreakdownError(Object.assign(new Error('Unknown model'), {
      customErrorData: { status: 404 },
    })).kind).toBe('configuration')
  })

  it('preserves service errors and returns a user-safe fallback for unknown failures', () => {
    const knownError = new TaskBreakdownError('invalid-input', 'Rubrikfel')
    expect(classifyTaskBreakdownError(knownError)).toBe(knownError)
    expect(classifyTaskBreakdownError(new Error('internal provider detail')).message)
      .toBe('Det gick inte att generera delsteg just nu. Försök igen senare.')
  })
})
