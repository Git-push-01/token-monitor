import { v4 as uuid } from 'uuid';
import { calculateCost } from '@token-monitor/shared';
import type { UsageEventV1 } from '@token-monitor/shared';
import type { ProviderAdapter, DataEngine } from '../engine';

/**
 * Anthropic API adapter
 * Tracks usage via proxy intercept or usage API polling
 */
export class AnthropicAdapter implements ProviderAdapter {
  readonly type = 'anthropic_api' as const;
  private engine: DataEngine;
  private providerId: string;
  private apiKey: string;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(engine: DataEngine, providerId: string, apiKey: string) {
    this.engine = engine;
    this.providerId = providerId;
    this.apiKey = apiKey;
  }

  async start() {
    // Poll usage API every 60 seconds if available
    // Anthropic org usage API: GET /v1/organizations/{org}/usage
    // For now, the primary data path is via the proxy server
    console.log('[Anthropic] Adapter started for provider:', this.providerId);
  }

  async stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async testConnection(config?: { apiKey?: string }) {
    const key = config?.apiKey || this.apiKey;
    try {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
      });
      if (res.ok) return { valid: true, info: 'API key verified' };
      return { valid: false, info: `HTTP ${res.status}` };
    } catch (err: any) {
      return { valid: false, info: err.message };
    }
  }

  /**
   * Called by the proxy server when it intercepts an Anthropic API response
   */
  processResponse(responseBody: any, model: string) {
    if (!responseBody?.usage) return;

    const usage = responseBody.usage;
    const event: UsageEventV1 = {
      id: uuid(),
      ts: Date.now(),
      provider: 'anthropic_api',
      providerId: this.providerId,
      instanceId: `anthropic-${this.providerId}`,
      requestId: responseBody.id,
      model: model || responseBody.model,
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      cacheReadTokens: usage.cache_read_input_tokens || 0,
      cacheWriteTokens: usage.cache_creation_input_tokens || 0,
      costUsd: calculateCost(
        model || responseBody.model,
        usage.input_tokens || 0,
        usage.output_tokens || 0,
        usage.cache_read_input_tokens || 0,
        usage.cache_creation_input_tokens || 0
      ) ?? undefined,
      quality: 'exact',
      meta: { stopReason: responseBody.stop_reason },
    };

    this.engine.ingestEvent(event);
  }
}
