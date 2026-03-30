import { test as base, expect, ChatMockConfig } from '../fixtures/enhanced';

// Helper to build SSE stream for AI SDK
function makeStreamBody(text: string): string {
  const msgId = 'msg_mock_' + Math.random().toString(36).slice(2, 10);
  const lines = [
    `data: {"type":"start"}`,
    `data: {"type":"start-step"}`,
    `data: {"type":"text-start","id":"${msgId}"}`,
    `data: {"type":"text-delta","id":"${msgId}","delta":${JSON.stringify(text)}}`,
    `data: {"type":"text-end","id":"${msgId}"}`,
    `data: {"type":"finish-step"}`,
    `data: {"type":"finish","finishReason":"stop"}`,
    `data: [DONE]`,
  ];
  return lines.join('\n\n') + '\n\n';
}

function mockBootstrapResponse(page: any, responseText: string) {
  // Use the enhanced mockChatAPI with bootstrapResponse
  page.mockChatAPI({ bootstrapResponse: responseText });
}

async function sendMessage(page: any, text: string) {
  const input = page.getByPlaceholder('Message your AI scheduler');
  await input.fill(text);
  await input.press('Enter');
  await expect(input).toHaveValue('', { timeout: 5000 });
}

const test = base.extend<{ chatPage: any }>({
  chatPage: async ({ page }, use) => {
    await page.goto('/dashboard/chat');
    await use(page);
  },
});

test.describe('Bootstrap onboarding flow', () => {
  test('agent asks about preferred name when user sends first message', async ({ chatPage, mockChatAPI }) => {
    await mockChatAPI({ bootstrapResponse: "Hey! I'm your scheduling assistant. Let's get you set up — it'll only take a minute.\n\nWhat should I call you?" });

    await expect(chatPage.getByText(/what should i call you/i)).toBeVisible({ timeout: 30000 });
  });

  test('agent asks about business type after receiving preferred name', async ({ chatPage, mockChatAPI }) => {
    await mockChatAPI({ bootstrapResponse: "Great! What kind of mobile service do you run? (e.g., dog grooming, music lessons, personal training)" });

    await chatPage.getByPlaceholder(/message your ai scheduler/i).fill('Alex');
    await chatPage.getByPlaceholder(/message your ai scheduler/i).press('Enter');

    await expect(chatPage.getByText(/what kind of mobile service/i)).toBeVisible({ timeout: 30000 });

    // Verify single question only
    const responseText = await chatPage.locator('[class*="rounded-2xl"]').last().textContent();
    const hasMultipleQuestions = /what kind/i.test(responseText ?? '') && /what days/i.test(responseText ?? '');
    expect(hasMultipleQuestions).toBe(false);
  });

  test('agent asks about work days after receiving business type', async ({ chatPage, mockChatAPI }) => {
    await mockChatAPI({ bootstrapResponse: "What days do you typically work?" });

    await sendMessage(chatPage, 'Dog grooming');
    await expect(chatPage.getByText(/what days do you typically work/i)).toBeVisible({ timeout: 30000 });
  });

  test('agent asks about work hours after receiving work days', async ({ chatPage, mockChatAPI }) => {
    await mockChatAPI({ bootstrapResponse: "What are your usual start and end times?" });

    await sendMessage(chatPage, 'Monday through Friday');
    await expect(chatPage.getByText(/start and end times/i)).toBeVisible({ timeout: 30000 });
  });

  test('agent asks about service area after receiving work hours', async ({ chatPage, mockChatAPI }) => {
    await mockChatAPI({ bootstrapResponse: "What towns or areas do you cover?" });

    await sendMessage(chatPage, '9am to 5pm');
    await expect(chatPage.getByText(/towns or areas do you cover/i)).toBeVisible({ timeout: 30000 });
  });

  test('agent asks about max drive time after receiving service area', async ({ chatPage, mockChatAPI }) => {
    await mockChatAPI({ bootstrapResponse: "What's the most you're willing to drive between appointments?" });

    await sendMessage(chatPage, 'Downtown and North Side');
    await expect(chatPage.getByText(/willing to drive between appointments/i)).toBeVisible({ timeout: 30000 });
  });

  test('agent asks about top priority after receiving max drive time', async ({ chatPage, mockChatAPI }) => {
    await mockChatAPI({ bootstrapResponse: "What matters most to you: minimize driving, maximize bookings, protect days off, or cluster appointments by area?" });

    await sendMessage(chatPage, '30 minutes');
    await expect(chatPage.getByText(/minimize driving.*maximize bookings/i)).toBeVisible({ timeout: 30000 });
  });

  test('agent says all set after all bootstrap questions are answered', async ({ chatPage, mockChatAPI }) => {
    await mockChatAPI({ bootstrapResponse: "You're all set! I've saved your preferences. Now I can help you manage your schedule, clients, and appointments. What would you like to do?" });

    await sendMessage(chatPage, 'minimize driving');
    await expect(chatPage.getByText(/you're all set/i)).toBeVisible({ timeout: 30000 });
  });

  test('agent profile settings page is reachable after bootstrap completion', async ({ chatPage }) => {
    await chatPage.goto('/dashboard/settings/profile');

    await expect(chatPage).toHaveURL('/dashboard/settings/profile');
    await expect(chatPage.getByRole('heading', { name: 'Agent Profile' })).toBeVisible({ timeout: 10000 });
    await expect(chatPage.getByText('Work Schedule')).toBeVisible();
  });

  test('agent responds normally to scheduling question after bootstrap is complete', async ({ chatPage, mockChatAPI }) => {
    await mockChatAPI({ response: "You have 3 appointments this week: Monday at 10am with Sarah, Wednesday at 2pm with Tom, and Friday at 11am with Lisa." });

    await sendMessage(chatPage, 'What appointments do I have this week?');

    await expect(chatPage.getByText(/appointments this week/i)).toBeVisible({ timeout: 30000 });

    const pageContent = await chatPage.content();
    expect(pageContent).not.toMatch(/what should i call you/i);
    expect(pageContent).not.toMatch(/what kind of mobile service do you run/i);
    expect(pageContent).not.toMatch(/what days do you typically work/i);
  });

  test('user message appears in thread after sending bootstrap answer', async ({ chatPage, mockChatAPI }) => {
    await mockChatAPI({ bootstrapResponse: "Great name! What kind of mobile service do you run?" });

    await chatPage.goto('/dashboard/chat');
    const input = chatPage.getByPlaceholder(/message your ai scheduler/i);
    await input.fill('Jordan');
    await chatPage.getByPlaceholder(/message your ai scheduler/i).press('Enter');

    await expect(chatPage.getByText('Jordan')).toBeVisible({ timeout: 10000 });
  });

  test('chat input and send button are present on the chat page', async ({ chatPage }) => {
    await expect(chatPage.getByPlaceholder('Message your AI scheduler')).toBeVisible();
    await expect(chatPage.getByText('AI Scheduler')).toBeVisible();
  });

  test('send button is disabled when input is empty', async ({ chatPage }) => {
    await chatPage.goto('/dashboard/chat');
    const input = chatPage.getByPlaceholder(/message your ai scheduler/i);
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('');
  });
});
