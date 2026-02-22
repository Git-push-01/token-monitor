import React, { useEffect, useState } from 'react';
import { useSettings } from './store/useSettings';
import { useProviders } from './store/useProviders';
import { useInstances } from './store/useInstances';
import { Onboarding } from './views/Onboarding';
import { Widget } from './views/Widget';
import { Grid } from './views/Grid';
import { CommandCenter } from './views/CommandCenter';
import { Settings } from './views/Settings';
import type { ViewMode } from '@token-monitor/shared';

type Screen = ViewMode | 'onboarding' | 'settings';

export default function App() {
  const { onboarded, persona, viewMode } = useSettings();
  const { loadProviders } = useProviders();
  const { handleUsageEvent } = useInstances();
  const [screen, setScreen] = useState<Screen>('onboarding');

  // Determine initial screen
  useEffect(() => {
    if (!onboarded) {
      setScreen('onboarding');
    } else {
      setScreen(viewMode);
    }
  }, [onboarded, viewMode]);

  // Load saved providers on mount
  useEffect(() => {
    loadProviders();
  }, []);

  // Subscribe to real-time usage events from the main process
  useEffect(() => {
    const cleanup = window.electronAPI?.onUsageEvent?.((event: any) => {
      handleUsageEvent(event);
    });
    return () => {
      cleanup?.();
    };
  }, [handleUsageEvent]);

  // Subscribe to provider status updates
  useEffect(() => {
    const cleanup = window.electronAPI?.onProviderStatus?.((update: any) => {
      const { updateProvider } = useProviders.getState();
      if (updateProvider) {
        updateProvider(update.providerId, { status: update.status });
      }
    });
    return () => {
      cleanup?.();
    };
  }, []);

  // Subscribe to budget alerts
  useEffect(() => {
    const cleanup = window.electronAPI?.onBudgetAlert?.((alert: any) => {
      // Basic notification via system notification API
      if (Notification.permission === 'granted') {
        new Notification('Token Monitor — Budget Alert', {
          body: `${alert.providerName}: ${alert.message}`,
        });
      }
    });
    return () => {
      cleanup?.();
    };
  }, []);

  // Navigation helper
  const navigate = (s: Screen) => setScreen(s);

  // Render
  const renderScreen = () => {
    switch (screen) {
      case 'onboarding':
        return <Onboarding />;
      case 'settings':
        return <Settings />;
      case 'widget':
        return <Widget />;
      case 'grid':
        return <Grid />;
      case 'command-center':
        return <CommandCenter />;
      default:
        return <Widget />;
    }
  };

  // Don't show nav during onboarding
  if (screen === 'onboarding') {
    return (
      <div className="h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        {/* Titlebar drag region */}
        <div className="titlebar h-8 flex-shrink-0" />
        <div className="flex-1 overflow-hidden">
          <Onboarding />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Titlebar drag region */}
      <div className="titlebar h-8 flex-shrink-0" />

      {/* Top navigation bar */}
      <nav className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-1">
          <NavButton
            active={screen === 'widget'}
            onClick={() => navigate('widget')}
            label="Widget"
            icon="◉"
          />
          <NavButton
            active={screen === 'grid'}
            onClick={() => navigate('grid')}
            label="Grid"
            icon="▦"
          />
          <NavButton
            active={screen === 'command-center'}
            onClick={() => navigate('command-center')}
            label="Command Center"
            icon="◈"
          />
        </div>
        <div>
          <NavButton
            active={screen === 'settings'}
            onClick={() => navigate('settings')}
            label="Settings"
            icon="⚙"
          />
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {renderScreen()}
      </main>
    </div>
  );
}

function NavButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
        active
          ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}
