/**
 * Messaging bridge types — normalizes inbound/outbound messages across platforms.
 */

export interface NormalizedMessage {
  id: string;
  platform: 'telegram' | 'whatsapp' | 'imessage';
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  replyToId?: string;
  metadata?: Record<string, unknown>;
}

export interface OutboundMessage {
  platform: string;
  recipientId: string;
  text: string;
  replyToId?: string;
}

export interface PlatformAdapter {
  platform: string;
  parseInbound(raw: unknown): NormalizedMessage | null;
  formatOutbound(msg: OutboundMessage): unknown;
  sendMessage(recipientId: string, text: string, replyToId?: string): Promise<boolean>;
  verifyWebhook?(headers: Headers): boolean;
}

export interface BridgeConfig {
  adapters: PlatformAdapter[];
}
