import { describe, it, expect } from 'vitest';
import { routeMessage } from '../router';
import { buildPrompt } from '@/lib/agent/prompt-builder';
import type { AgentContext } from '@/lib/agent/context/types';

const EMPTY_CONTEXT: AgentContext = { query: '' };

describe('Skill Router', () => {
  describe('routeMessage — skill matching', () => {
    const cases: Array<{ skill: string; messages: string[] }> = [
      {
        skill: 'build-schedule',
        messages: [
          'build a schedule please',
          'create a schedule for me',
          'generate a plan for clients',
          'make a week plan',
          'schedule building mode',
        ],
      },
      {
        skill: 'check-in',
        messages: [
          "what's on my calendar this week?",
          'how does my week look?',
          'what is on my schedule today?',
          'any upcoming appointments?',
          "what's coming next?",
          'show me tomorrow',
        ],
      },
      {
        skill: 'adjust',
        messages: [
          'move my appointment to Friday',
          'reschedule Sarah to Wednesday',
          'cancel Mrs. Johnson',
          'shift the grooming session from Tuesday to Thursday',
          'delete the booking for Rex',
          'move Sarah to 3pm',
        ],
      },
      {
        skill: 'learn',
        messages: [
          'remember that I prefer mornings',
          'I always take Wednesdays off',
          'learn that Mrs. Smith likes afternoon slots',
          'update my profile to prefer short drives',
          'what do you know about my patterns?',
          'I never work past 5pm',
        ],
      },
      {
        skill: 'report',
        messages: [
          'give me a weekly report',
          'how was my week?',
          'week summary please',
          'summarize last week',
          'weekly recap',
        ],
      },
      {
        skill: 'digest',
        messages: [
          'show me the weekly digest',
          'digest please',
          'week digest',
          'show patterns this week',
        ],
      },
      {
        skill: 'contact-clients',
        messages: [
          'email clients about the draft',
          'contact customers about confirmation',
          'send booking links to clients',
          'reach out to clients for confirmation',
          'notify customers about openings',
          'confirm with clients',
        ],
      },
      {
        skill: 'response-integration',
        messages: [
          'show me who has responded',
          'check responses',
          'who has confirmed?',
          'booking status update',
          'who declined?',
          'get confirmations',
        ],
      },
    ];

    for (const { skill, messages } of cases) {
      describe(`${skill}`, () => {
        for (const msg of messages) {
          it(`matches "${msg}"`, () => {
            const result = routeMessage(msg);
            expect(result).not.toBeNull();
            expect(result!.name).toBe(skill);
          });
        }
      });
    }
  });

  describe('routeMessage — non-matching messages return null', () => {
    const nonMatching = [
      'hello how are you',
      'tell me a joke',
      'nice to meet you',
      'thanks!',
      'goodbye',
    ];

    for (const msg of nonMatching) {
      it(`returns null for "${msg}"`, () => {
        expect(routeMessage(msg)).toBeNull();
      });
    }
  });

  describe('routeMessage — priority ordering', () => {
    it('routes "cancel the appointment" to adjust (not check-in)', () => {
      const result = routeMessage('cancel the appointment for Tuesday');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('adjust');
    });

    it('routes "contact clients about the schedule" to contact-clients', () => {
      const result = routeMessage('contact clients about the schedule');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('contact-clients');
    });

    it('routes "check responses from clients" to response-integration', () => {
      const result = routeMessage('check responses from clients');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('response-integration');
    });
  });

  describe('buildPrompt — skill-specific system prompts', () => {
    it('check-in prompt includes scheduling assistant role', () => {
      const messages = buildPrompt(
        {
          name: 'check-in',
          systemPrompt:
            'You are a scheduling assistant for a mobile pet groomer. Give a concise, friendly overview of the week ahead based on the appointments and notes provided. Highlight any weather alerts or potential conflicts.',
          piiLevel: 'full',
        },
        EMPTY_CONTEXT,
        'what is on my calendar?'
      );

      expect(messages).toHaveLength(2);
      expect(messages[0]!.role).toBe('system');
      expect(messages[0]!.content).toContain('scheduling assistant');
      expect(messages[0]!.content).toContain('mobile pet groomer');
      expect(messages[1]!.role).toBe('user');
      expect(messages[1]!.content).toBe('what is on my calendar?');
    });

    it('adjust prompt includes JSON format instructions', () => {
      const messages = buildPrompt(
        {
          name: 'adjust',
          systemPrompt: `You are a scheduling assistant. The user wants to modify an appointment.
Identify the target appointment and action from the context. Respond with a JSON block followed by a friendly confirmation message.
JSON format:
- Cancel: {"action":"cancel","appointmentId":"<uuid from context>"}
- Reschedule: {"action":"reschedule","appointmentId":"<uuid>","newStartTime":"<ISO>","newEndTime":"<ISO>"}
If you cannot identify the appointment, respond naturally asking for clarification.`,
          piiLevel: 'full',
        },
        EMPTY_CONTEXT,
        'move Sarah to Wednesday'
      );

      expect(messages[0]!.content).toContain('cancel');
      expect(messages[0]!.content).toContain('reschedule');
      expect(messages[0]!.content).toContain('appointmentId');
    });

    it('learn prompt uses anonymized piiLevel', () => {
      const messages = buildPrompt(
        {
          name: 'learn',
          systemPrompt: 'You are a scheduling assistant that learns from patterns.',
          piiLevel: 'anonymized',
        },
        EMPTY_CONTEXT,
        'remember I prefer mornings'
      );

      expect(messages[0]!.content).toContain('learns from patterns');
    });

    it('report prompt includes weekly summary instructions', () => {
      const messages = buildPrompt(
        {
          name: 'report',
          systemPrompt:
            'You are a scheduling assistant. Produce a concise weekly summary covering: appointments completed, any no-shows or cancellations, route efficiency highlights, and any patterns worth noting. Keep it under 200 words.',
          piiLevel: 'full',
        },
        EMPTY_CONTEXT,
        'weekly report'
      );

      expect(messages[0]!.content).toContain('weekly summary');
      expect(messages[0]!.content).toContain('route efficiency');
    });

    it('buildPrompt injects context into system message when provided', () => {
      const context: AgentContext = {
        query: 'test',
        schedule: {
          appointments: [
            {
              id: 'apt-1',
              clientName: 'Jane Doe',
              serviceName: 'Full Groom',
              start_time: '2026-04-01T09:00:00',
              end_time: '2026-04-01T10:00:00',
              status: 'confirmed',
              address: '123 Main St',
            },
          ],
        },
      };

      const messages = buildPrompt(
        { name: 'check-in', systemPrompt: 'You are a helper.', piiLevel: 'full' },
        context,
        'what is today?'
      );

      expect(messages[0]!.content).toContain('Jane Doe');
      expect(messages[0]!.content).toContain('Full Groom');
      expect(messages[0]!.content).toContain('Current context');
    });

    it('buildPrompt omits context section when context is empty', () => {
      const messages = buildPrompt(
        { name: 'test', systemPrompt: 'You are a helper.', piiLevel: 'full' },
        EMPTY_CONTEXT,
        'hi'
      );

      expect(messages[0]!.content).toBe('You are a helper.');
      expect(messages[0]!.content).not.toContain('Current context');
    });
  });
});
