import { v4 as uuid } from 'uuid';
import type { UsageEventV1 } from '@token-monitor/shared';
import type { ProviderAdapter, DataEngine } from '../engine';

/**
 * Browser extension bridge adapter
 * Receives estimated usage data from the browser extension via WebSocket
 */
export class BrowserExtAdapter implements ProviderAdapter {
  readonly type = 'claude_consumer' as const; // overridden per source
  private engine: DataEngine;
  private providerId: string;

  constructor(engine: DataEngine, providerId: string) {
    this.engine = engine;
    this.providerId = providerId;
  }

  async start() {
    // Data arrives via WebSocket server — no active polling needed
    console.log('[BrowserExt] Adapter ready, waiting for extension events');
  }

  async stop() {
    // No cleanup needed
  }

  async testConnection() {
    return { valid: true, info: 'Waiting for browser extension connection' };
  }

  /**
   * Called by the WebSocket server when extension sends a usage update
   */
  processExtensionMessage(msg: {
    source: string;
    model?: string;
    estimatedInputTokens?: number;
    estimatedOutputTokens?: number;
    messageCount?: number;
    conversationId?: string;
  }) {
    const event: UsageEventV1 = {
      id: uuid(),
      ts: Date.now(),
      provider: msg.source as any,
      providerId: this.providerId,
      instanceId: `${msg.source}-${msg.conversationId || 'default'}`,
      sessionId: msg.conversationId,
      model: msg.model,
      inputTokens: msg.estimatedInputTokens || 0,
      outputTokens: msg.estimatedOutputTokens || 0,
      quality: 'estimated',
      meta: {
        messageCount: msg.messageCount,
        source: 'browser_extension',
      },
    };

    this.engine.ingestEvent(event);
  }
}
