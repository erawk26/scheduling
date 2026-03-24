/**
 * PII minimization layer for agent reasoning passes.
 * Replaces sensitive client data with anonymous placeholders.
 */

export type PIIMapping = Map<string, string>;

export type PIIMinimized = {
  text: string;
  mapping: PIIMapping;
};

function getInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .filter(Boolean)
    .join('.')
    .concat('.');
}

/**
 * Replace client names and addresses in text with anonymous placeholders.
 *
 * @param text - The text to anonymize (e.g. context injected into a prompt)
 * @param clients - Array of client records with name and optional address
 * @returns Anonymized text and a mapping from placeholder -> real value
 */
export function minimizePII(
  text: string,
  clients: Array<{ name: string; address?: string }>
): PIIMinimized {
  const mapping: PIIMapping = new Map();
  let result = text;
  let zoneIndex = 0;

  for (const client of clients) {
    // Replace full name with initials placeholder
    if (client.name?.trim()) {
      const initials = getInitials(client.name);
      const placeholder = initials;
      if (client.name !== placeholder) {
        mapping.set(placeholder, client.name);
        // Escape special regex chars in the original name
        const escaped = client.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(escaped, 'g'), placeholder);
      }
    }

    // Replace address with "Zone A", "Zone B", etc.
    if (client.address?.trim()) {
      const zone = `Zone ${String.fromCharCode(65 + zoneIndex)}`;
      zoneIndex++;
      mapping.set(zone, client.address);
      const escaped = client.address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'g'), zone);
    }
  }

  return { text: result, mapping };
}

/**
 * Restore PII placeholders in agent output for client-facing display.
 *
 * @param text - Agent response text with placeholders
 * @param mapping - Placeholder -> real value map from minimizePII
 */
export function restorePII(text: string, mapping: PIIMapping): string {
  let result = text;
  for (const [placeholder, real] of mapping) {
    const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), real);
  }
  return result;
}
