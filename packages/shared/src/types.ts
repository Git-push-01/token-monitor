// ─── Provider Types ───────────────────────────────────────────────

export type ProviderType =
  | 'anthropic_api'
  | 'openai_api'
  | 'gemini_api'
  | 'openrouter'
  | 'claude_code'
  | 'copilot'
  | 'openclaw'
  | 'claude_consumer'
  | 'chatgpt_consumer'
  | 'gemini_consumer';

export type DataQuality = 'exact' | 'estimated';

export type ConnectionMethod =
  | 'api_key'
  | 'oauth'
  | 'file_watcher'
  | 'browser_extension'
  | 'skill'
  | 'proxy';

export type ProviderStatus = 'connected' | 'disconnected' | 'error' | 'paused';

export interface Provider {
  id: string;
  type: ProviderType;
  name: string;
  displayIcon: string;
  color: string;
  dataQuality: DataQuality;
  connectionMethod: ConnectionMethod;
  status: ProviderStatus;
  isEstimated: boolean;
  config?: Record<string, unknown>;
  lastSeen?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Usage Events ────────────────────────────────────────────────

/** Canonical event envelope — every adapter emits this shape */
export interface UsageEventV1 {
  id: string;
  ts: number; // unix ms
  provider: ProviderType;
  providerId: string; // DB provider uuid
  instanceId: string; // stable key (session/agent/key label)
  sessionId?: string;
  requestId?: string;
  model?: string;

  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;

  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;

  costUsd?: number;

  quality: DataQuality;

  meta?: Record<string, unknown>;
}

// ─── Instance (live UI representation) ───────────────────────────

export interface Instance {
  id: string;
  provider: Provider;
  name: string;
  model: string;
  status: 'active' | 'paused' | 'idle' | 'error';
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  requestCount: number;
  sparklineData: number[]; // last N data points
  startedAt: Date;
  lastActivityAt: Date;
}

// ─── Budget Alerts ───────────────────────────────────────────────

export type AlertChannel = 'push' | 'slack' | 'discord' | 'email';
export type BudgetPeriod = 'daily' | 'weekly' | 'monthly';

export interface BudgetAlert {
  id: string;
  name: string;
  providerId?: string; // null = global
  period: BudgetPeriod;
  limitUsd: number;
  currentUsd: number;
  percentUsed: number;
  thresholds: number[]; // [75, 90, 100]
  notifyChannels: AlertChannel[];
  isHardCap: boolean;
}

// ─── Browser Extension Messages ──────────────────────────────────

export type ExtensionSource = 'claude_consumer' | 'chatgpt_consumer' | 'gemini_consumer';
export type ExtensionMessageType = 'usage_update' | 'handshake' | 'heartbeat';

export interface ExtensionMessage {
  source: ExtensionSource;
  type: ExtensionMessageType;
  token?: string; // pairing token
  payload: {
    model?: string;
    inputText?: string;
    outputText?: string;
    estimatedInputTokens?: number;
    estimatedOutputTokens?: number;
    messageCount?: number;
    conversationId?: string;
  };
}

// ─── View Modes ──────────────────────────────────────────────────

export type ViewMode = 'widget' | 'grid' | 'command-center';
export type PersonaType = 'casual' | 'builder' | 'power';

export interface UserPreferences {
  persona: PersonaType;
  viewMode: ViewMode;
  theme: 'light' | 'dark' | 'system';
  burnRateSettings: {
    minIncrementTokens: number; // default 10
    maxUpdateRateHz: number; // default 4
    smoothingAlpha: number; // default 0.2
  };
}

// ─── Aggregated Stats ────────────────────────────────────────────

export interface UsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheTokens: number;
  totalCostUsd: number;
  requestCount: number;
  period: 'hour' | 'day' | 'week' | 'month';
  breakdown: {
    providerId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    requestCount: number;
  }[];
}

// ─── WebSocket Protocol ──────────────────────────────────────────

export interface WSHandshake {
  type: 'handshake';
  token: string;
  clientId: string;
  version: string;
}

export interface WSHeartbeat {
  type: 'heartbeat';
  ts: number;
}

export type WSMessage = WSHandshake | WSHeartbeat | ExtensionMessage | UsageEventV1;
