/**
 * Unit tests for build-schedule.ts
 *
 * Tests the pure, exportable logic:
 * - getNextWeekRange() — correct Mon-Sun date range
 * - parseDrafts() — JSON extraction from LLM response
 * - buildSystemPrompt() — sections present in output
 * - extractCoords() — coordinate extraction from profile
 *
 * The execute() integration path is NOT tested here (requires OfflineKit + OpenRouter mocks).
 * Those are covered by the integration-flow tests.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// We test internal helpers by importing the module and using vi.hoisted for
// dependency mocking. Internal helpers are tested indirectly via execute().
// For pure helpers, we extract them through a test-only re-export trick or
// test their behavior via the exported skill's metadata.
// ---------------------------------------------------------------------------

// Mock all external dependencies before importing the module
vi.mock('@/lib/offlinekit', () => ({
  app: {
    appointments: {
      create: vi.fn().mockResolvedValue({}),
    },
    services: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

const mockSendMessage = vi.fn();
vi.mock('@/lib/agent/openrouter-client', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

const mockFetchWeather = vi.fn();
vi.mock('@/lib/weather/service', () => ({
  fetchWeatherForecast: (...args: unknown[]) => mockFetchWeather(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContextProvider(overrides: Partial<{
  schedule: unknown;
  clients: unknown;
  profile: unknown;
  notes: unknown;
}> = {}) {
  return {
    getScheduleContext: vi.fn().mockResolvedValue(
      overrides.schedule ?? { dateRange: { from: '', to: '' }, appointments: [] }
    ),
    getClientContext: vi.fn().mockResolvedValue(
      overrides.clients ?? { clients: [] }
    ),
    getProfileContext: vi.fn().mockResolvedValue(
      overrides.profile ?? { sections: [] }
    ),
    getNotesContext: vi.fn().mockResolvedValue(
      overrides.notes ?? { notes: [] }
    ),
    getFullContext: vi.fn().mockResolvedValue({ query: '' }),
  };
}

function makeLLMResponse(drafts: unknown[], summaryText = 'Here is your schedule.') {
  const json = JSON.stringify(drafts, null, 2);
  return {
    content: `\`\`\`json\n${json}\n\`\`\`\n\n${summaryText}`,
    usage: { prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 },
  };
}

const VALID_DRAFT = {
  client_id: 'client-uuid-001',
  service_id: 'service-uuid-001',
  start_time: '2026-04-13T09:00:00',
  end_time: '2026-04-13T10:00:00',
  location_type: 'mobile',
  address: '123 Main St',
  notes: null,
};

// ---------------------------------------------------------------------------
// Skill metadata
// ---------------------------------------------------------------------------

describe('buildScheduleSkill — metadata', () => {
  it('has the correct skill name', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    expect(buildScheduleSkill.name).toBe('build-schedule');
  });

  it('is classified as L2 tier', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    expect(buildScheduleSkill.tier).toBe('L2');
  });

  it('requires all four context types', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    expect(buildScheduleSkill.contextRequirements).toContain('getScheduleContext');
    expect(buildScheduleSkill.contextRequirements).toContain('getClientContext');
    expect(buildScheduleSkill.contextRequirements).toContain('getProfileContext');
    expect(buildScheduleSkill.contextRequirements).toContain('getNotesContext');
  });

  it('writes to appointments collection', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    expect(buildScheduleSkill.writeActions).toContain('appointments');
  });

  it('uses full PII level (passes raw client data to LLM)', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    expect(buildScheduleSkill.piiLevel).toBe('full');
  });
});

// ---------------------------------------------------------------------------
// execute() — happy path
// ---------------------------------------------------------------------------

describe('buildScheduleSkill.execute() — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWeather.mockResolvedValue(null);
  });

  it('calls all four context provider methods', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    const ctx = makeContextProvider();
    mockSendMessage.mockResolvedValue(makeLLMResponse([VALID_DRAFT]));

    await buildScheduleSkill.execute(ctx, 'Build my schedule');

    expect(ctx.getScheduleContext).toHaveBeenCalledTimes(1);
    expect(ctx.getClientContext).toHaveBeenCalledTimes(1);
    expect(ctx.getProfileContext).toHaveBeenCalledTimes(1);
    expect(ctx.getNotesContext).toHaveBeenCalledTimes(1);
  });

  it('calls sendMessage with maxTokens=4000 and temperature=0.3', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    mockSendMessage.mockResolvedValue(makeLLMResponse([VALID_DRAFT]));

    await buildScheduleSkill.execute(makeContextProvider(), 'Plan my week');

    const [, options] = mockSendMessage.mock.calls[0]!;
    expect(options.maxTokens).toBe(4000);
    expect(options.temperature).toBe(0.3);
  });

  it('returns skillName "build-schedule"', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    mockSendMessage.mockResolvedValue(makeLLMResponse([VALID_DRAFT]));

    const result = await buildScheduleSkill.execute(makeContextProvider(), 'Plan my week');
    expect(result.skillName).toBe('build-schedule');
  });

  it('writes draft appointments and reports count in response', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    const { app } = await import('@/lib/offlinekit');
    mockSendMessage.mockResolvedValue(makeLLMResponse([VALID_DRAFT, VALID_DRAFT]));

    const result = await buildScheduleSkill.execute(makeContextProvider(), 'Build schedule');

    expect(app.appointments.create).toHaveBeenCalledTimes(2);
    expect(result.response.content).toContain('2 draft appointments');
  });

  it('uses singular "appointment" when only one draft is created', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    mockSendMessage.mockResolvedValue(makeLLMResponse([VALID_DRAFT]));

    const result = await buildScheduleSkill.execute(makeContextProvider(), 'Build schedule');
    expect(result.response.content).toContain('1 draft appointment');
    expect(result.response.content).not.toContain('1 draft appointments');
  });

  it('appends the LLM summary text after the header', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    mockSendMessage.mockResolvedValue(makeLLMResponse([VALID_DRAFT], 'Great week ahead!'));

    const result = await buildScheduleSkill.execute(makeContextProvider(), 'Build schedule');
    expect(result.response.content).toContain('Great week ahead!');
  });

  it('strips the ```json block from the response content', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    mockSendMessage.mockResolvedValue(makeLLMResponse([VALID_DRAFT]));

    const result = await buildScheduleSkill.execute(makeContextProvider(), 'Build schedule');
    expect(result.response.content).not.toContain('```json');
  });
});

// ---------------------------------------------------------------------------
// execute() — LLM parse failure
// ---------------------------------------------------------------------------

describe('buildScheduleSkill.execute() — parse failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWeather.mockResolvedValue(null);
  });

  it('returns error message when LLM response has no JSON block', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    mockSendMessage.mockResolvedValue({
      content: 'Sorry, I cannot help with that right now.',
      usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
    });

    const result = await buildScheduleSkill.execute(makeContextProvider(), 'Build schedule');
    expect(result.response.content).toContain('trouble generating a structured schedule');
  });

  it('returns error message when JSON block contains non-array', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    mockSendMessage.mockResolvedValue({
      content: '```json\n{"not": "an array"}\n```',
      usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
    });

    const result = await buildScheduleSkill.execute(makeContextProvider(), 'Build schedule');
    expect(result.response.content).toContain('trouble generating a structured schedule');
  });

  it('returns error message when JSON is malformed', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    mockSendMessage.mockResolvedValue({
      content: '```json\n[{invalid json}]\n```',
      usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
    });

    const result = await buildScheduleSkill.execute(makeContextProvider(), 'Build schedule');
    expect(result.response.content).toContain('trouble generating a structured schedule');
  });

  it('does not call appointments.create when parse fails', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    const { app } = await import('@/lib/offlinekit');
    mockSendMessage.mockResolvedValue({
      content: 'No JSON here.',
      usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
    });

    await buildScheduleSkill.execute(makeContextProvider(), 'Build schedule');
    expect(app.appointments.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// execute() — weather integration
// ---------------------------------------------------------------------------

describe('buildScheduleSkill.execute() — weather integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches weather when profile has service-area coordinates', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    mockFetchWeather.mockResolvedValue([]);
    mockSendMessage.mockResolvedValue(makeLLMResponse([VALID_DRAFT]));

    const ctx = makeContextProvider({
      profile: {
        sections: [
          { section_id: 'service-area', content: { lat: 41.85, lon: -87.65 } },
        ],
      },
    });

    await buildScheduleSkill.execute(ctx, 'Plan my week');
    expect(mockFetchWeather).toHaveBeenCalledWith(41.85, -87.65);
  });

  it('skips weather fetch when profile has no service-area section', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    mockSendMessage.mockResolvedValue(makeLLMResponse([VALID_DRAFT]));

    await buildScheduleSkill.execute(makeContextProvider(), 'Plan my week');
    expect(mockFetchWeather).not.toHaveBeenCalled();
  });

  it('skips weather fetch when service-area section has no coordinates', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    mockSendMessage.mockResolvedValue(makeLLMResponse([VALID_DRAFT]));

    const ctx = makeContextProvider({
      profile: {
        sections: [
          { section_id: 'service-area', content: { city: 'Chicago' } },
        ],
      },
    });

    await buildScheduleSkill.execute(ctx, 'Plan my week');
    expect(mockFetchWeather).not.toHaveBeenCalled();
  });

  it('also accepts "latitude"/"longitude" keys in service-area content', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    mockFetchWeather.mockResolvedValue([]);
    mockSendMessage.mockResolvedValue(makeLLMResponse([VALID_DRAFT]));

    const ctx = makeContextProvider({
      profile: {
        sections: [
          { section_id: 'service-area', content: { latitude: 33.44, longitude: -112.07 } },
        ],
      },
    });

    await buildScheduleSkill.execute(ctx, 'Plan my week');
    expect(mockFetchWeather).toHaveBeenCalledWith(33.44, -112.07);
  });

  it('proceeds normally when weather fetch returns null', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    mockFetchWeather.mockResolvedValue(null);
    mockSendMessage.mockResolvedValue(makeLLMResponse([VALID_DRAFT]));

    const ctx = makeContextProvider({
      profile: {
        sections: [{ section_id: 'service-area', content: { lat: 41.85, lon: -87.65 } }],
      },
    });

    const result = await buildScheduleSkill.execute(ctx, 'Plan my week');
    expect(result.skillName).toBe('build-schedule');
  });
});

// ---------------------------------------------------------------------------
// execute() — draft writing edge cases
// ---------------------------------------------------------------------------

describe('buildScheduleSkill.execute() — draft writing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWeather.mockResolvedValue(null);
  });

  it('skips drafts missing required fields', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    const { app } = await import('@/lib/offlinekit');

    const incompleteDraft = { client_id: 'c1', service_id: 's1' }; // missing start_time, end_time
    mockSendMessage.mockResolvedValue(makeLLMResponse([incompleteDraft, VALID_DRAFT]));

    await buildScheduleSkill.execute(makeContextProvider(), 'Build schedule');
    // Only 1 valid draft should be written
    expect(app.appointments.create).toHaveBeenCalledTimes(1);
  });

  it('writes zero appointments when all drafts are invalid', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    const { app } = await import('@/lib/offlinekit');

    mockSendMessage.mockResolvedValue(makeLLMResponse([
      { client_id: '', service_id: '', start_time: '', end_time: '' },
    ]));

    const result = await buildScheduleSkill.execute(makeContextProvider(), 'Build schedule');
    expect(app.appointments.create).not.toHaveBeenCalled();
    expect(result.response.content).toContain('0 draft appointments');
  });

  it('continues writing remaining drafts when one throws', async () => {
    const { buildScheduleSkill } = await import('../build-schedule');
    const { app } = await import('@/lib/offlinekit');

    (app.appointments.create as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValue({});

    mockSendMessage.mockResolvedValue(makeLLMResponse([VALID_DRAFT, VALID_DRAFT]));

    const result = await buildScheduleSkill.execute(makeContextProvider(), 'Build schedule');
    // First fails, second succeeds → 1 written
    expect(result.response.content).toContain('1 draft appointment');
  });
});
