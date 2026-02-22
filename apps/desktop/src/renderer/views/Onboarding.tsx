import React from 'react';
import { useSettings } from '../store/useSettings';
import type { PersonaType } from '@token-monitor/shared';

const PERSONAS: { type: PersonaType; emoji: string; title: string; desc: string }[] = [
  {
    type: 'casual',
    emoji: '💬',
    title: 'Casual User',
    desc: 'I use ChatGPT, Claude, or Gemini for daily tasks. Show me a simple widget — am I about to hit my limits?',
  },
  {
    type: 'builder',
    emoji: '🛠',
    title: 'Builder',
    desc: 'I have API keys across 2-5 providers. I use Claude Code. Show me token counts, costs, and sparklines.',
  },
  {
    type: 'power',
    emoji: '🦞',
    title: 'Power User',
    desc: 'I run agents 24/7, route through OpenRouter, and have multiple API keys. Give me the full command center.',
  },
];

export function Onboarding() {
  const { setPersona, setOnboarded } = useSettings();

  const handleSelect = (persona: PersonaType) => {
    setPersona(persona);
    setOnboarded(true);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 gap-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Welcome to Token Monitor</h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-md">
          One dashboard to track every AI token and dollar.
          How do you use AI?
        </p>
      </div>

      {/* Persona cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full">
        {PERSONAS.map(({ type, emoji, title, desc }) => (
          <button
            key={type}
            onClick={() => handleSelect(type)}
            className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-brand-500 dark:hover:border-brand-500 hover:shadow-lg transition-all bg-white dark:bg-gray-900 text-left"
          >
            <span className="text-4xl">{emoji}</span>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{desc}</p>
          </button>
        ))}
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        You can always change this later. Same data engine, different views.
      </p>
    </div>
  );
}
