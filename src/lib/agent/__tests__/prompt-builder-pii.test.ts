/**
 * Additional tests for prompt-builder.ts focusing on:
 * - PII anonymization path (piiLevel === 'anonymized')
 * - Profile sections serialization
 * - Clients serialization
 * - Notes serialization
 * - Empty/partial context combinations
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildPrompt } from '../prompt-builder';
import type { AgentContext, ClientSummary, ProfileSection } from '../context/types';

function makeClient(overrides: Partial<ClientSummary> = {}): ClientSummary {
  return {
    id: 'client-001',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    phone: null,
    address: '123 Main St',
    scheduling_flexibility: 'flexible',
    notes: null,
    pets: [],
    ...overrides,
  };
}

describe('buildPrompt — PII anonymization', () => {
  it('replaces client names with initials when piiLevel is anonymized', () => {
    const context: AgentContext = {
      query: 'test',
      clients: {
        clients: [makeClient({ first_name: 'Alice', last_name: 'Walker', address: undefined })],
      },
    };

    const messages = buildPrompt(
      { name: 'learn', systemPrompt: 'You are a helper.', piiLevel: 'anonymized' },
      context,
      'remember my patterns'
    );

    const content = messages[0]!.content;
    expect(content).not.toContain('Alice Walker');
    expect(content).toContain('A.W.');
  });

  it('replaces addresses with zone labels when piiLevel is anonymized', () => {
    const context: AgentContext = {
      query: 'test',
      clients: {
        clients: [makeClient({ first_name: 'Bob', last_name: 'Smith', address: '456 Oak Ave' })],
      },
    };

    const messages = buildPrompt(
      { name: 'learn', systemPrompt: 'You are a helper.', piiLevel: 'anonymized' },
      context,
      'what are my patterns?'
    );

    const content = messages[0]!.content;
    expect(content).not.toContain('456 Oak Ave');
    expect(content).toContain('Zone A');
  });

  it('does NOT anonymize when piiLevel is full', () => {
    const context: AgentContext = {
      query: 'test',
      clients: {
        clients: [makeClient({ first_name: 'Carol', last_name: 'Jones', address: '789 Pine Rd' })],
      },
    };

    const messages = buildPrompt(
      { name: 'check-in', systemPrompt: 'You are a helper.', piiLevel: 'full' },
      context,
      'show my schedule'
    );

    const content = messages[0]!.content;
    expect(content).toContain('Carol Jones');
    expect(content).toContain('789 Pine Rd');
  });

  it('anonymizes multiple clients with sequential zone labels', () => {
    const context: AgentContext = {
      query: 'test',
      clients: {
        clients: [
          makeClient({ id: 'c1', first_name: 'Alice', last_name: 'Smith', address: '1 First St' }),
          makeClient({ id: 'c2', first_name: 'Bob', last_name: 'Jones', address: '2 Second Ave' }),
        ],
      },
    };

    const messages = buildPrompt(
      { name: 'learn', systemPrompt: 'System.', piiLevel: 'anonymized' },
      context,
      'learn'
    );

    const content = messages[0]!.content;
    expect(content).toContain('Zone A');
    expect(content).toContain('Zone B');
    expect(content).not.toContain('1 First St');
    expect(content).not.toContain('2 Second Ave');
  });
});

describe('buildPrompt — profile serialization', () => {
  it('includes profile sections in system message', () => {
    const sections: ProfileSection[] = [
      { section_id: 'business', content: { name: 'Pawsome Groomers', timezone: 'America/Chicago' } },
    ];

    const context: AgentContext = {
      query: 'test',
      profile: { sections },
    };

    const messages = buildPrompt(
      { name: 'check-in', systemPrompt: 'You are a helper.', piiLevel: 'full' },
      context,
      'hi'
    );

    const content = messages[0]!.content;
    expect(content).toContain('Business profile:');
    expect(content).toContain('[business]');
    expect(content).toContain('Pawsome Groomers');
    expect(content).toContain('America/Chicago');
  });

  it('does not include profile section when sections array is empty', () => {
    const context: AgentContext = {
      query: 'test',
      profile: { sections: [] },
    };

    const messages = buildPrompt(
      { name: 'check-in', systemPrompt: 'System.', piiLevel: 'full' },
      context,
      'hi'
    );

    expect(messages[0]!.content).not.toContain('Business profile:');
  });

  it('serializes multiple profile sections', () => {
    const context: AgentContext = {
      query: 'test',
      profile: {
        sections: [
          { section_id: 'work-schedule', content: { mon: '8am-5pm', tue: '8am-5pm' } },
          { section_id: 'service-area', content: { lat: 41.85, lon: -87.65 } },
        ],
      },
    };

    const messages = buildPrompt(
      { name: 'check-in', systemPrompt: 'System.', piiLevel: 'full' },
      context,
      'hi'
    );

    const content = messages[0]!.content;
    expect(content).toContain('[work-schedule]');
    expect(content).toContain('[service-area]');
  });
});

describe('buildPrompt — clients serialization', () => {
  it('includes client names in the system message', () => {
    const context: AgentContext = {
      query: 'test',
      clients: {
        clients: [makeClient({ first_name: 'Maria', last_name: 'Garcia' })],
      },
    };

    const messages = buildPrompt(
      { name: 'check-in', systemPrompt: 'System.', piiLevel: 'full' },
      context,
      'show clients'
    );

    expect(messages[0]!.content).toContain('Maria Garcia');
  });

  it('includes client address when present', () => {
    const context: AgentContext = {
      query: 'test',
      clients: { clients: [makeClient({ address: '999 Elm St' })] },
    };

    const messages = buildPrompt(
      { name: 'check-in', systemPrompt: 'System.', piiLevel: 'full' },
      context,
      'clients'
    );

    expect(messages[0]!.content).toContain('999 Elm St');
  });

  it('includes scheduling flexibility label', () => {
    const context: AgentContext = {
      query: 'test',
      clients: { clients: [makeClient({ scheduling_flexibility: 'fixed' })] },
    };

    const messages = buildPrompt(
      { name: 'check-in', systemPrompt: 'System.', piiLevel: 'full' },
      context,
      'clients'
    );

    expect(messages[0]!.content).toContain('[fixed]');
  });

  it('includes pet names and breeds', () => {
    const context: AgentContext = {
      query: 'test',
      clients: {
        clients: [
          makeClient({
            pets: [{ id: 'pet-1', name: 'Buddy', species: 'dog', breed: 'Labrador', behavior_notes: null }],
          }),
        ],
      },
    };

    const messages = buildPrompt(
      { name: 'check-in', systemPrompt: 'System.', piiLevel: 'full' },
      context,
      'clients'
    );

    expect(messages[0]!.content).toContain('Buddy the Labrador');
  });

  it('uses species when breed is null', () => {
    const context: AgentContext = {
      query: 'test',
      clients: {
        clients: [
          makeClient({
            pets: [{ id: 'pet-1', name: 'Whiskers', species: 'cat', breed: null, behavior_notes: null }],
          }),
        ],
      },
    };

    const messages = buildPrompt(
      { name: 'check-in', systemPrompt: 'System.', piiLevel: 'full' },
      context,
      'clients'
    );

    expect(messages[0]!.content).toContain('Whiskers the cat');
  });
});

describe('buildPrompt — notes serialization', () => {
  it('includes notes in the system message', () => {
    const context: AgentContext = {
      query: 'test',
      notes: {
        notes: [
          {
            id: 'note-1',
            summary: 'Prefers morning slots',
            content: 'Client mentioned she likes 8-10am',
            tags: [],
            date_ref: '2026-04-01',
            client_id: null,
          },
        ],
      },
    };

    const messages = buildPrompt(
      { name: 'learn', systemPrompt: 'System.', piiLevel: 'full' },
      context,
      'notes'
    );

    const content = messages[0]!.content;
    expect(content).toContain('Notes/memories:');
    expect(content).toContain('Prefers morning slots');
    expect(content).toContain('(2026-04-01)');
  });

  it('omits date when date_ref is null', () => {
    const context: AgentContext = {
      query: 'test',
      notes: {
        notes: [
          {
            id: 'note-1',
            summary: 'General preference',
            content: null,
            tags: [],
            date_ref: null,
            client_id: null,
          },
        ],
      },
    };

    const messages = buildPrompt(
      { name: 'learn', systemPrompt: 'System.', piiLevel: 'full' },
      context,
      'notes'
    );

    const content = messages[0]!.content;
    expect(content).toContain('General preference');
    expect(content).not.toMatch(/\(\d{4}-\d{2}-\d{2}\)/);
  });

  it('omits notes section when notes array is empty', () => {
    const context: AgentContext = {
      query: 'test',
      notes: { notes: [] },
    };

    const messages = buildPrompt(
      { name: 'learn', systemPrompt: 'System.', piiLevel: 'full' },
      context,
      'notes'
    );

    expect(messages[0]!.content).not.toContain('Notes/memories:');
  });
});

describe('buildPrompt — message structure', () => {
  it('always returns exactly two messages', () => {
    const messages = buildPrompt(
      { name: 'test', systemPrompt: 'System.', piiLevel: 'full' },
      { query: 'test' },
      'hello'
    );
    expect(messages).toHaveLength(2);
  });

  it('first message is always system role', () => {
    const messages = buildPrompt(
      { name: 'test', systemPrompt: 'System.', piiLevel: 'full' },
      { query: 'test' },
      'hello'
    );
    expect(messages[0]!.role).toBe('system');
  });

  it('second message is always user role with the user message', () => {
    const messages = buildPrompt(
      { name: 'test', systemPrompt: 'System.', piiLevel: 'full' },
      { query: 'test' },
      'What is my schedule?'
    );
    expect(messages[1]!.role).toBe('user');
    expect(messages[1]!.content).toBe('What is my schedule?');
  });

  it('system message contains the skill system prompt', () => {
    const messages = buildPrompt(
      { name: 'test', systemPrompt: 'You are a special assistant.', piiLevel: 'full' },
      { query: 'test' },
      'hi'
    );
    expect(messages[0]!.content).toContain('You are a special assistant.');
  });

  it('context separator text is injected when context is non-empty', () => {
    const context: AgentContext = {
      query: 'test',
      profile: {
        sections: [{ section_id: 'biz', content: { name: 'Test Biz' } }],
      },
    };
    const messages = buildPrompt(
      { name: 'test', systemPrompt: 'System.', piiLevel: 'full' },
      context,
      'hi'
    );
    expect(messages[0]!.content).toContain('--- Current context ---');
  });
});
