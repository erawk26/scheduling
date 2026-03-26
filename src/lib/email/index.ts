/**
 * Email module — barrel export
 */

export { sendEmail } from './resend-client';
export type { SendEmailParams, SendEmailResult } from './resend-client';

export {
  bookingInvitationTemplate,
  bookingConfirmationTemplate,
  bookingReminderTemplate,
} from './templates';
export type {
  BookingSlot,
  BookingInvitationParams,
  BookingConfirmationParams,
  BookingReminderParams,
} from './templates';
