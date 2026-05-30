import React, { useState, useEffect, useRef } from 'react';
import { Settings, ShieldAlert } from 'lucide-react';
import { vscode } from './vscode';
import { SettingsDrawer } from './components/SettingsDrawer';
import { FileSelector } from './components/FileSelector';
import { ConsolePanel } from './components/ConsolePanel';
import { ChatBubble } from './components/ChatBubble';

interface Message {
  role: 'user' | 'assistant' | 'error';
  content: string;
  snippets?: any[];
}

const App: React.FC = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [provider, setProvider] = useState('gemini');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [customEndpoint, setCustomEndpoint] = useState('http://localhost:11434/v1');
  const [apiKeysStatus, setApiKeysStatus] = useState<{ [key: string]: boolean }>({});
  const [workspaceFiles, setWorkspaceFiles] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [errorInput, setErrorInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loaderText, setLoaderText] = useState('Initializing...');
  const [optStripComments, setOptStripComments] = useState(true);
  const [optStripWhitespace, setOptStripWhitespace] = useState(true);
  const [optWindowSize, setOptWindowSize] = useState(30);

  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMessageEvent = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg) return;

      switch (msg.command) {
        case 'initialState':
          if (msg.settings) {
            setProvider(msg.settings.defaultProvider || 'gemini');
            setModel(msg.settings.defaultModel || 'gemini-2.5-flash');
            setCustomEndpoint(msg.settings.customEndpoint || 'http://localhost:11434/v1');
          }
          if (msg.apiKeysStatus) setApiKeysStatus(msg.apiKeysStatus);
          if (msg.workspaceFiles) setWorkspaceFiles(msg.workspaceFiles);
          break;
        case 'apiKeySaved':
          if (msg.provider) setApiKeysStatus(prev => ({ ...prev, [msg.provider]: msg.hasKey }));
          break;
        case 'apiKeysStatus':
          if (msg.status) setApiKeysStatus(msg.status);
          break;
        case 'workspaceFilesList':
          if (msg.files) setWorkspaceFiles(msg.files);
          break;
        case 'autoPasteError':
          if (msg.text) {
            setErrorInput(msg.text);
            triggerAutoRun(msg.text);
          }
          break;
        case 'diagnosticProgress':
          if (msg.status) {
            setIsAnalyzing(true);
            setLoaderText(msg.status);
          }
          break;
        case 'analysisResult':
          setIsAnalyzing(false);
          if (msg.success) {
            setMessages(prev => [...prev, { role: 'assistant', content: msg.result, snippets: msg.snippets }]);
          } else {
            setMessages(prev => [...prev, { role: 'error', content: msg.error || 'Analysis failed.' }]);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessageEvent);
    vscode.postMessage({ command: 'ready' });
    return () => window.removeEventListener('message', handleMessageEvent);
  }, []);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, isAnalyzing]);

  useEffect(() => {
    vscode.setState({ provider, model, customEndpoint, selectedFiles, optStripComments, optStripWhitespace, optWindowSize });
  }, [provider, model, customEndpoint, selectedFiles, optStripComments, optStripWhitespace, optWindowSize]);

  const handleToggleFileSelection = (file: string) => {
    setSelectedFiles(prev => prev.includes(file) ? prev.filter(f => f !== file) : [...prev, file]);
  };

  const triggerAutoRun = (pastedText: string) => {
    if (provider !== 'custom' && !apiKeysStatus[provider]) { setSettingsOpen(true); return; }
    setIsAnalyzing(true);
    setLoaderText('Resolving trace files...');
    setMessages(prev => [...prev, { role: 'user', content: pastedText }]);
    vscode.postMessage({
      command: 'analyzeError', errorText: pastedText, provider, model, customEndpoint, selectedFiles,
      optimizationOptions: { stripComments: optStripComments, stripWhitespace: optStripWhitespace, lineWindowSize: optWindowSize }
    });
  };

  const handleSubmitErrorAnalysis = () => {
    const trimmed = errorInput.trim();
    if (!trimmed || isAnalyzing) return;
    if (provider !== 'custom' && !apiKeysStatus[provider]) {
      setSettingsOpen(true);
      vscode.postMessage({ command: 'getApiKeysStatus' });
      return;
    }
    setIsAnalyzing(true);
    setLoaderText('Scanning workspace paths...');
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    vscode.postMessage({
      command: 'analyzeError', errorText: trimmed, provider, model, customEndpoint, selectedFiles,
      optimizationOptions: { stripComments: optStripComments, stripWhitespace: optStripWhitespace, lineWindowSize: optWindowSize }
    });
    setErrorInput('');
  };

  const isCredentialsMissing = provider !== 'custom' && !apiKeysStatus[provider];
  const isOptimized = optStripComments || optStripWhitespace;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-charcoal-950">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-charcoal-800 bg-charcoal-950 z-30 shrink-0">
        <div>
          <span className="text-[11px] font-bold tracking-[0.14em] text-charcoal-100 uppercase select-none">
            The Analytist
          </span>
          <span className="ml-2.5 text-[9px] text-charcoal-600 tracking-widest uppercase select-none">
            AI Error Assistant
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Token optimisation badge */}
          <button
            onClick={() => setSettingsOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] cursor-pointer transition select-none ${
              isOptimized
                ? 'border-charcoal-700 text-emerald-500/80 hover:border-charcoal-600'
                : 'border-charcoal-800 text-charcoal-600 hover:border-charcoal-700 hover:text-charcoal-400'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOptimized ? 'bg-emerald-500 animate-pulse' : 'bg-charcoal-600'}`} />
            <span>{isOptimized ? 'Optimized' : 'Full payload'}</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="w-7 h-7 flex items-center justify-center rounded text-charcoal-500 hover:text-charcoal-200 hover:bg-charcoal-800 transition"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Sidebar */}
        <FileSelector
          files={workspaceFiles}
          selectedFiles={selectedFiles}
          onToggleFile={handleToggleFileSelection}
          optStripComments={optStripComments}
          optStripWhitespace={optStripWhitespace}
          optWindowSize={optWindowSize}
          errorLength={errorInput.length}
        />

        {/* Chat panel */}
        <section className="flex-1 flex flex-col bg-charcoal-950 overflow-hidden relative">

          {/* Messages scroll area */}
          <div ref={scrollerRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
            {messages.length === 0 ? (

              /* ── Welcome state ── */
              <div className="max-w-md mx-auto pt-10 space-y-8 select-none animate-fadeIn">
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-charcoal-100 tracking-tight">
                    Paste an error. Get a solution.
                  </h2>
                  <p className="text-[12px] text-charcoal-500 leading-relaxed">
                    The Analytist reads your workspace files and generates a precise,
                    step-by-step recovery guide for any terminal error or stack trace.
                  </p>
                </div>

                {/* Steps */}
                <div className="border-t border-charcoal-800">
                  {[
                    {
                      n: '01',
                      title: 'Paste Error',
                      desc: 'Copy full tracebacks from terminal or the VS Code Problems panel.',
                    },
                    {
                      n: '02',
                      title: 'Auto Trace Parse',
                      desc: 'File and line references are detected. Code windows extracted automatically.',
                    },
                    {
                      n: '03',
                      title: 'Recovery Guide',
                      desc: 'Step-by-step walkthrough with copyable code fixes generated with high accuracy.',
                    },
                  ].map(step => (
                    <div key={step.n} className="flex items-start gap-5 py-4 border-b border-charcoal-800">
                      <span className="text-[10px] font-mono text-charcoal-600 mt-0.5 w-5 shrink-0">{step.n}</span>
                      <div>
                        <p className="text-[12px] font-medium text-charcoal-200 mb-0.5">{step.title}</p>
                        <p className="text-[11px] text-charcoal-500 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* API key warning */}
                {isCredentialsMissing && (
                  <div className="p-3 rounded-lg border border-red-500/15 bg-red-500/5 flex items-start gap-3">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="text-[11px]">
                      <p className="font-medium text-red-300 mb-0.5">API key not configured</p>
                      <p className="text-red-400/60">
                        No key saved for {provider.toUpperCase()}. Open settings to add credentials.
                      </p>
                    </div>
                  </div>
                )}
              </div>

            ) : (

              /* ── Chat messages ── */
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((msg, idx) => (
                  <ChatBubble key={idx} role={msg.role} content={msg.content} snippets={msg.snippets} />
                ))}
              </div>

            )}
          </div>

          {/* Analysing indicator */}
          {isAnalyzing && (
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-charcoal-700 bg-charcoal-900 text-[11px] font-mono text-charcoal-400 absolute bottom-28 left-1/2 -translate-x-1/2 z-30 select-none">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-charcoal-400 rounded-full thinking-bounce" />
                <span className="w-1.5 h-1.5 bg-charcoal-400 rounded-full thinking-bounce [animation-delay:-0.16s]" />
                <span className="w-1.5 h-1.5 bg-charcoal-400 rounded-full thinking-bounce [animation-delay:-0.32s]" />
              </div>
              <span>{loaderText}</span>
            </div>
          )}

          {/* Input */}
          <ConsolePanel
            errorInput={errorInput}
            setErrorInput={setErrorInput}
            onSubmit={handleSubmitErrorAnalysis}
            isAnalyzing={isAnalyzing}
          />
        </section>

        {/* Settings drawer */}
        <SettingsDrawer
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          provider={provider}
          setProvider={setProvider}
          model={model}
          setModel={setModel}
          customEndpoint={customEndpoint}
          setCustomEndpoint={setCustomEndpoint}
          apiKeysStatus={apiKeysStatus}
          optStripComments={optStripComments}
          setOptStripComments={setOptStripComments}
          optStripWhitespace={optStripWhitespace}
          setOptStripWhitespace={setOptStripWhitespace}
          optWindowSize={optWindowSize}
          setOptWindowSize={setOptWindowSize}
        />
      </div>
    </div>
  );
};

export default App;
