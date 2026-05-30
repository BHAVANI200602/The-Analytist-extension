import React, { useState } from 'react';
import { X, Eye, EyeOff, Key, Sliders } from 'lucide-react';
import { vscode } from '../vscode';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  provider: string;
  setProvider: (val: string) => void;
  model: string;
  setModel: (val: string) => void;
  customEndpoint: string;
  setCustomEndpoint: (val: string) => void;
  apiKeysStatus: { [key: string]: boolean };
  optStripComments: boolean;
  setOptStripComments: (val: boolean) => void;
  optStripWhitespace: boolean;
  setOptStripWhitespace: (val: boolean) => void;
  optWindowSize: number;
  setOptWindowSize: (val: number) => void;
}

const defaultModels: { [key: string]: string } = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  openrouter: 'deepseek/deepseek-chat',
  custom: 'llama3',
};

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen, onClose,
  provider, setProvider,
  model, setModel,
  customEndpoint, setCustomEndpoint,
  apiKeysStatus,
  optStripComments, setOptStripComments,
  optStripWhitespace, setOptStripWhitespace,
  optWindowSize, setOptWindowSize,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    setProvider(next);
    setModel(defaultModels[next] || '');
    setApiKeyInput('');
    setShowKey(false);
  };

  const handleSaveApiKey = () => {
    vscode.postMessage({ command: 'saveApiKey', provider, apiKey: apiKeyInput.trim() });
    setApiKeyInput('');
  };

  const isKeyConfigured = provider === 'custom' || apiKeysStatus[provider];

  // Common input styles
  const inputCls = 'w-full bg-charcoal-800 border border-charcoal-700 rounded-lg px-3 py-2 text-[11px] text-charcoal-100 placeholder-charcoal-600 focus:outline-none focus:border-charcoal-500 transition-colors font-mono';
  const labelCls = 'text-[10px] font-semibold text-charcoal-500 uppercase tracking-wider block mb-1.5';

  return (
    <section
      className={`absolute top-0 right-0 bottom-0 w-[360px] bg-charcoal-900 border-l border-charcoal-800 z-50 flex flex-col transition-transform duration-200 ${
        isOpen ? 'translate-x-0 shadow-premium' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-charcoal-800 flex items-center justify-between shrink-0">
        <span className="text-[11px] font-semibold text-charcoal-200 tracking-wide uppercase">Settings</span>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center text-charcoal-500 hover:text-charcoal-200 hover:bg-charcoal-800 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">

        {/* Provider */}
        <div>
          <label className={labelCls}>AI Provider</label>
          <select value={provider} onChange={handleProviderChange} className={inputCls}>
            <option value="gemini">Google Gemini AI Studio</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic Claude</option>
            <option value="openrouter">OpenRouter</option>
            <option value="custom">Custom (OpenAI-compatible)</option>
          </select>
        </div>

        {/* Model */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-semibold text-charcoal-500 uppercase tracking-wider">Model</label>
            <button
              onClick={() => setModel(defaultModels[provider] || '')}
              className="text-[9px] text-charcoal-600 hover:text-charcoal-300 uppercase tracking-wider transition-colors"
            >
              Reset
            </button>
          </div>
          <input
            type="text"
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder="e.g. gemini-2.5-flash"
            className={inputCls}
          />
        </div>

        {/* Custom endpoint */}
        {provider === 'custom' && (
          <div>
            <label className={labelCls}>Endpoint URL</label>
            <input
              type="text"
              value={customEndpoint}
              onChange={e => setCustomEndpoint(e.target.value)}
              placeholder="http://localhost:11434/v1"
              className={inputCls}
            />
            <p className="text-[9px] text-charcoal-600 mt-1">Must be OpenAI-compatible.</p>
          </div>
        )}

        {/* API Key */}
        <div className="p-3.5 rounded-lg border border-charcoal-800 bg-charcoal-800/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isKeyConfigured ? 'bg-emerald-500' : 'bg-red-400'}`} />
              <span className="text-[10px] font-semibold text-charcoal-300 uppercase tracking-wider">API Key</span>
            </div>
            <span className={`text-[9px] font-mono ${isKeyConfigured ? 'text-emerald-600' : 'text-red-400/60'}`}>
              {isKeyConfigured ? 'Configured' : 'Missing'}
            </span>
          </div>

          {provider !== 'custom' && (
            <>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder={`Paste ${provider} key...`}
                  className={`${inputCls} pr-8`}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-charcoal-600 hover:text-charcoal-300 transition-colors"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKeyInput.trim()}
                className="w-full py-2 rounded-lg text-[11px] font-semibold bg-charcoal-700 hover:bg-charcoal-600 disabled:opacity-30 text-charcoal-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <Key className="w-3 h-3" />
                <span>Save Key</span>
              </button>
            </>
          )}
          {provider === 'custom' && (
            <p className="text-[10px] text-charcoal-600">No key required for local endpoints.</p>
          )}
        </div>

        {/* Token Optimizations */}
        <div className="space-y-4 pt-4 border-t border-charcoal-800">
          <div className="flex items-center gap-1.5">
            <Sliders className="w-3 h-3 text-charcoal-500" />
            <span className="text-[10px] font-semibold text-charcoal-500 uppercase tracking-wider">Token Optimization</span>
          </div>

          {/* Toggle: Strip Comments */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-charcoal-200">Strip Comments</p>
              <p className="text-[9px] text-charcoal-600">Remove block/single-line comments.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={optStripComments}
                onChange={e => setOptStripComments(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-7 h-4 bg-charcoal-700 rounded-full peer peer-checked:bg-charcoal-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-charcoal-400 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3 peer-checked:after:bg-charcoal-100" />
            </label>
          </div>

          {/* Toggle: Whitespace */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-charcoal-200">Compress Whitespace</p>
              <p className="text-[9px] text-charcoal-600">Collapse repetitive spaces & newlines.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={optStripWhitespace}
                onChange={e => setOptStripWhitespace(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-7 h-4 bg-charcoal-700 rounded-full peer peer-checked:bg-charcoal-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-charcoal-400 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3 peer-checked:after:bg-charcoal-100" />
            </label>
          </div>

          {/* Slider: Window size */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-charcoal-200">Context Window</span>
              <span className="font-mono text-charcoal-400">±{optWindowSize} lines</span>
            </div>
            <input
              type="range"
              min="10" max="100" step="5"
              value={optWindowSize}
              onChange={e => setOptWindowSize(parseInt(e.target.value, 10))}
              className="w-full h-1 bg-charcoal-700 rounded-lg appearance-none cursor-pointer accent-charcoal-400"
            />
            <p className="text-[9px] text-charcoal-600">
              Lines loaded around each stack-trace reference.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
};
