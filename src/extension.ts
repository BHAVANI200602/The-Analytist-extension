import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

interface APIProviderConfig {
    provider: string;
    model: string;
    apiKey: string;
    customEndpoint?: string;
}

interface MessagePayload {
    command: string;
    text?: string;
    promptId?: string;
    errorText?: string;
    provider?: string;
    model?: string;
    apiKey?: string;
    customEndpoint?: string;
    selectedFiles?: string[];
    optimizationOptions?: {
        stripComments: boolean;
        stripWhitespace: boolean;
        lineWindowSize: number;
    };
    fileName?: string;
    query?: string;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('[The Analytist Backend] Activating...');

    let cachedWebviewPanel: vscode.WebviewPanel | null = null;

    const registerWebviewMessageHandler = (panel: vscode.WebviewPanel) => {
        panel.webview.onDidReceiveMessage(async (message: MessagePayload) => {
            console.log('[The Analytist Backend] Message command:', message.command);

            try {
                if (message.command === 'ready') {
                    await sendInitialState(panel, context);
                }

                if (message.command === 'saveApiKey') {
                    if (message.provider && message.apiKey !== undefined) {
                        await context.secrets.store(`the-analytist.apiKey.${message.provider}`, message.apiKey);
                        vscode.window.showInformationMessage(`✅ Saved API Key for ${message.provider.toUpperCase()} securely.`);
                        
                        panel.webview.postMessage({
                            command: 'apiKeySaved',
                            provider: message.provider,
                            hasKey: message.apiKey.length > 0
                        });
                    }
                }

                if (message.command === 'getApiKeysStatus') {
                    const status: { [key: string]: boolean } = {};
                    const providers = ['openai', 'gemini', 'anthropic', 'openrouter', 'custom'];
                    for (const p of providers) {
                        const key = await context.secrets.get(`the-analytist.apiKey.${p}`);
                        status[p] = !!key;
                    }
                    panel.webview.postMessage({
                        command: 'apiKeysStatus',
                        status
                    });
                }

                if (message.command === 'searchWorkspaceFiles') {
                    const query = message.query || '';
                    const files = await searchWorkspaceFiles(query);
                    panel.webview.postMessage({
                        command: 'workspaceFilesList',
                        files
                    });
                }

                if (message.command === 'analyzeError') {
                    const {
                        errorText,
                        provider,
                        model,
                        customEndpoint,
                        selectedFiles = [],
                        optimizationOptions = { stripComments: true, stripWhitespace: true, lineWindowSize: 30 }
                    } = message;

                    if (!errorText || !errorText.trim()) {
                        throw new Error('Error log input is empty.');
                    }

                    const apiKey = await context.secrets.get(`the-analytist.apiKey.${provider}`);
                    if (!apiKey && provider !== 'custom') {
                        throw new Error(`API Key for ${provider?.toUpperCase()} is missing. Please save your key in Settings.`);
                    }

                    panel.webview.postMessage({ command: 'diagnosticProgress', status: 'Scanning files in stack trace...' });
                    const detectedSnippets = await autoResolveErrorFiles(errorText, optimizationOptions);

                    panel.webview.postMessage({ command: 'diagnosticProgress', status: 'Processing selected context files...' });
                    const manualSnippets = await readSelectedContextFiles(selectedFiles, optimizationOptions);

                    panel.webview.postMessage({ command: 'diagnosticProgress', status: 'Compacting payload context...' });
                    const contextSnippets = [...detectedSnippets, ...manualSnippets];
                    const uniqueSnippets = contextSnippets.filter((v, i, a) => a.findIndex(t => t.filePath === v.filePath) === i);

                    const systemPrompt = `You are "The Analytist", a highly polished, state-of-the-art AI Coding Assistant specializing in workspace diagnostics and error resolution.
Your goal is to analyze the user's compiler errors/stack trace logs alongside the relevant file code segments and output a highly accurate resolution.

Requirements:
1. Explain exactly what causes the error briefly.
2. Provide the corrected/completed code inside syntax-highlighted markdown code blocks.
3. Detail clear, step-by-step instructions or walkthroughs on how to resolve the error.
4. Keep the output extremely clean, professional, and directly actionable. Avoid fluff.`;

                    let promptContext = "### ERROR INPUT:\n" + errorText + "\n\n";
                    if (uniqueSnippets.length > 0) {
                        promptContext += "### SOURCE CODE CONTEXT:\n";
                        for (const snip of uniqueSnippets) {
                            promptContext += `\n--- File: ${snip.filePath} `;
                            if (snip.lineRange) {
                                promptContext += `(Lines ${snip.lineRange})`;
                            }
                            promptContext += ` ---\n\`\`\`${snip.language}\n${snip.content}\n\`\`\`\n`;
                        }
                    } else {
                        promptContext += "### SOURCE CODE CONTEXT:\n(No local files detected or manually added to active context.)\n";
                    }

                    panel.webview.postMessage({ command: 'diagnosticProgress', status: 'Querying selected AI engine...' });

                    const responseText = await callAIProvider({
                        provider: provider || 'gemini',
                        model: model || 'gemini-2.5-flash',
                        apiKey: apiKey || '',
                        customEndpoint: customEndpoint || ''
                    }, systemPrompt, promptContext);

                    panel.webview.postMessage({
                        command: 'analysisResult',
                        success: true,
                        result: responseText,
                        snippets: uniqueSnippets.map(s => ({ filePath: s.filePath, lineRange: s.lineRange }))
                    });
                }
            } catch (err: any) {
                console.error('[The Analytist Backend] Error:', err);
                panel.webview.postMessage({
                    command: 'analysisResult',
                    success: false,
                    error: err.message || 'An unexpected error occurred.'
                });
                vscode.window.showErrorMessage(`The Analytist: ${err.message || err}`);
            }
        }, undefined, context.subscriptions);
    };

    const openChatDisposable = vscode.commands.registerCommand('the-analytist.openChat', async () => {
        if (cachedWebviewPanel) {
            cachedWebviewPanel.reveal(vscode.ViewColumn.Two);
            return;
        }

        cachedWebviewPanel = vscode.window.createWebviewPanel(
            'theAnalytistPanel',
            'The Analytist',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'out', 'webview-ui'))]
            }
        );

        cachedWebviewPanel.onDidDispose(() => {
            cachedWebviewPanel = null;
        }, null, context.subscriptions);

        // Load Vite compiled assets
        const htmlPath = path.join(context.extensionPath, 'out', 'webview-ui', 'index.html');
        
        try {
            let htmlContent = fs.readFileSync(htmlPath, 'utf-8');
            
            // Resolve Vite assets to local webview URIs
            // Vite build is configured to output single files named index.js and index.css directly in out/webview-ui
            const jsUri = cachedWebviewPanel.webview.asWebviewUri(
                vscode.Uri.file(path.join(context.extensionPath, 'out', 'webview-ui', 'index.js'))
            );
            const cssUri = cachedWebviewPanel.webview.asWebviewUri(
                vscode.Uri.file(path.join(context.extensionPath, 'out', 'webview-ui', 'index.css'))
            );

            // Replace scripts/links inside html
            // Handles both absolute (/index.js) and relative (index.js) references
            htmlContent = htmlContent.replace(/src="\/index\.js"/g, `src="${jsUri}"`);
            htmlContent = htmlContent.replace(/src="index\.js"/g, `src="${jsUri}"`);
            htmlContent = htmlContent.replace(/href="\/index\.css"/g, `href="${cssUri}"`);
            htmlContent = htmlContent.replace(/href="index\.css"/g, `href="${cssUri}"`);

            cachedWebviewPanel.webview.html = htmlContent;
        } catch (error) {
            vscode.window.showErrorMessage('Failed to load Compiled React App. Please run "npm run compile" to bundle assets.');
            console.error('[The Analytist Backend] Loading HTML error:', error);
        }

        registerWebviewMessageHandler(cachedWebviewPanel);
    });

    const analyzeErrorDisposable = vscode.commands.registerCommand('the-analytist.analyzeError', async () => {
        const editor = vscode.window.activeTextEditor;
        let selectedText = '';
        if (editor) {
            selectedText = editor.document.getText(editor.selection).trim();
        }

        await vscode.commands.executeCommand('the-analytist.openChat');

        if (selectedText && cachedWebviewPanel) {
            cachedWebviewPanel.webview.postMessage({
                command: 'autoPasteError',
                text: selectedText
            });
        }
    });

    context.subscriptions.push(openChatDisposable, analyzeErrorDisposable);
    console.log('[The Analytist Backend] Activated.');
}

export function deactivate() {
    console.log('[The Analytist Backend] Deactivated.');
}

// Helpers

async function sendInitialState(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('the-analytist');
    const defaultProvider = config.get<string>('defaultProvider', 'gemini');
    const defaultModel = config.get<string>('defaultModel', 'gemini-2.5-flash');
    const customEndpoint = config.get<string>('customEndpoint', 'http://localhost:11434/v1');
    const enableOpt = config.get<boolean>('enableTokenOptimization', true);

    const status: { [key: string]: boolean } = {};
    const providers = ['openai', 'gemini', 'anthropic', 'openrouter', 'custom'];
    for (const p of providers) {
        const key = await context.secrets.get(`the-analytist.apiKey.${p}`);
        status[p] = !!key;
    }

    const files = await searchWorkspaceFiles('');

    panel.webview.postMessage({
        command: 'initialState',
        settings: {
            defaultProvider,
            defaultModel,
            customEndpoint,
            enableOpt
        },
        apiKeysStatus: status,
        workspaceFiles: files
    });
}

async function searchWorkspaceFiles(query: string): Promise<string[]> {
    if (!vscode.workspace.workspaceFolders) {
        return [];
    }

    try {
        const files = await vscode.workspace.findFiles(
            '**/*',
            '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/.next/**,**/out/**,**/package-lock.json,**/yarn.lock,**/pnpm-lock.yaml,**/*.png,**/*.jpg,**/*.jpeg,**/*.gif,**/*.svg,**/*.ico,**/*.woff2?,**/*.pdf,**/*.zip,**/*.tar.gz}'
        );

        let relativePaths = files.map(file => vscode.workspace.asRelativePath(file));

        if (query) {
            const q = query.toLowerCase();
            relativePaths = relativePaths.filter(p => p.toLowerCase().includes(q));
        }

        return relativePaths.slice(0, 150);
    } catch (e) {
        console.error('[The Analytist Backend] File search error:', e);
        return [];
    }
}

interface CodeSnippet {
    filePath: string;
    content: string;
    language: string;
    lineRange?: string;
}

async function autoResolveErrorFiles(
    errorText: string,
    opt: { stripComments: boolean; stripWhitespace: boolean; lineWindowSize: number }
): Promise<CodeSnippet[]> {
    const snippets: CodeSnippet[] = [];
    if (!vscode.workspace.workspaceFolders) {
        return snippets;
    }

    const patterns = [
        /(?:at\s+.*?\s+\()?([a-zA-Z0-9_\-\.\/\\ ]+\.[a-zA-Z0-9]+):(\d+)(?::(\d+))?/g,
        /File\s+"([^"]+)",\s+line\s+(\d+)/g,
        /in\s+([a-zA-Z0-9_\-\.\/\\ ]+\.[a-zA-Z0-9]+)\s+on\s+line\s+(\d+)/g
    ];

    const matchedLocations: { filePath: string; line: number }[] = [];

    for (const regex of patterns) {
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(errorText)) !== null) {
            const filePathCandidate = match[1].trim();
            const lineNumber = parseInt(match[2], 10);

            if (filePathCandidate && !isNaN(lineNumber)) {
                matchedLocations.push({ filePath: filePathCandidate, line: lineNumber });
            }
        }
    }

    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    for (const loc of matchedLocations) {
        let absolutePath = '';
        
        let testPath = path.isAbsolute(loc.filePath) ? loc.filePath : path.join(rootPath, loc.filePath);
        if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
            absolutePath = testPath;
        } else {
            const baseName = path.basename(loc.filePath);
            const foundFiles = await vscode.workspace.findFiles(`**/${baseName}`);
            if (foundFiles.length > 0) {
                absolutePath = foundFiles[0].fsPath;
            }
        }

        if (absolutePath) {
            const relPath = vscode.workspace.asRelativePath(absolutePath);
            try {
                const fileContent = fs.readFileSync(absolutePath, 'utf-8');
                const snippet = extractLineWindow(
                    relPath,
                    fileContent,
                    loc.line,
                    opt.lineWindowSize || 30,
                    opt
                );
                snippets.push(snippet);
                console.log(`[The Analytist Backend] Stack match auto-loaded: ${relPath}:${loc.line}`);
            } catch (err) {
                console.error(`[The Analytist Backend] Read failed on: ${relPath}`, err);
            }
        }
    }

    return snippets;
}

async function readSelectedContextFiles(
    selectedFiles: string[],
    opt: { stripComments: boolean; stripWhitespace: boolean; lineWindowSize: number }
): Promise<CodeSnippet[]> {
    const snippets: CodeSnippet[] = [];
    if (!vscode.workspace.workspaceFolders) {
        return snippets;
    }

    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    for (const relPath of selectedFiles) {
        const absPath = path.join(rootPath, relPath);
        if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
            try {
                const fileContent = fs.readFileSync(absPath, 'utf-8');
                const language = getLanguageFromExtension(relPath);
                
                let compressedContent = fileContent;
                if (opt.stripComments) {
                    compressedContent = stripComments(compressedContent, language);
                }
                if (opt.stripWhitespace) {
                    compressedContent = compressWhitespace(compressedContent);
                }

                snippets.push({
                    filePath: relPath,
                    content: compressedContent,
                    language,
                    lineRange: 'Full File'
                });
            } catch (err) {
                console.error(`[The Analytist Backend] Reading manual context file failed: ${relPath}`, err);
            }
        }
    }

    return snippets;
}

function extractLineWindow(
    filePath: string,
    fileContent: string,
    targetLine: number,
    windowSize: number,
    opt: { stripComments: boolean; stripWhitespace: boolean }
): CodeSnippet {
    const lines = fileContent.split(/\r?\n/);
    const totalLines = lines.length;

    const startLine = Math.max(1, targetLine - windowSize);
    const endLine = Math.min(totalLines, targetLine + windowSize);

    const slicedLines = lines.slice(startLine - 1, endLine);
    let content = slicedLines.join('\n');
    const language = getLanguageFromExtension(filePath);

    if (opt.stripComments) {
        content = stripComments(content, language);
    }
    if (opt.stripWhitespace) {
        content = compressWhitespace(content);
    }

    return {
        filePath,
        content,
        language,
        lineRange: `${startLine}-${endLine}`
    };
}

function getLanguageFromExtension(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.js': return 'javascript';
        case '.ts': return 'typescript';
        case '.tsx': return 'typescript';
        case '.jsx': return 'javascript';
        case '.py': return 'python';
        case '.html': return 'html';
        case '.css': return 'css';
        case '.json': return 'json';
        case '.md': return 'markdown';
        case '.cpp':
        case '.cc':
        case '.h': return 'cpp';
        case '.go': return 'go';
        case '.rs': return 'rust';
        case '.java': return 'java';
        case '.cs': return 'csharp';
        case '.rb': return 'ruby';
        case '.php': return 'php';
        case '.sh': return 'bash';
        default: return 'plaintext';
    }
}

function stripComments(content: string, language: string): string {
    if (['javascript', 'typescript', 'cpp', 'java', 'csharp', 'go', 'rust', 'php'].includes(language)) {
        return content
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/([^\\:]|^)\/\/.*$/gm, '$1');
    } else if (language === 'python' || language === 'bash' || language === 'ruby') {
        return content.replace(/(^|[^\\])#.*$/gm, '$1');
    } else if (language === 'html') {
        return content.replace(/<!--[\s\S]*?-->/g, '');
    } else if (language === 'css') {
        return content.replace(/\/\*[\s\S]*?\*\//g, '');
    }
    return content;
}

function compressWhitespace(content: string): string {
    return content
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+$/gm, '');
}

async function callAIProvider(
    config: APIProviderConfig,
    systemPrompt: string,
    userPrompt: string
): Promise<string> {
    const { provider, model, apiKey, customEndpoint } = config;

    console.log(`[The Analytist Backend] Querying ${provider} with model ${model}`);

    if (provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const body = {
            contents: [{
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
            }],
            generationConfig: {
                temperature: 0.1
            }
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Gemini API Error (${res.status}): ${text}`);
        }

        const data = await res.json() as any;
        const candidate = data.candidates?.[0];
        const textResponse = candidate?.content?.parts?.[0]?.text;
        if (!textResponse) {
            throw new Error('Empty response received from Gemini AI Studio.');
        }
        return textResponse;
    }

    if (provider === 'openai') {
        const url = 'https://api.openai.com/v1/chat/completions';
        const body = {
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.1
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`OpenAI API Error (${res.status}): ${text}`);
        }

        const data = await res.json() as any;
        const reply = data.choices?.[0]?.message?.content;
        if (!reply) {
            throw new Error('Empty response from OpenAI API.');
        }
        return reply;
    }

    if (provider === 'anthropic') {
        const url = 'https://api.anthropic.com/v1/messages';
        const body = {
            model: model,
            max_tokens: 4000,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
            temperature: 0.1
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Anthropic Claude API Error (${res.status}): ${text}`);
        }

        const data = await res.json() as any;
        const reply = data.content?.[0]?.text;
        if (!reply) {
            throw new Error('Empty response from Anthropic Claude.');
        }
        return reply;
    }

    if (provider === 'openrouter') {
        const url = 'https://openrouter.ai/api/v1/chat/completions';
        const body = {
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.1
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://github.com/BHAVANI200602/The-Analytist',
                'X-Title': 'The Analytist VSCode'
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`OpenRouter API Error (${res.status}): ${text}`);
        }

        const data = await res.json() as any;
        const reply = data.choices?.[0]?.message?.content;
        if (!reply) {
            throw new Error('Empty response from OpenRouter.');
        }
        return reply;
    }

    if (provider === 'custom') {
        const endpoint = customEndpoint || 'http://localhost:11434/v1';
        const cleanEndpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
        const url = `${cleanEndpoint}/chat/completions`;

        const body = {
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.1
        };

        const headers: { [key: string]: string } = {
            'Content-Type': 'application/json'
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Custom OpenAI Endpoint Error (${res.status}): ${text}`);
        }

        const data = await res.json() as any;
        const reply = data.choices?.[0]?.message?.content;
        if (!reply) {
            throw new Error('Empty response from Custom endpoint.');
        }
        return reply;
    }

    throw new Error(`Unsupported provider: ${provider}`);
}
