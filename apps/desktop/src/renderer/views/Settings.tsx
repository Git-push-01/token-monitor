import React, { useState } from 'react';
import { useProviders } from '../store/useProviders';
import { useSettings } from '../store/useSettings';
import { PROVIDER_DEFINITIONS } from '@token-monitor/shared';
import type { ProviderType } from '@token-monitor/shared';

const PROVIDER_LIST = Object.entries(PROVIDER_DEFINITIONS).map(([key, def]) => ({
  ...def,
  type: key as ProviderType,
}));

function ConnectionFlow({
  providerType,
  onClose,
}: {
  providerType: ProviderType;
  onClose: () => void;
}) {
  const def = PROVIDER_DEFINITIONS[providerType];
  const { addProvider, testConnection } = useProviders();
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const needsApiKey = def.connectionMethod === 'api_key' || def.connectionMethod === 'proxy';
  const isFileWatch = def.connectionMethod === 'file_watcher';
  const isExtension = def.connectionMethod === 'browser_extension';

  const handleTest = async () => {
    setTesting(true);
    setStatus('idle');
    setErrorMsg('');
    try {
      const result = await window.electronAPI.testProvider(providerType, apiKey || undefined);
      if (result.ok) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMsg(result.error || 'Connection test failed');
      }
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e.message || 'Unexpected error');
    } finally {
      setTesting(false);
    }
  };

  const handleAdd = async () => {
    try {
      const result = await addProvider(providerType, def.displayName, apiKey ? { apiKey } : undefined);
      if (result) {
        onClose();
      } else {
        setStatus('error');
        setErrorMsg('Failed to add provider. Check the console for details.');
      }
    } catch (e: any) {
      console.error('handleAdd error:', e);
      setStatus('error');
      setErrorMsg(e.message || 'Failed to add provider');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span>{def.icon}</span> Connect {def.displayName}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl">×</button>
        </div>

        {/* Connection method specific UI */}
        {needsApiKey && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`sk-...`}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-brand-500 outline-none font-mono text-sm"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Encrypted locally with OS keychain. Never sent to any server.
            </p>
          </div>
        )}

        {isFileWatch && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg space-y-2">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">✓ Auto-detected</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Token Monitor watches <code className="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">~/.claude/projects/</code> for
              JSONL session logs. No API key needed.
            </p>
          </div>
        )}

        {isExtension && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Browser Extension Required</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Install the Token Monitor browser extension to track usage on {def.displayName}.
              It will connect automatically via WebSocket.
            </p>
          </div>
        )}

        {def.setupUrl && (
          <a
            href={def.setupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-600 hover:underline block"
          >
            Get your API key →
          </a>
        )}

        {/* Status */}
        {status === 'success' && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm text-green-700 dark:text-green-400">
            ✓ Connection successful!
          </div>
        )}
        {status === 'error' && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-700 dark:text-red-400">
            ✗ {errorMsg}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {needsApiKey && (
            <button
              onClick={handleTest}
              disabled={testing || !apiKey}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
          )}
          <button
            onClick={handleAdd}
            disabled={needsApiKey && !apiKey}
            className="flex-1 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            Add Provider
          </button>
        </div>
      </div>
    </div>
  );
}

export function Settings() {
  const { providers, removeProvider } = useProviders();
  const { persona, setPersona, theme, setTheme } = useSettings();
  const [addingProvider, setAddingProvider] = useState<ProviderType | null>(null);
  const [pairingToken, setPairingToken] = useState<string>('');
  const [showToken, setShowToken] = useState(false);

  const handleGetPairingToken = async () => {
    try {
      const token = await window.electronAPI.getPairingToken();
      setPairingToken(token);
      setShowToken(true);
    } catch {
      // ignore
    }
  };

  // Group providers: connected vs available
  const connectedTypes = new Set(providers.map((p) => p.type));
  const availableProviders = PROVIDER_LIST.filter((p) => !connectedTypes.has(p.type));

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage providers, preferences, and connections.</p>
      </div>

      {/* Connected Providers */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Connected Providers</h2>
        {providers.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">No providers connected yet.</p>
        ) : (
          <div className="space-y-2">
            {providers.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{PROVIDER_DEFINITIONS[p.type]?.icon ?? '🔌'}</span>
                  <div>
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 capitalize">{p.connectionMethod} · {p.dataQuality} quality</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${p.status === 'connected' ? 'bg-green-500' : p.status === 'error' ? 'bg-red-500' : 'bg-gray-400'}`} />
                  <button
                    onClick={() => removeProvider(p.id)}
                    className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add Provider */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Add Provider</h2>
        <div className="grid grid-cols-2 gap-2">
          {availableProviders.map((p) => (
            <button
              key={p.type}
              onClick={() => setAddingProvider(p.type)}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-brand-500 dark:hover:border-brand-500 hover:shadow-sm transition-all text-left bg-white dark:bg-gray-900"
            >
              <span className="text-xl">{p.icon}</span>
              <div>
                <div className="text-sm font-medium">{p.displayName}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 capitalize">{p.connectionMethod}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Preferences */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Preferences</h2>
        <div className="space-y-4">
          {/* Persona */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Default View</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">Choose your default dashboard persona</div>
            </div>
            <select
              value={persona}
              onChange={(e) => setPersona(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="casual">Casual</option>
              <option value="builder">Builder</option>
              <option value="power">Power User</option>
            </select>
          </div>

          {/* Theme */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Theme</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">Light, dark, or follow system</div>
            </div>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="system">System</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>
      </section>

      {/* Browser Extension */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Browser Extension</h2>
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Pair the browser extension to track consumer usage on Claude.ai, ChatGPT, and Gemini.
          </p>
          {showToken ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm font-mono select-all">{pairingToken}</code>
              <button
                onClick={() => setShowToken(false)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Hide
              </button>
            </div>
          ) : (
            <button
              onClick={handleGetPairingToken}
              className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              Show Pairing Token
            </button>
          )}
        </div>
      </section>

      {/* Data */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Data</h2>
        <div className="flex gap-2">
          <button
            onClick={() => window.electronAPI.exportData('csv')}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={() => window.electronAPI.exportData('json')}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Export JSON
          </button>
        </div>
      </section>

      {/* Version */}
      <div className="text-xs text-gray-400 dark:text-gray-500 text-center pb-4">
        Token Monitor v0.1.0 · All data stays on your machine
      </div>

      {/* Connection flow modal */}
      {addingProvider && (
        <ConnectionFlow
          providerType={addingProvider}
          onClose={() => setAddingProvider(null)}
        />
      )}
    </div>
  );
}
