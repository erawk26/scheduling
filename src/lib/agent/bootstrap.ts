/**
 * Agent bootstrap — one-time onboarding ritual.
 *
 * Asks questions one at a time, saves answers to agentProfile,
 * and marks bootstrap complete when done. Like OpenClaw's BOOTSTRAP.md
 * pattern: runs once, then never again.
 */

import { app } from '@/lib/offlinekit';
import type { WithMeta } from 'mpb-localkit';

type ProfileDoc = WithMeta<{ section_id: string; content: Record<string, unknown> }>;

const BOOTSTRAP_STEPS = [
  {
    id: 'bootstrap',
    field: 'preferredName',
    prompt: 'What should I call you?',
  },
  {
    id: 'bootstrap',
    field: 'businessType',
    prompt: 'What kind of mobile service do you run? (e.g., dog grooming, music lessons, personal training)',
  },
  {
    id: 'work-schedule',
    field: 'workDays',
    prompt: 'What days do you typically work?',
  },
  {
    id: 'work-schedule',
    field: 'workHours',
    prompt: 'What are your usual start and end times?',
  },
  {
    id: 'service-area',
    field: 'areas',
    prompt: 'What towns or areas do you cover?',
  },
  {
    id: 'travel-rules',
    field: 'maxDriveTime',
    prompt: 'What\'s the most you\'re willing to drive between appointments?',
  },
  {
    id: 'priorities',
    field: 'topPriority',
    prompt: 'What matters most to you: minimize driving, maximize bookings, protect days off, or cluster appointments by area?',
  },
] as const;

export type BootstrapState = {
  isBootstrapping: boolean;
  currentStep: number;
  totalSteps: number;
  currentPrompt: string | null;
};

/**
 * Check bootstrap status. Returns the current state and the next
 * question to ask, or null if bootstrap is complete.
 */
export async function getBootstrapState(): Promise<BootstrapState> {
  const allProfiles = await app.agentProfile.findMany() as unknown as ProfileDoc[];

  // If bootstrap section exists with completed=true, we're done
  const bootstrapDoc = allProfiles.find(
    (p) => p.section_id === 'bootstrap' && (p.content as Record<string, unknown>).completed === true
  );

  if (bootstrapDoc) {
    return { isBootstrapping: false, currentStep: BOOTSTRAP_STEPS.length, totalSteps: BOOTSTRAP_STEPS.length, currentPrompt: null };
  }

  // Find the first unanswered step
  for (let i = 0; i < BOOTSTRAP_STEPS.length; i++) {
    const step = BOOTSTRAP_STEPS[i]!;
    const doc = allProfiles.find((p) => p.section_id === step.id);
    const content = doc?.content as Record<string, unknown> | undefined;

    if (!content || !content[step.field]) {
      return {
        isBootstrapping: true,
        currentStep: i,
        totalSteps: BOOTSTRAP_STEPS.length,
        currentPrompt: step.prompt,
      };
    }
  }

  // All steps answered but not marked complete — mark it now
  await markBootstrapComplete(allProfiles);
  return { isBootstrapping: false, currentStep: BOOTSTRAP_STEPS.length, totalSteps: BOOTSTRAP_STEPS.length, currentPrompt: null };
}

/**
 * Save the user's answer for the current bootstrap step.
 */
export async function saveBootstrapAnswer(stepIndex: number, answer: string): Promise<void> {
  if (stepIndex < 0 || stepIndex >= BOOTSTRAP_STEPS.length) return;
  const step = BOOTSTRAP_STEPS[stepIndex]!;

  const allProfiles = await app.agentProfile.findMany() as unknown as ProfileDoc[];
  const existing = allProfiles.find((p) => p.section_id === step.id);

  if (existing) {
    // Update existing doc
    const newContent = { ...existing.content, [step.field]: answer };
    await app.agentProfile.update(existing._id, { content: newContent } as Record<string, unknown>);
  } else {
    // Create new profile section
    const now = new Date().toISOString();
    await app.agentProfile.create({
      id: crypto.randomUUID(),
      user_id: '00000000-0000-0000-0000-000000000000',
      section_id: step.id,
      content: { [step.field]: answer },
      created_at: now,
      updated_at: now,
      version: 1,
      synced_at: null,
      deleted_at: null,
      needs_sync: 0,
      sync_operation: null,
    });
  }

  // If this was the last step, mark complete
  if (stepIndex === BOOTSTRAP_STEPS.length - 1) {
    await markBootstrapComplete(allProfiles);
  }
}

async function markBootstrapComplete(allProfiles: ProfileDoc[]): Promise<void> {
  const bootstrapDoc = allProfiles.find((p) => p.section_id === 'bootstrap');
  if (bootstrapDoc) {
    await app.agentProfile.update(bootstrapDoc._id, {
      content: { ...bootstrapDoc.content, completed: true },
    } as Record<string, unknown>);
  } else {
    const now = new Date().toISOString();
    await app.agentProfile.create({
      id: crypto.randomUUID(),
      user_id: '00000000-0000-0000-0000-000000000000',
      section_id: 'bootstrap',
      content: { completed: true },
      created_at: now,
      updated_at: now,
      version: 1,
      synced_at: null,
      deleted_at: null,
      needs_sync: 0,
      sync_operation: null,
    });
  }
}

/**
 * Build a bootstrap system prompt that makes the LLM ask one question
 * and extract the answer from the user's response.
 */
export function buildBootstrapSystemPrompt(step: number): string {
  const currentStep = BOOTSTRAP_STEPS[step];
  if (!currentStep) return '';

  const answered = BOOTSTRAP_STEPS.slice(0, step).map((s) => s.prompt);
  const progress = `(${step + 1}/${BOOTSTRAP_STEPS.length})`;

  let prompt = `You are setting up a new scheduling assistant for a mobile service professional. This is a first-time onboarding — ask ONE question at a time.

You are on step ${progress}. Ask this question naturally and conversationally:
"${currentStep.prompt}"

Rules:
- Ask ONLY this one question. Do not ask multiple questions.
- Be warm and friendly — this is a first impression.
- Keep it short — 1-2 sentences max.
- If this is the very first question (step 1), introduce yourself briefly first: "Hey! I'm your scheduling assistant. Let's get set up."`;

  if (answered.length > 0) {
    prompt += `\n- The user already answered these previous questions, so don't re-ask them: ${answered.join(', ')}`;
  }

  return prompt;
}
