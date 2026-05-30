import React, { useState } from 'react';
import { Search, FileCode2, Check } from 'lucide-react';

interface FileSelectorProps {
  files: string[];
  selectedFiles: string[];
  onToggleFile: (file: string) => void;
  optStripComments: boolean;
  optStripWhitespace: boolean;
  optWindowSize: number;
  errorLength: number;
}

export const FileSelector: React.FC<FileSelectorProps> = ({
  files,
  selectedFiles,
  onToggleFile,
  optStripComments,
  optStripWhitespace,
  optWindowSize,
  errorLength,
}) => {
  const [search, setSearch] = useState('');

  const filteredFiles = files.filter(f =>
    f.toLowerCase().includes(search.toLowerCase())
  );

  // Token estimator
  const errorTokens = Math.round(errorLength * 0.25);
  let fileTokens = selectedFiles.length * 400;
  if (optStripComments) fileTokens = Math.round(fileTokens * 0.75);
  if (optStripWhitespace) fileTokens = Math.round(fileTokens * 0.85);
  const totalTokens = errorTokens + fileTokens;

  const getFileName = (path: string) => path.split(/[\\/]/).pop() || path;
  const getFileExt = (path: string) => {
    const name = getFileName(path);
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  };

  // Subtle colour per extension — all muted to fit theme
  const extColor = (ext: string) => {
    const map: { [k: string]: string } = {
      ts: '#BDBDBD', tsx: '#BDBDBD',
      js: '#9E9E9E', jsx: '#9E9E9E',
      py: '#9E9E9E', go: '#9E9E9E',
      css: '#9E9E9E', html: '#9E9E9E',
      json: '#6B7280', md: '#6B7280',
    };
    return map[ext] || '#4A4A4A';
  };

  return (
    <aside className="w-[220px] shrink-0 border-r border-charcoal-800 bg-charcoal-900 flex flex-col h-full select-none">

      {/* Header */}
      <div className="px-3 pt-4 pb-2 border-b border-charcoal-800">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-semibold tracking-widest text-charcoal-500 uppercase">
            Context Files
          </span>
          {selectedFiles.length > 0 && (
            <span className="text-[10px] font-mono text-charcoal-500">
              {selectedFiles.length} selected
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3 h-3 text-charcoal-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter files..."
            className="w-full bg-charcoal-800 border border-charcoal-700 rounded px-2 py-1.5 pl-7 text-[11px] text-charcoal-200 placeholder-charcoal-600 focus:outline-none focus:border-charcoal-500 transition-colors"
          />
        </div>
      </div>

      {/* File list — VS Code explorer style */}
      <div className="flex-1 overflow-y-auto py-1">
        {filteredFiles.length === 0 ? (
          <div className="px-3 py-8 text-[11px] text-charcoal-600 text-center">
            {files.length === 0 ? 'No workspace files found.' : 'No matches.'}
          </div>
        ) : (
          filteredFiles.map(file => {
            const isSelected = selectedFiles.includes(file);
            const fname = getFileName(file);
            const ext = getFileExt(file);
            return (
              <div
                key={file}
                onClick={() => onToggleFile(file)}
                title={file}
                className={`flex items-center gap-2 px-3 py-[5px] cursor-pointer transition-colors group ${
                  isSelected
                    ? 'bg-charcoal-750 text-charcoal-100'
                    : 'text-charcoal-400 hover:bg-charcoal-800 hover:text-charcoal-200'
                }`}
              >
                <FileCode2
                  className="w-3.5 h-3.5 shrink-0 transition-colors"
                  style={{ color: isSelected ? extColor(ext) : '#4A4A4A' }}
                />
                <span className="truncate flex-1 text-[11px] font-mono">{fname}</span>
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-charcoal-300 shrink-0" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Stats footer — themed, no amber */}
      <div className="px-3 py-3 border-t border-charcoal-800 text-[10px] text-charcoal-600 space-y-2">
        <div className="flex justify-between items-center">
          <span>Active line-window</span>
          <span className="font-mono text-charcoal-400">±{optWindowSize} lines</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Est. tokens load</span>
          <span className="font-mono text-charcoal-400">~{totalTokens.toLocaleString()}</span>
        </div>
      </div>
    </aside>
  );
};
