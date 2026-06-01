# Scapegoat

Scapegoat is a state-of-the-art AI Coding Assistant for VS Code. It specializes in fixing errors and analyzing files directly in your workspace. Instead of manually copying and pasting stack traces, Scapegoat intelligently examines your compiler errors, retrieves the relevant source code, and provides a direct, highly accurate resolution.

## Features

- **Automated Error Diagnostics:** Highlight an error or stack trace in your editor, right-click, and select **Scapegoat: Analyze Error**. Scapegoat automatically parses the file paths and line numbers, fetching the required context.
- **Context-Aware Assistance:** Scapegoat reads your selected workspace files and automatically includes them in the prompt.
- **Multiple AI Providers:** Connect to your preferred AI models by providing API keys. Supported providers include:
  - Gemini (default: `gemini-2.5-flash`)
  - OpenAI
  - Anthropic (Claude)
  - OpenRouter
  - Custom OpenAI-compatible endpoints (e.g., Ollama, LM Studio)
- **Token Optimization:** To reduce API costs and improve speed, Scapegoat can automatically minify payloads by stripping comments, compressing whitespace, and intelligently sliding the context window around the error lines.

## Getting Started

1. Open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type **Scapegoat: Open AI Assistant**.
2. Go to the Settings tab in the Scapegoat panel to configure your default provider and enter your API keys securely.
3. Select an error stack trace in your code, right-click, and choose **Scapegoat: Analyze Error** to get instant fixes.

## API Key Storage

Your API keys are stored securely using VS Code's built-in **SecretStorage API**. This encrypts and stores the keys directly in your operating system's native credential manager (e.g., Windows Credential Manager, macOS Keychain, or Linux Secret Service).
- **To Update:** You can overwrite or save your API keys at any time through the Settings tab. The keys are not exposed as plain text in any configuration file.

## Commands

- `Scapegoat: Open AI Assistant`: Opens the main chat interface.
- `Scapegoat: Analyze Error`: Triggers error analysis on the currently selected text.

## Extension Settings

You can customize Scapegoat in the VS Code settings (`settings.json`):

- `scapegoat.defaultProvider`: Default AI service provider (e.g., `gemini`, `openai`).
- `scapegoat.defaultModel`: Default model name to use.
- `scapegoat.customEndpoint`: Base URL for Custom OpenAI-compatible providers.
- `scapegoat.enableTokenOptimization`: Automatically minimize token usage via sliding windows and comment stripping.

## Architecture

- **Backend:** Node.js-based VS Code extension host (`src/extension.ts`).
- **Frontend:** React + Vite Webview UI (`webview-ui`).
- **Communication:** Secure message passing between the VS Code extension and the Webview UI.

## License

This project is licensed under the MIT License.
