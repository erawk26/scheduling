import { describe, it, expect } from 'vitest';

// Test confirmation/rejection detection patterns
// These mirror the regexes in engine.ts

const CONFIRM_RE = /^(yes|confirm|do it|go ahead|ok|sure|yep|yeah)\b/i;
const REJECT_RE = /^(no|cancel|never\s*mind|stop|don't|nah)\b/i;

function isConfirmation(msg: string): boolean {
  return CONFIRM_RE.test(msg.trim());
}

function isRejection(msg: string): boolean {
  return REJECT_RE.test(msg.trim());
}

describe('Confirmation detection', () => {
  describe('isConfirmation', () => {
    const positives = [
      'yes',
      'Yes',
      'YES',
      'yes please',
      'confirm',
      'Confirm that',
      'do it',
      'go ahead',
      'ok',
      'sure',
      'yep',
      'yeah',
      'Yeah, go ahead',
    ];

    for (const msg of positives) {
      it(`"${msg}" is a confirmation`, () => {
        expect(isConfirmation(msg)).toBe(true);
      });
    }

    const negatives = [
      'no',
      'cancel',
      'move Sarah to Wednesday',
      'what appointments do I have?',
      'yesterday was great',
    ];

    for (const msg of negatives) {
      it(`"${msg}" is NOT a confirmation`, () => {
        expect(isConfirmation(msg)).toBe(false);
      });
    }
  });

  describe('isRejection', () => {
    const positives = [
      'no',
      'No',
      'NO',
      'no thanks',
      'cancel',
      'Cancel that',
      'never mind',
      'nevermind',
      'stop',
      "don't",
      'nah',
    ];

    for (const msg of positives) {
      it(`"${msg}" is a rejection`, () => {
        expect(isRejection(msg)).toBe(true);
      });
    }

    const negatives = [
      'yes',
      'confirm',
      'move Sarah to Wednesday',
      'nothing else',
    ];

    for (const msg of negatives) {
      it(`"${msg}" is NOT a rejection`, () => {
        expect(isRejection(msg)).toBe(false);
      });
    }
  });

  describe('ambiguous messages', () => {
    it('unrelated messages are neither confirm nor reject', () => {
      const msg = 'what time is my appointment?';
      expect(isConfirmation(msg)).toBe(false);
      expect(isRejection(msg)).toBe(false);
    });
  });
});
