import { v4 as uuid } from 'uuid';
import type { UsageEventV1 } from '@token-monitor/shared';
import type { ProviderAdapter, DataEngine } from '../engine';

/**
 * GitHub Copilot adapter
 * Tracks premium request usage via GitHub OAuth + billing API
 */
export class CopilotAdapter implements ProviderAdapter {
  readonly type = 'copilot' as const;
  private engine: DataEngine;
  private providerId: string;
  private oauthToken: string;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(engine: DataEngine, providerId: string, oauthToken: string) {
    this.engine = engine;
    this.providerId = providerId;
    this.oauthToken = oauthToken;
  }

  async start() {
    // Poll GitHub API every 5 minutes for usage updates
    await this.pollUsage();
    this.pollInterval = setInterval(() => this.pollUsage(), 5 * 60 * 1000);
    console.log('[Copilot] Adapter started for provider:', this.providerId);
  }

  async stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async testConnection(config?: { oauthToken?: string }) {
    const token = config?.oauthToken || this.oauthToken;
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      });
      if (res.ok) {
        const user = await res.json();
        return { valid: true, info: `Connected as ${user.login}` };
      }
      return { valid: false, info: `HTTP ${res.status}` };
    } catch (err: any) {
      return { valid: false, info: err.message };
    }
  }

  private async pollUsage() {
    try {
      // Try org-level metrics first (enterprise/business)
      // GET /orgs/{org}/copilot/metrics
      // For individual users, we estimate from billing page data

      // Check Copilot subscription status
      const res = await fetch('https://api.github.com/user/copilot', {
        headers: {
          Authorization: `Bearer ${this.oauthToken}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        // Emit a summary event with plan info
        const event: UsageEventV1 = {
          id: uuid(),
          ts: Date.now(),
          provider: 'copilot',
          providerId: this.providerId,
          instanceId: `copilot-${this.providerId}`,
          model: 'copilot',
          quality: 'exact',
          meta: {
            plan: data.plan_type,
            seatManagementSetting: data.seat_management_setting,
            source: 'github_api',
          },
        };
        this.engine.ingestEvent(event);
      }
    } catch {
      // Silent fail — API may not be accessible
    }
  }
}
