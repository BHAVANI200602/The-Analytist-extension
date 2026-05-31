import React, { useState, useEffect, useRef } from 'react';
import { Settings } from 'lucide-react';
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

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-charcoal-950">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-charcoal-800 bg-charcoal-950 z-30 shrink-0">
        <div>
          <span className="text-[11px] font-bold tracking-[0.14em] text-charcoal-100 uppercase select-none">
            Scapegoat
          </span>
        </div>

        <div className="flex items-center gap-2">

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
              <div className="flex flex-col items-center justify-center h-full select-none animate-fadeIn">
                <p className="text-[13px] font-semibold text-charcoal-200 tracking-tight">
                  Welcome. Let's lock in.
                </p>
                <p className="mt-1.5 text-[11px] text-charcoal-600">
                  Drop your error below — I'll help you fix it.
                </p>
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
