import React, { useEffect, useRef, useCallback } from 'react';
import { Terminal, Cpu } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';

interface SnippetInfo {
  filePath: string;
  lineRange?: string;
}

interface ChatBubbleProps {
  role: 'user' | 'assistant' | 'error';
  content: string;
  snippets?: SnippetInfo[];
}

/* Short language labels */
const langShort: { [k: string]: string } = {
  javascript: 'js', typescript: 'ts', python: 'py',
  plaintext: 'txt', markdown: 'md', csharp: 'c#',
  cpp: 'c++', rust: 'rs', ruby: 'rb',
};
const shortLang = (l: string) => langShort[l] || l;

export const ChatBubble: React.FC<ChatBubbleProps> = ({ role, content, snippets }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const codeBlocksRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (containerRef.current) Prism.highlightAllUnder(containerRef.current);
  }, [content]);

  // ── Markdown → HTML ──
  const parseContent = useCallback((text: string) => {
    if (!text) return '';

    // Reset code block store for this render
    const codeBlocks = new Map<string, string>();
    codeBlocksRef.current = codeBlocks;

    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    let blockIdx = 0;

    // Code blocks — store raw code in JS Map, only put short index in DOM
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let html = text.replace(codeBlockRegex, (_, lang, code) => {
      const resolved = lang ? lang.toLowerCase() : 'plaintext';
      const label = shortLang(resolved);
      const escaped = esc(code.trim());
      const id = `cb-${blockIdx++}`;

      // Store raw code in the Map — NOT in the DOM
      codeBlocks.set(id, code.trim());

      return `<div class="code-block my-3 relative">
  <div class="flex items-center justify-between bg-[#111111] border border-[#2A2A2A] border-b-0 rounded-t-md px-3 py-1.5">
    <span class="text-[10px] font-mono text-[#4A4A4A] uppercase tracking-wider">${label}</span>
    <button class="code-copy-btn flex items-center justify-center w-6 h-6 rounded text-[#4A4A4A] hover:text-[#ECECF1] hover:bg-[#2A2A2A] transition-colors" data-cb-id="${id}" title="Copy">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
    </button>
  </div>
  <pre class="!rounded-t-none !border-t-0"><code class="language-${resolved}">${escaped}</code></pre>
</div>`;
    });

    const lines = html.split('\n');
    const out: string[] = [];
    let inList = false;
    let listTag = '';

    const inline = (s: string) => {
      let r = s.replace(/\*\*([\s\S]*?)\*\*/g, '<strong class="font-semibold text-[#ECECF1]">$1</strong>');
      r = r.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-[#1C1C1C] border border-[#2A2A2A] text-[#BDBDBD] font-mono text-[10px]">$1</code>');
      return r;
    };

    const openList = (tag: string) => {
      if (!inList || listTag !== tag) {
        closeList();
        inList = true;
        listTag = tag;
        out.push(`<${tag} class="pl-4 space-y-0.5 mb-2.5 text-[12px] list-${tag === 'ul' ? 'disc' : 'decimal'} marker:text-[#4A4A4A]">`);
      }
    };
    const closeList = () => { if (inList) { out.push(`</${listTag}>`); inList = false; } };

    lines.forEach(line => {
      const t = line.trim();

      // Skip already-rendered code block HTML
      if (t.startsWith('<div class="code-block') || t.startsWith('</pre>') ||
          t.startsWith('<pre') || t.startsWith('<div class="flex') ||
          t.startsWith('<span class="text-') || t.startsWith('<button') ||
          t.startsWith('</button>') || t.includes('</code></pre>') ||
          t.startsWith('</div>') || t.startsWith('<svg') || t.startsWith('<rect') ||
          t.startsWith('<path')) {
        out.push(line);
        return;
      }

      if (t.startsWith('### ')) {
        closeList();
        out.push(`<h4 class="text-[11px] font-semibold text-[#9E9E9E] mt-4 mb-1.5 uppercase tracking-wider">${inline(t.slice(4))}</h4>`);
      } else if (t.startsWith('## ')) {
        closeList();
        out.push(`<h3 class="text-[13px] font-semibold text-[#ECECF1] mt-4 mb-1.5 tracking-tight">${inline(t.slice(3))}</h3>`);
      } else if (t.startsWith('# ')) {
        closeList();
        out.push(`<h2 class="text-[14px] font-semibold text-[#ECECF1] mt-5 mb-2 tracking-tight">${inline(t.slice(2))}</h2>`);
      } else if (t.startsWith('- ') || t.startsWith('* ')) {
        openList('ul');
        out.push(`<li class="text-[#9E9E9E] leading-relaxed">${inline(t.slice(2))}</li>`);
      } else if (/^\d+\.\s/.test(t)) {
        openList('ol');
        out.push(`<li class="text-[#9E9E9E] leading-relaxed">${inline(t.replace(/^\d+\.\s/, ''))}</li>`);
      } else if (t === '') {
        closeList();
        out.push('<div class="h-1.5"></div>');
      } else {
        closeList();
        out.push(`<p class="text-[#9E9E9E] leading-relaxed mb-2 text-[12px]">${inline(t)}</p>`);
      }
    });

    closeList();
    return out.join('\n');
  }, []);

  // ── Copy handler — looks up code from JS Map, NOT from DOM attribute ──
  const handleCopyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest('.code-copy-btn') as HTMLElement | null;
    if (!btn) return;
    const cbId = btn.getAttribute('data-cb-id');
    if (!cbId) return;

    const code = codeBlocksRef.current.get(cbId);
    if (!code) return;

    navigator.clipboard.writeText(code).then(() => {
      const origHtml = btn.innerHTML;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>`;
      setTimeout(() => { btn.innerHTML = origHtml; }, 1500);
    });
  };

  // ── User bubble ──
  if (role === 'user') {
    return (
      <div className="animate-fadeIn select-text">
        <div className="flex items-center gap-1.5 mb-1.5 pl-0.5">
          <Terminal className="w-3 h-3 text-charcoal-600" />
          <span className="text-[10px] font-mono text-charcoal-600 uppercase tracking-wider">Error Log</span>
        </div>
        <div className="p-3.5 rounded-lg border border-charcoal-800 bg-charcoal-900 text-charcoal-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap overflow-x-auto">
          {content}
        </div>
      </div>
    );
  }

  // ── Error bubble ──
  if (role === 'error') {
    return (
      <div className="animate-fadeIn select-text">
        <div className="flex items-center gap-1.5 mb-1.5 pl-0.5">
          <WarningIcon className="w-3 h-3 text-red-500/70" />
          <span className="text-[10px] font-mono text-red-500/70 uppercase tracking-wider">Failed</span>
        </div>
        <div className="p-3.5 rounded-lg border border-red-500/10 bg-red-500/5 text-red-400/80 font-mono text-[11px] leading-relaxed">
          {content}
        </div>
      </div>
    );
  }

  // ── Assistant bubble ──
  return (
    <div className="animate-fadeIn select-text" ref={containerRef}>
      <div className="flex items-center justify-between mb-1.5 pl-0.5">
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-charcoal-500" />
          <span className="text-[10px] font-mono text-charcoal-500 uppercase tracking-wider">Resolution</span>
        </div>

        {snippets && snippets.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end">
            {snippets.map((snip, idx) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 rounded border border-charcoal-800 bg-charcoal-900 text-[9px] font-mono text-charcoal-500"
                title={`${snip.filePath} (Lines ${snip.lineRange})`}
              >
                {snip.filePath.split('/').pop()}:{snip.lineRange}
              </span>
            ))}
          </div>
        )}
      </div>

      <div
        onClick={handleCopyClick}
        className="p-4 rounded-lg border border-charcoal-800 bg-charcoal-900 text-[12px] leading-relaxed"
        dangerouslySetInnerHTML={{ __html: parseContent(content) }}
      />
    </div>
  );
};

const WarningIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);
