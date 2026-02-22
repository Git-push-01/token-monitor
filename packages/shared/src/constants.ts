import type { ProviderType, ConnectionMethod, DataQuality } from './types';

// ─── Provider Definitions ────────────────────────────────────────

export interface ProviderDefinition {
  type: ProviderType;
  displayName: string;
  icon: string;
  color: string;
  connectionMethod: ConnectionMethod;
  dataQuality: DataQuality;
  description: string;
  setupUrl?: string;
  isConsumer: boolean;
}

export const PROVIDER_DEFINITIONS: Record<ProviderType, ProviderDefinition> = {
  anthropic_api: {
    type: 'anthropic_api',
    displayName: 'Anthropic API',
    icon: '🟠',
    color: '#D97706',
    connectionMethod: 'api_key',
    dataQuality: 'exact',
    description: 'Track Claude API usage with exact token counts',
    setupUrl: 'https://console.anthropic.com/settings/keys',
    isConsumer: false,
  },
  openai_api: {
    type: 'openai_api',
    displayName: 'OpenAI API',
    icon: '🟢',
    color: '#10A37F',
    connectionMethod: 'api_key',
    dataQuality: 'exact',
    description: 'Track GPT and o-series API usage',
    setupUrl: 'https://platform.openai.com/api-keys',
    isConsumer: false,
  },
  gemini_api: {
    type: 'gemini_api',
    displayName: 'Gemini API',
    icon: '🔵',
    color: '#4285F4',
    connectionMethod: 'api_key',
    dataQuality: 'exact',
    description: 'Track Google Gemini API usage',
    setupUrl: 'https://aistudio.google.com/apikey',
    isConsumer: false,
  },
  openrouter: {
    type: 'openrouter',
    displayName: 'OpenRouter',
    icon: '🟣',
    color: '#6D28D9',
    connectionMethod: 'api_key',
    dataQuality: 'exact',
    description: 'One key tracks 300+ models with exact cost in USD',
    setupUrl: 'https://openrouter.ai/settings/keys',
    isConsumer: false,
  },
  claude_code: {
    type: 'claude_code',
    displayName: 'Claude Code',
    icon: '⚡',
    color: '#F59E0B',
    connectionMethod: 'file_watcher',
    dataQuality: 'exact',
    description: 'Auto-detect from local JSONL session logs — no key needed',
    isConsumer: false,
  },

  openclaw: {
    type: 'openclaw',
    displayName: 'OpenClaw',
    icon: '🦞',
    color: '#EF4444',
    connectionMethod: 'skill',
    dataQuality: 'exact',
    description: 'Track 24/7 agent token burn via skill or proxy',
    isConsumer: false,
  },
  claude_consumer: {
    type: 'claude_consumer',
    displayName: 'Claude.ai',
    icon: '🟠',
    color: '#D97706',
    connectionMethod: 'browser_extension',
    dataQuality: 'estimated',
    description: 'Estimated usage from Claude.ai via browser extension (~85% accuracy)',
    isConsumer: true,
  },
  chatgpt_consumer: {
    type: 'chatgpt_consumer',
    displayName: 'ChatGPT',
    icon: '🟢',
    color: '#10A37F',
    connectionMethod: 'browser_extension',
    dataQuality: 'estimated',
    description: 'Estimated usage from ChatGPT via browser extension (~85% accuracy)',
    isConsumer: true,
  },
  gemini_consumer: {
    type: 'gemini_consumer',
    displayName: 'Gemini App',
    icon: '🔵',
    color: '#4285F4',
    connectionMethod: 'browser_extension',
    dataQuality: 'estimated',
    description: 'Estimated usage from Gemini via browser extension (~75% accuracy)',
    isConsumer: true,
  },
};

// ─── Ports ───────────────────────────────────────────────────────

export const PROXY_PORT = 7878;
export const WS_PORT = 7879;
export const API_PORT = 7880;

// ─── Claude Code Paths ──────────────────────────────────────────

export const CLAUDE_CODE_DIR = '.claude/projects';

// ─── Defaults ────────────────────────────────────────────────────

export const DEFAULT_BURN_RATE_SETTINGS = {
  minIncrementTokens: 10,
  maxUpdateRateHz: 4,
  smoothingAlpha: 0.2,
};

export const DEFAULT_BUDGET_THRESHOLDS = [75, 90, 100];

// ─── Tier Limits ─────────────────────────────────────────────────

export const TIER_LIMITS = {
  free: {
    maxProviders: 1,
    historyDays: 1,
    views: ['widget'] as const,
    export: false,
    budgetAlerts: false,
    teamDashboard: false,
  },
  pro: {
    maxProviders: 5,
    historyDays: 30,
    views: ['widget', 'grid'] as const,
    export: true,
    budgetAlerts: false,
    teamDashboard: false,
  },
  'pro-plus': {
    maxProviders: Infinity,
    historyDays: 365,
    views: ['widget', 'grid', 'command-center'] as const,
    export: true,
    budgetAlerts: true,
    teamDashboard: true,
  },
} as const;

export type TierName = keyof typeof TIER_LIMITS;
