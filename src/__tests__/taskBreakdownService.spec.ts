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
    localStorage.clear()
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

  it('uses custom API key when configured and falls over to next key on quota error', async () => {
    localStorage.setItem('todo-gemini-api-keys', JSON.stringify(['key-1', 'key-2']))

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    // Key 1 fails with quota 429
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({ error: { code: 429, message: 'Quota exceeded for project' } }),
    } as Response)
    // Key 2 succeeds
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: JSON.stringify({ steps: ['Steg från nyckel 2'] }) }] },
        }],
      }),
    } as Response)

    const result = await generateTaskBreakdown({ title: 'Testa failover' })

    expect(result.steps).toEqual(['Steg från nyckel 2'])
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls[0][0]).toContain('key=key-1')
    expect(fetchSpy.mock.calls[1][0]).toContain('key=key-2')
    expect(aiMocks.generateContent).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
  })

  it('throws quota error indicating all keys failed when all custom keys hit quota', async () => {
    localStorage.setItem('todo-gemini-api-keys', JSON.stringify(['key-1', 'key-2']))

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({ error: { code: 429, message: 'Quota exceeded' } }),
    } as Response)

    await expect(generateTaskBreakdown({ title: 'Testa failover' }))
      .rejects.toMatchObject({
        kind: 'quota',
        message: expect.stringContaining('alla (2) sparade API-nycklar'),
      })

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    fetchSpy.mockRestore()
  })

  it('uses explicitly chosen API key directly without failover', async () => {
    localStorage.setItem('todo-gemini-api-keys', JSON.stringify(['key-1', 'key-2']))

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: JSON.stringify({ steps: ['Direkt från specifik nyckel'] }) }] },
        }],
      }),
    } as Response)

    const result = await generateTaskBreakdown({ title: 'Vald nyckel', apiKey: 'key-2' })

    expect(result.steps).toEqual(['Direkt från specifik nyckel'])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toContain('key=key-2')
    expect(aiMocks.generateContent).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
  })

  it('bypasses saved keys when standard quota is chosen', async () => {
    localStorage.setItem('todo-gemini-api-keys', JSON.stringify(['key-1', 'key-2']))

    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await generateTaskBreakdown({ title: 'Standardkvot', apiKey: 'standard' })

    expect(result.steps).toEqual(['Köp färg', 'Mät väggen'])
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(aiMocks.generateContent).toHaveBeenCalled()

    fetchSpy.mockRestore()
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
