import React from 'react';
import { ArrowUp, AlertCircle } from 'lucide-react';

interface ConsolePanelProps {
  errorInput: string;
  setErrorInput: (val: string) => void;
  onSubmit: () => void;
  isAnalyzing: boolean;
}

export const ConsolePanel: React.FC<ConsolePanelProps> = ({
  errorInput,
  setErrorInput,
  onSubmit,
  isAnalyzing,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const hasStack =
    /(?:at\s+.*?\s+\()?([a-zA-Z0-9_\-\.\/\\ ]+\.[a-zA-Z0-9]+):(\d+)/.test(errorInput) ||
    /File\s+"[^"]+",\s+line\s+(\d+)/.test(errorInput);

  return (
    <div className="px-6 pb-4 pt-2 shrink-0">
      <div className="max-w-3xl mx-auto">

        {/* Input container */}
        <div className="relative bg-charcoal-900 border border-charcoal-700 rounded-xl focus-within:border-charcoal-500 transition-colors">

          <textarea
            value={errorInput}
            onChange={e => setErrorInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste your error, stack trace, or logs here..."
            className="w-full bg-transparent resize-none text-[12px] text-charcoal-100 placeholder-charcoal-600 px-4 pt-3 pb-1.5 focus:outline-none font-mono leading-relaxed"
            rows={3}
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-3 text-[10px] text-charcoal-600 font-mono">
              <span>{errorInput.length} chars</span>
              {hasStack && (
                <span className="flex items-center gap-1 text-emerald-600">
                  <AlertCircle className="w-3 h-3" />
                  <span>Stack trace detected</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {errorInput.trim() && (
                <button
                  onClick={() => setErrorInput('')}
                  className="text-[10px] text-charcoal-600 hover:text-charcoal-300 px-2 py-0.5 transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={onSubmit}
                disabled={isAnalyzing || !errorInput.trim()}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-charcoal-100 text-charcoal-950 disabled:opacity-20 disabled:cursor-not-allowed hover:bg-white transition-colors"
                title="Analyze"
              >
                <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
