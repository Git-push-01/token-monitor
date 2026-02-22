import { v4 as uuid } from 'uuid';
import type { UsageEventV1 } from '@token-monitor/shared';
import type { ProviderAdapter, DataEngine } from '../engine';

/**
 * OpenClaw adapter
 * Receives usage data from OpenClaw skill or local proxy
 */
export class OpenClawAdapter implements ProviderAdapter {
  readonly type = 'openclaw' as const;
  private engine: DataEngine;
  private providerId: string;

  constructor(engine: DataEngine, providerId: string) {
    this.engine = engine;
    this.providerId = providerId;
  }

  async start() {
    // Data arrives via WebSocket/HTTP server — the OpenClaw skill POSTs to localhost:7879
    console.log('[OpenClaw] Adapter ready, waiting for skill events');
  }

  async stop() {
    // No cleanup needed
  }

  async testConnection() {
    return { valid: true, info: 'Ready to receive events from OpenClaw skill' };
  }

  /**
   * Called by the HTTP server when OpenClaw skill POSTs usage data
   */
  processSkillEvent(data: {
    model: string;
    usage: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
    timestamp?: number;
    skillName?: string;
    sessionId?: string;
  }) {
    const event: UsageEventV1 = {
      id: uuid(),
      ts: data.timestamp || Date.now(),
      provider: 'openclaw',
      providerId: this.providerId,
      instanceId: `openclaw-${data.skillName || 'default'}`,
      sessionId: data.sessionId,
      model: data.model,
      inputTokens: data.usage.input_tokens || 0,
      outputTokens: data.usage.output_tokens || 0,
      cacheReadTokens: data.usage.cache_read_input_tokens || 0,
      cacheWriteTokens: data.usage.cache_creation_input_tokens || 0,
      quality: 'exact',
      meta: {
        skillName: data.skillName,
        source: 'openclaw_skill',
      },
    };

    this.engine.ingestEvent(event);
  }
}
