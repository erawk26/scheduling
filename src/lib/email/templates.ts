/**
 * Email Templates
 *
 * Returns clean, mobile-friendly HTML strings with inline CSS.
 * No external dependencies — safe for server-side rendering.
 */

// ============================================================================
// Shared layout helpers
// ============================================================================

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KE Agenda</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          ${content}
        </table>
        <p style="margin-top:24px;color:#71717a;font-size:12px;text-align:center;">
          KE Agenda &mdash; Scheduling for mobile service professionals
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function header(businessName: string): string {
  return `<tr>
    <td style="background-color:#18181b;padding:24px 32px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.3px;">${escapeHtml(businessName)}</h1>
    </td>
  </tr>`;
}

function footer(): string {
  return `<tr>
    <td style="padding:24px 32px;border-top:1px solid #e4e4e7;text-align:center;">
      <p style="margin:0;color:#71717a;font-size:12px;">
        You received this email because an appointment was scheduled with ${escapeHtml('your provider')}.
      </p>
    </td>
  </tr>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================================
// Booking Invitation
// ============================================================================

export interface BookingSlot {
  label: string;
  value: string;
}

export interface BookingInvitationParams {
  businessName: string;
  serviceName: string;
  clientName: string;
  slots: BookingSlot[];
  bookingBaseUrl: string;
  deadline?: string;
}

export function bookingInvitationTemplate(params: BookingInvitationParams): string {
  const { businessName, serviceName, clientName, slots, bookingBaseUrl, deadline } = params;

  const slotButtons = slots
    .map(
      (slot) => `<tr>
      <td style="padding:4px 0;">
        <a href="${escapeHtml(bookingBaseUrl)}/book/${escapeHtml(slot.value)}"
           style="display:block;background-color:#18181b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:14px;font-weight:500;text-align:center;">
          ${escapeHtml(slot.label)}
        </a>
      </td>
    </tr>`
    )
    .join('\n');

  const deadlineNote = deadline
    ? `<p style="margin:16px 0 0;color:#ef4444;font-size:13px;text-align:center;">
        Please choose by ${escapeHtml(deadline)}.
      </p>`
    : '';

  const content = `
    ${header(businessName)}
    <tr>
      <td style="padding:32px 32px 0;">
        <h2 style="margin:0 0 8px;color:#18181b;font-size:18px;font-weight:600;">You're invited to book an appointment</h2>
        <p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
          Hi ${escapeHtml(clientName)},<br><br>
          ${escapeHtml(businessName)} would like to schedule a <strong>${escapeHtml(serviceName)}</strong> with you.
          Please select a time that works best:
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${slotButtons}
        </table>
        ${deadlineNote}
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="margin:0;color:#71717a;font-size:13px;line-height:1.6;">
          If none of these times work, reply to this email and we'll find a better time.
        </p>
      </td>
    </tr>
    ${footer()}`;

  return baseLayout(content);
}

// ============================================================================
// Booking Confirmation
// ============================================================================

export interface BookingConfirmationParams {
  businessName: string;
  serviceName: string;
  clientName: string;
  appointmentTime: string;
}

export function bookingConfirmationTemplate(params: BookingConfirmationParams): string {
  const { businessName, serviceName, clientName, appointmentTime } = params;

  const content = `
    ${header(businessName)}
    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 8px;color:#18181b;font-size:18px;font-weight:600;">Appointment confirmed</h2>
        <p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
          Hi ${escapeHtml(clientName)},<br><br>
          Your <strong>${escapeHtml(serviceName)}</strong> appointment has been confirmed.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;border-radius:6px;padding:16px 20px;">
          <tr>
            <td>
              <p style="margin:0 0 4px;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Date &amp; Time</p>
              <p style="margin:0;color:#18181b;font-size:15px;font-weight:500;">${escapeHtml(appointmentTime)}</p>
            </td>
          </tr>
          <tr><td style="padding:8px 0;"></td></tr>
          <tr>
            <td>
              <p style="margin:0 0 4px;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Service</p>
              <p style="margin:0;color:#18181b;font-size:15px;font-weight:500;">${escapeHtml(serviceName)}</p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;color:#52525b;font-size:14px;line-height:1.6;">
          We look forward to seeing you. If you need to reschedule or cancel, please contact us as soon as possible.
        </p>
      </td>
    </tr>
    ${footer()}`;

  return baseLayout(content);
}

// ============================================================================
// Booking Reminder
// ============================================================================

export interface BookingReminderParams {
  businessName: string;
  serviceName: string;
  clientName: string;
  appointmentTime: string;
}

export function bookingReminderTemplate(params: BookingReminderParams): string {
  const { businessName, serviceName, clientName, appointmentTime } = params;

  const content = `
    ${header(businessName)}
    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 8px;color:#18181b;font-size:18px;font-weight:600;">Appointment reminder</h2>
        <p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
          Hi ${escapeHtml(clientName)},<br><br>
          This is a friendly reminder about your upcoming <strong>${escapeHtml(serviceName)}</strong> appointment.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;border-radius:6px;padding:16px 20px;">
          <tr>
            <td>
              <p style="margin:0 0 4px;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">When</p>
              <p style="margin:0;color:#18181b;font-size:15px;font-weight:500;">${escapeHtml(appointmentTime)}</p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;color:#52525b;font-size:14px;line-height:1.6;">
          See you soon! If you need to make any changes, please contact ${escapeHtml(businessName)} directly.
        </p>
      </td>
    </tr>
    ${footer()}`;

  return baseLayout(content);
}
