import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  classifyTaskBreakdownError,
  DEFAULT_TASK_BREAKDOWN_MODEL_ID,
  fetchAvailableTaskBreakdownModels,
  generateTaskBreakdown,
  TASK_BREAKDOWN_FALLBACK_MODEL_ID,
  TASK_BREAKDOWN_MODEL_OPTIONS,
  TaskBreakdownError,
} from '@/services/taskBreakdownService'

const sdkMocks = vi.hoisted(() => ({
  GoogleGenerativeAI: vi.fn(),
  getGenerativeModel: vi.fn(),
  generateContent: vi.fn(),
}))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: sdkMocks.GoogleGenerativeAI,
  SchemaType: { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING' },
}))

const response = (steps: unknown) => ({
  response: { text: () => JSON.stringify({ steps }) },
})

describe('generateTaskBreakdown', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.stubEnv('VITE_GEMINI_KEY', 'test-api-key')
    sdkMocks.GoogleGenerativeAI.mockImplementation(function () {
      return { getGenerativeModel: sdkMocks.getGenerativeModel }
    })
    sdkMocks.getGenerativeModel.mockReturnValue({ generateContent: sdkMocks.generateContent })
    sdkMocks.generateContent.mockResolvedValue(response(['  Köp färg  ', 'Köp färg', 'Mät väggen']))
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
    expect(sdkMocks.GoogleGenerativeAI).toHaveBeenCalledWith('test-api-key')
    expect(sdkMocks.getGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({ model: DEFAULT_TASK_BREAKDOWN_MODEL_ID }),
    )
    expect(sdkMocks.generateContent).toHaveBeenCalledWith(
      expect.stringContaining('ANTECKNING:\nVäggen behöver grundmålas.'),
    )
    expect(sdkMocks.generateContent).toHaveBeenCalledWith(
      expect.stringContaining('EXTRA INSTRUKTION:\nDela upp arbetet över två dagar.'),
    )
  })

  it('accepts only the configured alternative models', async () => {
    const modelId = TASK_BREAKDOWN_MODEL_OPTIONS[0].id

    const result = await generateTaskBreakdown({ title: 'Packa inför flytt', modelId })

    expect(result.modelId).toBe(modelId)
    expect(sdkMocks.getGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({ model: modelId }),
    )
  })

  it('rejects empty titles and unsupported models without calling the provider', async () => {
    await expect(generateTaskBreakdown({ title: '   ' })).rejects.toMatchObject({ kind: 'invalid-input' })
    await expect(generateTaskBreakdown({ title: 'Planera resa', modelId: 'unlisted-model' as never }))
      .rejects.toMatchObject({ kind: 'invalid-input' })
    expect(sdkMocks.generateContent).not.toHaveBeenCalled()
  })

  it('rejects oversized context before calling the provider', async () => {
    await expect(generateTaskBreakdown({ title: 'Uppgift', note: 'x'.repeat(4001) }))
      .rejects.toMatchObject({ kind: 'invalid-input' })
    expect(sdkMocks.generateContent).not.toHaveBeenCalled()
  })

  it('rejects malformed or oversized model responses', async () => {
    sdkMocks.generateContent.mockResolvedValueOnce({ response: { text: () => 'not json' } })
    await expect(generateTaskBreakdown({ title: 'Planera resa' }))
      .rejects.toMatchObject({ kind: 'invalid-response' })

    sdkMocks.generateContent.mockResolvedValueOnce(response(Array.from({ length: 21 }, (_, index) => `Steg ${index}`)))
    await expect(generateTaskBreakdown({ title: 'Planera resa' }))
      .rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('reports MAX_TOKENS responses as truncated before trying to parse JSON', async () => {
    sdkMocks.generateContent.mockResolvedValueOnce({
      response: {
        candidates: [{ finishReason: 'MAX_TOKENS' }],
        text: () => { throw new Error('response.text should not be called for a truncated response') },
      },
    })

    await expect(generateTaskBreakdown({ title: 'Frigör utrymme på Google One' }))
      .rejects.toMatchObject({
        kind: 'invalid-response',
        message: expect.stringContaining('avklippt'),
      })
    expect(sdkMocks.getGenerativeModel).toHaveBeenCalledWith(expect.objectContaining({
      generationConfig: expect.objectContaining({ maxOutputTokens: 4096 }),
    }))
  })

  it('tries the fallback model once after a capacity error', async () => {
    sdkMocks.generateContent
      .mockRejectedValueOnce(new Error('[503 Service Unavailable] high demand'))
      .mockResolvedValueOnce(response(['Dela upp arbetet']))

    const result = await generateTaskBreakdown({ title: 'Testa fallback' })

    expect(result).toEqual({ modelId: TASK_BREAKDOWN_FALLBACK_MODEL_ID, steps: ['Dela upp arbetet'] })
    expect(sdkMocks.getGenerativeModel.mock.calls.map(([options]) => options.model)).toEqual([
      DEFAULT_TASK_BREAKDOWN_MODEL_ID,
      TASK_BREAKDOWN_FALLBACK_MODEL_ID,
    ])
  })

  it('does not try another model for quota errors', async () => {
    sdkMocks.generateContent.mockRejectedValueOnce(new Error('[429 Too Many Requests] quota exceeded'))

    await expect(generateTaskBreakdown({ title: 'Kontrollera kvot' })).rejects.toMatchObject({ kind: 'quota' })
    expect(sdkMocks.getGenerativeModel).toHaveBeenCalledTimes(1)
  })

  it('discovers supported Gemini models and caches the filtered result', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: 'models/gemini-3.6-flash', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.5-flash-audio', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['embedContent'] },
        ],
      }),
    } as Response)

    const models = await fetchAvailableTaskBreakdownModels()
    const cachedModels = await fetchAvailableTaskBreakdownModels()

    expect(models).toEqual([{ id: 'gemini-3.6-flash', name: 'Gemini Flash' }])
    expect(cachedModels).toEqual(models)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toContain('key=test-api-key')
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

  it('returns distinct actionable categories for network and setup failures', () => {
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
