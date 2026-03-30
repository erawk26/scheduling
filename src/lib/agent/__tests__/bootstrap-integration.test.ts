/**
 * INT-008: Bootstrap onboarding integration test.
 *
 * Verifies the complete 7-question bootstrap flow:
 * - Detects unconfigured agentProfile
 * - Sequential questions with profile saving after each answer
 * - bootstrap_complete flag set after 7th answer
 * - Subsequent sessions skip bootstrap
 *
 * Pattern follows integration-flow.test.ts using the localkit test double.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Wire the test double into the offlinekit import path.
// vi.mock factories can reference vi.hoisted values since both are hoisted.
const { app: mockApp } = vi.hoisted(() => {
  // Inline minimal in-memory collection factory — mirrors localkit-double
  function createCollection<T extends Record<string, unknown>>(name: string) {
    let docs: T[] = [];
    return {
      findMany(): Promise<T[]> { return Promise.resolve([...docs]) },
      create(data: T): Promise<T> {
        const doc = { ...data, _id: (data as Record<string, unknown>).id ?? name, _collection: name, _updatedAt: new Date().toISOString(), _deleted: false } as T;
        docs.push(doc);
        return Promise.resolve(doc);
      },
      update(id: string, data: Partial<T>): Promise<T | null> {
        const idx = docs.findIndex(d => (d as Record<string, unknown>).id === id);
        if (idx === -1) return Promise.resolve(null);
        docs[idx] = { ...docs[idx], ...data, _updatedAt: new Date().toISOString() } as T;
        return Promise.resolve(docs[idx]);
      },
      _reset(): void { docs = []; },
    };
  }

  const agentProfile = createCollection<Record<string, unknown>>('agentProfile');
  const agentMemories = createCollection<Record<string, unknown>>('agentMemories');
  const agentConversations = createCollection<Record<string, unknown>>('agentConversations');
  const clients = createCollection<Record<string, unknown>>('clients');
  const services = createCollection<Record<string, unknown>>('services');
  const appointments = createCollection<Record<string, unknown>>('appointments');
  const pets = createCollection<Record<string, unknown>>('pets');
  const businessProfile = createCollection<Record<string, unknown>>('businessProfile');
  const agentNotes = createCollection<Record<string, unknown>>('agentNotes');

  const app = {
    agentProfile,
    agentMemories,
    agentConversations,
    clients,
    services,
    appointments,
    pets,
    businessProfile,
    agentNotes,
  };

  return { app };
});

vi.mock('@/lib/offlinekit', () => ({ app: mockApp }));

describe('Bootstrap Onboarding Integration (INT-008)', () => {
  beforeEach(() => {
    mockApp.agentProfile._reset();
    mockApp.agentMemories._reset();
    mockApp.agentConversations._reset();
    mockApp.clients._reset();
    mockApp.services._reset();
    mockApp.appointments._reset();
    mockApp.pets._reset();
    mockApp.businessProfile._reset();
    mockApp.agentNotes._reset();
  });

  describe('Bootstrap State Detection', () => {
    it('detects unconfigured agentProfile and starts bootstrap at step 0', async () => {
      const { getBootstrapState } = await import('@/lib/agent/bootstrap');
      const state = await getBootstrapState();

      expect(state.isBootstrapping).toBe(true);
      expect(state.currentStep).toBe(0);
      expect(state.totalSteps).toBe(7);
      expect(state.currentPrompt).toBe('What should I call you?');
    });

    it('detects bootstrap completion when marked complete', async () => {
      const { getBootstrapState } = await import('@/lib/agent/bootstrap');

      // Create completed bootstrap mark
      await mockApp.agentProfile.create({
        id: 'bootstrap-complete',
        user_id: '00000000-0000-0000-0000-000000000000',
        section_id: 'bootstrap',
        content: { completed: true },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
        synced_at: null,
        deleted_at: null,
        needs_sync: 0,
        sync_operation: null,
      });

      const state = await getBootstrapState();
      expect(state.isBootstrapping).toBe(false);
      expect(state.currentStep).toBe(7);
      expect(state.currentPrompt).toBeNull();
    });
  });

  describe('Answer Saving', () => {
    it('saves preferredName to bootstrap profile on step 0', async () => {
      const { saveBootstrapAnswer, getBootstrapState } = await import('@/lib/agent/bootstrap');

      await saveBootstrapAnswer(0, 'Alex');

      const profiles = await mockApp.agentProfile.findMany();
      expect(profiles.length).toBe(1);
      expect(profiles[0]!.section_id).toBe('bootstrap');
      expect((profiles[0] as any).content.preferredName).toBe('Alex');

      // Should advance to step 1
      const state = await getBootstrapState();
      expect(state.currentStep).toBe(1);
      expect(state.currentPrompt).toBe('What kind of mobile service do you run? (e.g., dog grooming, music lessons, personal training)');
    });

    it('saves businessType to same bootstrap profile on step 1', async () => {
      const { saveBootstrapAnswer, getBootstrapState } = await import('@/lib/agent/bootstrap');

      await saveBootstrapAnswer(0, 'Alex');
      await saveBootstrapAnswer(1, 'Dog grooming');

      const profiles = await mockApp.agentProfile.findMany();
      expect(profiles.length).toBe(1); // Still one bootstrap doc
      expect((profiles[0] as any).content.preferredName).toBe('Alex');
      expect((profiles[0] as any).content.businessType).toBe('Dog grooming');

      const state = await getBootstrapState();
      expect(state.currentStep).toBe(2);
      expect(state.currentPrompt).toBe('What days do you typically work?');
    });

    it('creates work-schedule section for workDays on step 2', async () => {
      const { saveBootstrapAnswer, getBootstrapState } = await import('@/lib/agent/bootstrap');

      await saveBootstrapAnswer(0, 'Alex');
      await saveBootstrapAnswer(1, 'Dog grooming');
      await saveBootstrapAnswer(2, 'Monday through Friday');

      const profiles = await mockApp.agentProfile.findMany();
      expect(profiles.length).toBe(2); // bootstrap + work-schedule

      const workSchedule = profiles.find(p => p.section_id === 'work-schedule');
      expect(workSchedule).toBeDefined();
      expect((workSchedule as any).content.workDays).toBe('Monday through Friday');

      const state = await getBootstrapState();
      expect(state.currentStep).toBe(3);
      expect(state.currentPrompt).toBe('What are your usual start and end times?');
    });

    it('saves workHours to work-schedule section on step 3', async () => {
      const { saveBootstrapAnswer, getBootstrapState } = await import('@/lib/agent/bootstrap');

      await saveBootstrapAnswer(0, 'Alex');
      await saveBootstrapAnswer(1, 'Dog grooming');
      await saveBootstrapAnswer(2, 'Monday-Friday');
      await saveBootstrapAnswer(3, '9am to 5pm');

      const profiles = await mockApp.agentProfile.findMany();
      const workSchedule = profiles.find(p => p.section_id === 'work-schedule');
      expect(workSchedule).toBeDefined();
      expect((workSchedule as any).content.workDays).toBe('Monday-Friday');
      expect((workSchedule as any).content.workHours).toBe('9am to 5pm');

      expect(await getBootstrapState()).toMatchObject({ currentStep: 4, currentPrompt: 'What towns or areas do you cover?' });
    });

    it('creates service-area section for areas on step 4', async () => {
      const { saveBootstrapAnswer, getBootstrapState } = await import('@/lib/agent/bootstrap');

      await saveBootstrapAnswer(0, 'Alex');
      await saveBootstrapAnswer(1, 'Dog grooming');
      await saveBootstrapAnswer(2, 'Mon-Fri');
      await saveBootstrapAnswer(3, '9-5');
      await saveBootstrapAnswer(4, 'Downtown and North Side');

      const profiles = await mockApp.agentProfile.findMany();
      expect(profiles.length).toBe(3);

      const serviceArea = profiles.find(p => p.section_id === 'service-area');
      expect(serviceArea).toBeDefined();
      expect((serviceArea as any).content.areas).toBe('Downtown and North Side');

      expect(await getBootstrapState()).toMatchObject({ currentStep: 5, currentPrompt: "What's the most you're willing to drive between appointments?" });
    });

    it('creates travel-rules section for maxDriveTime on step 5', async () => {
      const { saveBootstrapAnswer, getBootstrapState } = await import('@/lib/agent/bootstrap');

      await saveBootstrapAnswer(0, 'Alex');
      await saveBootstrapAnswer(1, 'Dog grooming');
      await saveBootstrapAnswer(2, 'Mon-Fri');
      await saveBootstrapAnswer(3, '9-5');
      await saveBootstrapAnswer(4, 'Downtown');
      await saveBootstrapAnswer(5, '30 minutes');

      const profiles = await mockApp.agentProfile.findMany();
      expect(profiles.length).toBe(4);

      const travelRules = profiles.find(p => p.section_id === 'travel-rules');
      expect(travelRules).toBeDefined();
      expect((travelRules as any).content.maxDriveTime).toBe('30 minutes');

      const state = await getBootstrapState();
      expect(state.currentStep).toBe(6);
      expect(state.currentPrompt).toBe('What matters most to you: minimize driving, maximize bookings, protect days off, or cluster appointments by area?');
    });

    it('creates priorities section for topPriority on step 6 (final)', async () => {
      const { saveBootstrapAnswer, getBootstrapState } = await import('@/lib/agent/bootstrap');

      await saveBootstrapAnswer(0, 'Alex');
      await saveBootstrapAnswer(1, 'Dog grooming');
      await saveBootstrapAnswer(2, 'Mon-Fri');
      await saveBootstrapAnswer(3, '9-5');
      await saveBootstrapAnswer(4, 'Downtown');
      await saveBootstrapAnswer(5, '30 min');
      await saveBootstrapAnswer(6, 'minimize driving');

      const profiles = await mockApp.agentProfile.findMany();
      expect(profiles.length).toBe(5);

      const priorities = profiles.find(p => p.section_id === 'priorities');
      expect(priorities).toBeDefined();
      expect((priorities as any).content.topPriority).toBe('minimize driving');

      // After step 6, getBootstrapState should mark completion
      const state = await getBootstrapState();
      expect(state.isBootstrapping).toBe(false);
      expect(state.currentStep).toBe(7);
      expect(state.currentPrompt).toBeNull();
    });

    it('sets bootstrap_complete flag after all 7 answers', async () => {
      const { saveBootstrapAnswer, getBootstrapState } = await import('@/lib/agent/bootstrap');

      // Complete all 7 steps
      const steps = [
        { step: 0, answer: 'Alex' },
        { step: 1, answer: 'Dog grooming' },
        { step: 2, answer: 'Mon-Fri' },
        { step: 3, answer: '9am-5pm' },
        { step: 4, answer: 'Downtown' },
        { step: 5, answer: '30 minutes' },
        { step: 6, answer: 'minimize driving' },
      ];

      for (const { step, answer } of steps) {
        await saveBootstrapAnswer(step, answer);
      }

      // Trigger completion check
      const state = await getBootstrapState();
      expect(state.isBootstrapping).toBe(false);

      // Verify bootstrap doc has completed: true
      const profiles = await mockApp.agentProfile.findMany();
      const bootstrapDoc = profiles.find(p => p.section_id === 'bootstrap');
      expect(bootstrapDoc).toBeDefined();
      expect((bootstrapDoc as any).content.completed).toBe(true);
    });

    it('subsequent sessions skip bootstrap after completion', async () => {
      const { saveBootstrapAnswer, getBootstrapState } = await import('@/lib/agent/bootstrap');

      // Complete bootstrap
      await saveBootstrapAnswer(0, 'Alex');
      await saveBootstrapAnswer(1, 'Dog grooming');
      await saveBootstrapAnswer(2, 'Mon-Fri');
      await saveBootstrapAnswer(3, '9-5');
      await saveBootstrapAnswer(4, 'Downtown');
      await saveBootstrapAnswer(5, '30 min');
      await saveBootstrapAnswer(6, 'minimize driving');
      await getBootstrapState(); // mark complete

      // Verify state is persistent across calls
      const state1 = await getBootstrapState();
      expect(state1.isBootstrapping).toBe(false);

      const state2 = await getBootstrapState();
      expect(state2.isBootstrapping).toBe(false);
      expect(state2.currentStep).toBe(7);
      expect(state2.currentPrompt).toBeNull();
    });
  });

  describe('Bootstrap System Prompt Builder', () => {
    it('builds correct prompt for step 0 with greeting', async () => {
      const { buildBootstrapSystemPrompt } = await import('@/lib/agent/bootstrap');
      const prompt = buildBootstrapSystemPrompt(0);

      expect(prompt).toContain('What should I call you?');
      expect(prompt).toContain('step (1/7)');
      expect(prompt).toContain('Hey! I\'m your scheduling assistant');
      expect(prompt).toContain('ask ONE question at a time');
    });

    it('builds prompt for step 1 referencing previous answer', async () => {
      const { buildBootstrapSystemPrompt } = await import('@/lib/agent/bootstrap');
      const prompt = buildBootstrapSystemPrompt(1);

      expect(prompt).toContain('What kind of mobile service');
      expect(prompt).toContain('step (2/7)');
      expect(prompt).toMatch(/already answered.*What should I call you/i);
    });

    it('builds prompt for step 6 (final step)', async () => {
      const { buildBootstrapSystemPrompt } = await import('@/lib/agent/bootstrap');
      const prompt = buildBootstrapSystemPrompt(6);

      expect(prompt).toContain('step (7/7)');
      // The prompt includes the full question text about priorities
      expect(prompt).toContain('What matters most to you');
    });

    it('returns empty string for invalid step index', async () => {
      const { buildBootstrapSystemPrompt } = await import('@/lib/agent/bootstrap');
      const prompt = buildBootstrapSystemPrompt(7);
      expect(prompt).toBe('');
    });
  });

  describe('Bootstrap Steps Configuration', () => {
    it('defines correct prompts for each step via getBootstrapState', async () => {
      const { getBootstrapState } = await import('@/lib/agent/bootstrap');

      // Step 0: initial prompt
      let state = await getBootstrapState();
      expect(state.currentPrompt).toBe('What should I call you?');

      // Step 1: after answering name
      await mockApp.agentProfile.create({
        id: 'bp0', user_id: 'u', section_id: 'bootstrap', content: { preferredName: 'Alex' },
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        version: 1, synced_at: null, deleted_at: null, needs_sync: 0, sync_operation: null,
      });
      state = await getBootstrapState();
      expect(state.currentStep).toBe(1);
      expect(state.currentPrompt).toBe('What kind of mobile service do you run? (e.g., dog grooming, music lessons, personal training)');

      // Step 2: after business type
      await mockApp.agentProfile.update('bp0', { content: { preferredName: 'Alex', businessType: 'Dog grooming' } });
      state = await getBootstrapState();
      expect(state.currentStep).toBe(2);
      expect(state.currentPrompt).toBe('What days do you typically work?');

      // Step 3: after work days
      await mockApp.agentProfile.create({
        id: 'ws1', user_id: 'u', section_id: 'work-schedule', content: { workDays: 'Mon-Fri' },
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        version: 1, synced_at: null, deleted_at: null, needs_sync: 0, sync_operation: null,
      });
      state = await getBootstrapState();
      expect(state.currentStep).toBe(3);
      expect(state.currentPrompt).toBe('What are your usual start and end times?');

      // Step 4: after work hours
      await mockApp.agentProfile.update('ws1', { content: { workDays: 'Mon-Fri', workHours: '9-5' } });
      state = await getBootstrapState();
      expect(state.currentStep).toBe(4);
      expect(state.currentPrompt).toBe('What towns or areas do you cover?');

      // Step 5: after service area
      await mockApp.agentProfile.create({
        id: 'sa1', user_id: 'u', section_id: 'service-area', content: { areas: 'Downtown' },
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        version: 1, synced_at: null, deleted_at: null, needs_sync: 0, sync_operation: null,
      });
      state = await getBootstrapState();
      expect(state.currentStep).toBe(5);
      expect(state.currentPrompt).toBe("What's the most you're willing to drive between appointments?");

      // Step 6: after max drive time
      await mockApp.agentProfile.create({
        id: 'tr1', user_id: 'u', section_id: 'travel-rules', content: { maxDriveTime: '30 min' },
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        version: 1, synced_at: null, deleted_at: null, needs_sync: 0, sync_operation: null,
      });
      state = await getBootstrapState();
      expect(state.currentStep).toBe(6);
      expect(state.currentPrompt).toBe('What matters most to you: minimize driving, maximize bookings, protect days off, or cluster appointments by area?');
    });
  });
});
