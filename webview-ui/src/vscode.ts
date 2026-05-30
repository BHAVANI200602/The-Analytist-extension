class VSCodeAPI {
  private vscode: any;

  constructor() {
    try {
      this.vscode = (window as any).acquireVsCodeApi();
    } catch (e) {
      this.vscode = null;
      console.warn('[The Analytist UI] acquireVsCodeApi not found. Running in dev-browser mockup mode.');
    }
  }

  public postMessage(message: any) {
    if (this.vscode) {
      this.vscode.postMessage(message);
    } else {
      console.log('[Dev Server PostMessage Link]:', message);
      // In dev mode, simulate a mock reply for testing settings/actions
      if (message.command === 'ready') {
        setTimeout(() => {
          window.postMessage({
            data: {
              command: 'initialState',
              settings: {
                defaultProvider: 'gemini',
                defaultModel: 'gemini-2.5-flash',
                customEndpoint: 'http://localhost:11434/v1',
                enableOpt: true
              },
              apiKeysStatus: {
                gemini: true,
                openai: false
              },
              workspaceFiles: ['src/App.tsx', 'src/main.tsx', 'package.json', 'tsconfig.json']
            }
          }, '*');
        }, 500);
      }
      if (message.command === 'saveApiKey') {
        setTimeout(() => {
          window.postMessage({
            data: {
              command: 'apiKeySaved',
              provider: message.provider,
              hasKey: message.apiKey.length > 0
            }
          }, '*');
        }, 500);
      }
    }
  }

  public getState() {
    if (this.vscode) {
      return this.vscode.getState();
    }
    const state = localStorage.getItem('vscode-state');
    return state ? JSON.parse(state) : null;
  }

  public setState(state: any) {
    if (this.vscode) {
      this.vscode.setState(state);
    } else {
      localStorage.setItem('vscode-state', JSON.stringify(state));
    }
  }
}

export const vscode = new VSCodeAPI();
