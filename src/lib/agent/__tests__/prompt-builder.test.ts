import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildPrompt } from '../prompt-builder';
import type { AgentContext, AppointmentSummary } from '../context/types';

function makeAppointment(overrides: Partial<AppointmentSummary> = {}): AppointmentSummary {
  return {
    id: '40000000-0000-0000-0000-000000000001',
    start_time: '2026-04-06T08:00:00',
    end_time: '2026-04-06T09:00:00',
    status: 'confirmed',
    clientName: 'Sarah Johnson',
    serviceName: 'Full Groom',
    address: null,
    notes: null,
    weather_alert: 0,
    ...overrides,
  };
}

describe('serializeContext (via buildPrompt)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('groups appointments by day with human-readable names', () => {
    vi.setSystemTime(new Date('2026-04-05T12:00:00'));
    const context: AgentContext = {
      query: 'test',
      schedule: {
        dateRange: { from: '2026-04-01', to: '2026-04-10' },
        appointments: [
          makeAppointment({ start_time: '2026-04-06T08:00:00', end_time: '2026-04-06T09:00:00' }),
          makeAppointment({
            id: '40000000-0000-0000-0000-000000000002',
            start_time: '2026-04-06T10:00:00',
            end_time: '2026-04-06T11:00:00',
            clientName: 'David Kim',
            serviceName: 'Nail Trim',
          }),
          makeAppointment({
            id: '40000000-0000-0000-0000-000000000003',
            start_time: '2026-04-08T10:00:00',
            end_time: '2026-04-08T11:00:00',
            clientName: 'David Kim',
            serviceName: 'De-shed Treatment',
          }),
        ],
      },
    };

    const messages = buildPrompt(
      { name: 'test', systemPrompt: 'Test.', piiLevel: 'full' },
      context,
      'test'
    );

    const content = messages[0]!.content;
    expect(content).toContain('Monday, April 6:');
    expect(content).toContain('Wednesday, April 8:');
  });

  it('shows times in 12-hour AM/PM format', () => {
    vi.setSystemTime(new Date('2026-04-05T12:00:00'));
    const context: AgentContext = {
      query: 'test',
      schedule: {
        dateRange: { from: '2026-04-06', to: '2026-04-06' },
        appointments: [
          makeAppointment({ start_time: '2026-04-06T08:00:00' }),
          makeAppointment({
            id: '40000000-0000-0000-0000-000000000002',
            start_time: '2026-04-06T14:30:00',
            end_time: '2026-04-06T15:30:00',
            clientName: 'Lisa Martinez',
            serviceName: 'Bath',
          }),
        ],
      },
    };

    const messages = buildPrompt(
      { name: 'test', systemPrompt: 'Test.', piiLevel: 'full' },
      context,
      'test'
    );

    const content = messages[0]!.content;
    expect(content).toContain('8:00 AM');
    expect(content).toContain('2:30 PM');
  });

  it('includes appointment IDs', () => {
    vi.setSystemTime(new Date('2026-04-05T12:00:00'));
    const context: AgentContext = {
      query: 'test',
      schedule: {
        dateRange: { from: '2026-04-06', to: '2026-04-06' },
        appointments: [makeAppointment()],
      },
    };

    const messages = buildPrompt(
      { name: 'test', systemPrompt: 'Test.', piiLevel: 'full' },
      context,
      'test'
    );

    const content = messages[0]!.content;
    expect(content).toContain('(id: 40000000-0000-0000-0000-000000000001)');
  });

  it('marks past days with (past) label', () => {
    vi.setSystemTime(new Date('2026-04-08T12:00:00'));
    const context: AgentContext = {
      query: 'test',
      schedule: {
        dateRange: { from: '2026-04-06', to: '2026-04-10' },
        appointments: [
          makeAppointment({ start_time: '2026-04-06T08:00:00', end_time: '2026-04-06T09:00:00' }),
          makeAppointment({
            id: '40000000-0000-0000-0000-000000000002',
            start_time: '2026-04-09T10:00:00',
            end_time: '2026-04-09T11:00:00',
            clientName: 'David Kim',
            serviceName: 'Nail Trim',
          }),
        ],
      },
    };

    const messages = buildPrompt(
      { name: 'test', systemPrompt: 'Test.', piiLevel: 'full' },
      context,
      'test'
    );

    const content = messages[0]!.content;
    expect(content).toContain('Monday, April 6 (past):');
    expect(content).not.toContain('Thursday, April 9 (past)');
    expect(content).toContain('Thursday, April 9:');
  });

  it('includes address when present', () => {
    vi.setSystemTime(new Date('2026-04-05T12:00:00'));
    const context: AgentContext = {
      query: 'test',
      schedule: {
        dateRange: { from: '2026-04-06', to: '2026-04-06' },
        appointments: [makeAppointment({ address: '123 Main St' })],
      },
    };

    const messages = buildPrompt(
      { name: 'test', systemPrompt: 'Test.', piiLevel: 'full' },
      context,
      'test'
    );

    const content = messages[0]!.content;
    expect(content).toContain('@ 123 Main St');
  });

  it('includes appointment status in serialized output', () => {
    vi.setSystemTime(new Date('2026-04-05T12:00:00'));
    const context: AgentContext = {
      query: 'test',
      schedule: {
        dateRange: { from: '2026-04-06', to: '2026-04-06' },
        appointments: [
          makeAppointment({ status: 'confirmed' }),
          makeAppointment({
            id: '40000000-0000-0000-0000-000000000002',
            start_time: '2026-04-06T10:00:00',
            end_time: '2026-04-06T11:00:00',
            clientName: 'Lisa Martinez',
            serviceName: 'Bath',
            status: 'cancelled',
          }),
        ],
      },
    };

    const messages = buildPrompt(
      { name: 'test', systemPrompt: 'Test.', piiLevel: 'full' },
      context,
      'test'
    );

    const content = messages[0]!.content;
    expect(content).toContain('[confirmed]');
    expect(content).toContain('[cancelled]');
  });

  it('handles empty appointments', () => {
    const context: AgentContext = {
      query: 'test',
      schedule: {
        dateRange: { from: '2026-04-06', to: '2026-04-06' },
        appointments: [],
      },
    };

    const messages = buildPrompt(
      { name: 'test', systemPrompt: 'Test.', piiLevel: 'full' },
      context,
      'test'
    );

    const content = messages[0]!.content;
    expect(content).not.toContain('Appointments:');
  });
});
