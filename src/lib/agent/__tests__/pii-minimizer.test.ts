import { describe, it, expect } from 'vitest';
import { minimizePII, restorePII } from '../pii-minimizer';

describe('minimizePII', () => {
  describe('name replacement', () => {
    it('replaces a full name with initials', () => {
      const { text } = minimizePII('Client: John Doe called today', [{ name: 'John Doe' }]);
      expect(text).toContain('J.D.');
      expect(text).not.toContain('John Doe');
    });

    it('replaces all occurrences of a name', () => {
      const { text } = minimizePII('John Doe and John Doe again', [{ name: 'John Doe' }]);
      expect(text).toBe('J.D. and J.D. again');
    });

    it('generates correct initials for single-name clients', () => {
      const { text } = minimizePII('Client Prince arrived', [{ name: 'Prince' }]);
      expect(text).toContain('P.');
      expect(text).not.toContain('Prince');
    });

    it('generates correct initials for three-part names', () => {
      const { text } = minimizePII('Mary Jane Watson booked', [{ name: 'Mary Jane Watson' }]);
      expect(text).toContain('M.J.W.');
      expect(text).not.toContain('Mary Jane Watson');
    });

    it('handles multiple clients with different names', () => {
      const { text } = minimizePII('Alice Smith and Bob Jones came', [
        { name: 'Alice Smith' },
        { name: 'Bob Jones' },
      ]);
      expect(text).toContain('A.S.');
      expect(text).toContain('B.J.');
      expect(text).not.toContain('Alice Smith');
      expect(text).not.toContain('Bob Jones');
    });

    it('does not replace name if initials equal name (single initial)', () => {
      // e.g. name is already "A." — no replacement loop
      const { text } = minimizePII('Client A. booked', [{ name: 'A.' }]);
      // name === placeholder, so no substitution
      expect(text).toBe('Client A. booked');
    });
  });

  describe('address replacement', () => {
    it('replaces address with Zone A', () => {
      const { text } = minimizePII('Going to 123 Main St today', [
        { name: 'John Doe', address: '123 Main St' },
      ]);
      expect(text).toContain('Zone A');
      expect(text).not.toContain('123 Main St');
    });

    it('increments zone labels for multiple addresses', () => {
      const { text } = minimizePII('123 Main St then 456 Oak Ave', [
        { name: 'John Doe', address: '123 Main St' },
        { name: 'Jane Smith', address: '456 Oak Ave' },
      ]);
      expect(text).toContain('Zone A');
      expect(text).toContain('Zone B');
    });

    it('skips zone replacement when address is empty string', () => {
      const { text } = minimizePII('No address client', [{ name: 'John Doe', address: '' }]);
      expect(text).not.toContain('Zone');
    });

    it('skips zone replacement when address is undefined', () => {
      const { text } = minimizePII('No address here', [{ name: 'John Doe' }]);
      expect(text).not.toContain('Zone');
    });

    it('handles address with special regex characters', () => {
      const addr = '123 Oak (Suite 4) St.';
      const { text } = minimizePII(`Appointment at ${addr} confirmed`, [
        { name: 'Test User', address: addr },
      ]);
      expect(text).toContain('Zone A');
      expect(text).not.toContain(addr);
    });
  });

  describe('mapping', () => {
    it('returns a mapping from initials to full name', () => {
      const { mapping } = minimizePII('John Doe', [{ name: 'John Doe' }]);
      expect(mapping.get('J.D.')).toBe('John Doe');
    });

    it('returns a mapping from zone to address', () => {
      const { mapping } = minimizePII('123 Main St', [
        { name: 'Jane', address: '123 Main St' },
      ]);
      expect(mapping.get('Zone A')).toBe('123 Main St');
    });

    it('returns empty mapping when no replacements occur', () => {
      const { mapping } = minimizePII('No clients here', []);
      expect(mapping.size).toBe(0);
    });
  });

  describe('special regex characters in names', () => {
    it('handles names with dots', () => {
      const { text } = minimizePII('Client Dr. Smith came', [{ name: 'Dr. Smith' }]);
      expect(text).not.toContain('Dr. Smith');
    });

    it('handles names with parentheses', () => {
      const name = 'Jane (Doe)';
      const { text } = minimizePII(`Client ${name} arrived`, [{ name }]);
      expect(text).not.toContain(name);
    });
  });

  describe('edge cases', () => {
    it('handles empty client list', () => {
      const input = 'No clients here';
      const { text } = minimizePII(input, []);
      expect(text).toBe(input);
    });

    it('handles empty text', () => {
      const { text } = minimizePII('', [{ name: 'John Doe' }]);
      expect(text).toBe('');
    });

    it('handles client with whitespace-only name', () => {
      const { text } = minimizePII('some text', [{ name: '   ' }]);
      expect(text).toBe('some text');
    });
  });
});

describe('restorePII', () => {
  it('restores name placeholder back to full name', () => {
    const { text, mapping } = minimizePII('Appointment with John Doe at 9am', [
      { name: 'John Doe' },
    ]);
    const restored = restorePII(text, mapping);
    expect(restored).toContain('John Doe');
  });

  it('restores address zone back to real address', () => {
    const { text, mapping } = minimizePII('Going to 456 Elm St', [
      { name: 'Jane Smith', address: '456 Elm St' },
    ]);
    const restored = restorePII(text, mapping);
    expect(restored).toContain('456 Elm St');
  });

  it('is a full round-trip for both name and address', () => {
    const original = 'Alice Brown lives at 789 Pine Rd and Alice Brown confirmed';
    const { text, mapping } = minimizePII(original, [
      { name: 'Alice Brown', address: '789 Pine Rd' },
    ]);
    expect(text).not.toContain('Alice Brown');
    expect(text).not.toContain('789 Pine Rd');
    const restored = restorePII(text, mapping);
    expect(restored).toContain('Alice Brown');
    expect(restored).toContain('789 Pine Rd');
  });

  it('restores all occurrences of a placeholder', () => {
    const { text, mapping } = minimizePII('John Doe and John Doe', [{ name: 'John Doe' }]);
    const restored = restorePII(text, mapping);
    expect(restored).toBe('John Doe and John Doe');
  });

  it('returns original text unchanged when mapping is empty', () => {
    const result = restorePII('some text', new Map());
    expect(result).toBe('some text');
  });

  it('handles special regex characters in placeholders', () => {
    // Zone A contains no special chars, but placeholder map values with special chars in addresses
    const mapping = new Map([['Zone A', '123 Oak (Suite 4) St.']]);
    const result = restorePII('Going to Zone A', mapping);
    expect(result).toBe('Going to 123 Oak (Suite 4) St.');
  });
});
