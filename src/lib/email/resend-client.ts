/**
 * Resend Email Client
 *
 * Server-side only. Never import this from client components.
 * Wraps Resend SDK with typed send function and 1-retry on transient errors.
 */

import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DEFAULT_FROM = process.env.EMAIL_FROM ?? 'KE Agenda <noreply@keagenda.com>';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export type SendEmailResult =
  | { success: true; messageId: string }
  | { success: false; error: string };

function getResendClient(): Resend {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  return new Resend(RESEND_API_KEY);
}

async function attemptSend(
  resend: Resend,
  params: SendEmailParams
): Promise<SendEmailResult> {
  const { data, error } = await resend.emails.send({
    from: params.from ?? DEFAULT_FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (!data?.id) {
    return { success: false, error: 'No message ID returned from Resend' };
  }

  return { success: true, messageId: data.id };
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  let resend: Resend;

  try {
    resend = getResendClient();
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }

  const result = await attemptSend(resend, params);

  if (!result.success) {
    // Retry once on transient failures
    const isTransient = result.error.includes('rate') || result.error.includes('timeout') || result.error.includes('503') || result.error.includes('429');
    if (isTransient) {
      return attemptSend(resend, params);
    }
  }

  return result;
}
