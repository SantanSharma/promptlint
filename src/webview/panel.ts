import * as vscode from 'vscode';
import { llmService, LLMError } from '../services/llm';

/**
 * Manages the PromptLint WebView panel for interactive prompt editing
 */
export class PromptLintPanel {
    public static currentPanel: PromptLintPanel | undefined;
    private static readonly viewType = 'promptlintPanel';

    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this.panel = panel;
        this.extensionUri = extensionUri;

        // Set the webview's initial HTML content
        this.panel.webview.html = this.getHtmlContent();

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                await this.handleMessage(message);
            },
            null,
            this.disposables
        );

        // Handle panel disposal
        this.panel.onDidDispose(
            () => this.dispose(),
            null,
            this.disposables
        );
    }

    /**
     * Creates or shows the PromptLint panel
     */
    public static createOrShow(extensionUri: vscode.Uri): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If panel already exists, show it
        if (PromptLintPanel.currentPanel) {
            PromptLintPanel.currentPanel.panel.reveal(column);
            return;
        }

        // Create a new panel
        const panel = vscode.window.createWebviewPanel(
            PromptLintPanel.viewType,
            'PromptLint',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        PromptLintPanel.currentPanel = new PromptLintPanel(panel, extensionUri);
    }

    /**
     * Handles messages received from the webview
     */
    private async handleMessage(message: { command: string; text?: string }): Promise<void> {
        switch (message.command) {
            case 'refactor':
                await this.handleRefactor(message.text || '');
                break;
            case 'copyToClipboard':
                if (message.text) {
                    await vscode.env.clipboard.writeText(message.text);
                    vscode.window.showInformationMessage('Refactored prompt copied to clipboard!');
                }
                break;
            case 'openInEditor':
                if (message.text) {
                    const doc = await vscode.workspace.openTextDocument({
                        content: message.text,
                        language: 'markdown'
                    });
                    await vscode.window.showTextDocument(doc);
                }
                break;
            case 'openSettings':
                await vscode.commands.executeCommand(
                    'workbench.action.openSettings',
                    'promptlint'
                );
                break;
        }
    }

    /**
     * Handles the refactor command from the webview
     */
    private async handleRefactor(rawPrompt: string): Promise<void> {
        if (!rawPrompt.trim()) {
            this.panel.webview.postMessage({
                command: 'error',
                message: 'Please enter a prompt to refactor.'
            });
            return;
        }

        // Send loading state
        this.panel.webview.postMessage({ command: 'loading', isLoading: true });

        try {
            const refactoredPrompt = await llmService.refactorPrompt(rawPrompt);
            this.panel.webview.postMessage({
                command: 'result',
                text: refactoredPrompt
            });
        } catch (error) {
            let errorMessage = 'An unexpected error occurred.';
            
            if (error instanceof LLMError) {
                errorMessage = error.message;
                
                // Offer to open settings if API key is missing
                if (error.code === 'NO_API_KEY') {
                    this.panel.webview.postMessage({
                        command: 'error',
                        message: errorMessage,
                        showSettings: true
                    });
                    return;
                }
            }
            
            this.panel.webview.postMessage({
                command: 'error',
                message: errorMessage
            });
        } finally {
            this.panel.webview.postMessage({ command: 'loading', isLoading: false });
        }
    }

    /**
     * Disposes of the panel and its resources
     */
    public dispose(): void {
        PromptLintPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /**
     * Returns the HTML content for the webview
     */
    private getHtmlContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>PromptLint</title>
    <style>
        :root {
            --container-padding: 20px;
            --input-padding: 10px;
        }
        
        body {
            padding: var(--container-padding);
            color: var(--vscode-foreground);
            font-size: var(--vscode-font-size);
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            line-height: 1.6;
        }
        
        h1 {
            font-size: 1.5em;
            margin-bottom: 10px;
            color: var(--vscode-foreground);
        }
        
        .description {
            margin-bottom: 20px;
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
        }
        
        .section {
            margin-bottom: 20px;
        }
        
        .section-label {
            font-weight: 600;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .badge {
            font-size: 0.75em;
            padding: 2px 6px;
            border-radius: 3px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        
        textarea {
            width: 100%;
            min-height: 150px;
            padding: var(--input-padding);
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            resize: vertical;
            border-radius: 4px;
            box-sizing: border-box;
        }
        
        textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }
        
        .button-row {
            display: flex;
            gap: 10px;
            margin-top: 10px;
            flex-wrap: wrap;
        }
        
        button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: var(--vscode-font-size);
            font-family: var(--vscode-font-family);
            transition: opacity 0.2s;
        }
        
        button:hover:not(:disabled) {
            opacity: 0.9;
        }
        
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .primary-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .primary-button:hover:not(:disabled) {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .secondary-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .secondary-button:hover:not(:disabled) {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .output-area {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: var(--input-padding);
            min-height: 150px;
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            overflow-y: auto;
            max-height: 400px;
        }
        
        .output-placeholder {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        
        .error-message {
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
        }
        
        .loading {
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--vscode-descriptionForeground);
        }
        
        .spinner {
            width: 16px;
            height: 16px;
            border: 2px solid var(--vscode-descriptionForeground);
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .hidden {
            display: none !important;
        }
        
        .link-button {
            background: none;
            border: none;
            color: var(--vscode-textLink-foreground);
            text-decoration: underline;
            cursor: pointer;
            padding: 0;
            font-size: inherit;
        }
        
        .link-button:hover {
            color: var(--vscode-textLink-activeForeground);
        }
    </style>
</head>
<body>
    <h1>🔧 PromptLint</h1>
    <p class="description">
        Transform your rough prompts into clear, structured, high-quality prompts for LLMs.
        Enter your prompt below and click "Refactor Prompt" to improve it.
    </p>
    
    <div class="section">
        <div class="section-label">
            Input Prompt
            <span class="badge">Original</span>
        </div>
        <textarea 
            id="inputPrompt" 
            placeholder="Enter your prompt here...&#10;&#10;Example: write code for login"
        ></textarea>
        <div class="button-row">
            <button id="refactorBtn" class="primary-button">
                ✨ Refactor Prompt
            </button>
            <button id="clearBtn" class="secondary-button">
                Clear
            </button>
        </div>
    </div>
    
    <div id="loadingIndicator" class="loading hidden">
        <div class="spinner"></div>
        <span>Refactoring your prompt...</span>
    </div>
    
    <div id="errorContainer" class="error-message hidden"></div>
    
    <div id="outputSection" class="section hidden">
        <div class="section-label">
            Refactored Prompt
            <span class="badge">Improved</span>
        </div>
        <div id="outputArea" class="output-area"></div>
        <div class="button-row">
            <button id="copyBtn" class="primary-button">
                📋 Copy to Clipboard
            </button>
            <button id="openEditorBtn" class="secondary-button">
                📄 Open in Editor
            </button>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        // DOM Elements
        const inputPrompt = document.getElementById('inputPrompt');
        const refactorBtn = document.getElementById('refactorBtn');
        const clearBtn = document.getElementById('clearBtn');
        const loadingIndicator = document.getElementById('loadingIndicator');
        const errorContainer = document.getElementById('errorContainer');
        const outputSection = document.getElementById('outputSection');
        const outputArea = document.getElementById('outputArea');
        const copyBtn = document.getElementById('copyBtn');
        const openEditorBtn = document.getElementById('openEditorBtn');
        
        let currentOutput = '';
        
        // Event Listeners
        refactorBtn.addEventListener('click', () => {
            const text = inputPrompt.value.trim();
            if (text) {
                vscode.postMessage({ command: 'refactor', text });
            }
        });
        
        clearBtn.addEventListener('click', () => {
            inputPrompt.value = '';
            outputSection.classList.add('hidden');
            errorContainer.classList.add('hidden');
            currentOutput = '';
        });
        
        copyBtn.addEventListener('click', () => {
            if (currentOutput) {
                vscode.postMessage({ command: 'copyToClipboard', text: currentOutput });
            }
        });
        
        openEditorBtn.addEventListener('click', () => {
            if (currentOutput) {
                vscode.postMessage({ command: 'openInEditor', text: currentOutput });
            }
        });
        
        // Keyboard shortcut: Ctrl/Cmd + Enter to refactor
        inputPrompt.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                refactorBtn.click();
            }
        });
        
        // Handle messages from the extension
        window.addEventListener('message', (event) => {
            const message = event.data;
            
            switch (message.command) {
                case 'loading':
                    if (message.isLoading) {
                        loadingIndicator.classList.remove('hidden');
                        refactorBtn.disabled = true;
                        errorContainer.classList.add('hidden');
                    } else {
                        loadingIndicator.classList.add('hidden');
                        refactorBtn.disabled = false;
                    }
                    break;
                    
                case 'result':
                    currentOutput = message.text;
                    outputArea.textContent = message.text;
                    outputSection.classList.remove('hidden');
                    errorContainer.classList.add('hidden');
                    break;
                    
                case 'error':
                    let errorHtml = message.message;
                    if (message.showSettings) {
                        errorHtml += ' <button class="link-button" onclick="openSettings()">Open Settings</button>';
                    }
                    errorContainer.innerHTML = errorHtml;
                    errorContainer.classList.remove('hidden');
                    outputSection.classList.add('hidden');
                    break;
            }
        });
        
        function openSettings() {
            vscode.postMessage({ command: 'openSettings' });
        }
    </script>
</body>
</html>`;
    }
}
