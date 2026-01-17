import * as vscode from 'vscode';
import { llmService, LLMError } from './services/llm';
import { PromptLintPanel } from './webview/panel';

/**
 * Activates the PromptLint extension
 * Registers all commands and sets up the extension
 */
export function activate(context: vscode.ExtensionContext): void {
    console.log('PromptLint extension is now active');

    // Register the command to refactor selected text
    const refactorCommand = vscode.commands.registerCommand(
        'promptlint.refactorPrompt',
        () => handleRefactorSelectedPrompt()
    );

    // Register the command to open the PromptLint panel
    const openPanelCommand = vscode.commands.registerCommand(
        'promptlint.openPanel',
        () => PromptLintPanel.createOrShow(context.extensionUri)
    );

    context.subscriptions.push(refactorCommand, openPanelCommand);
}

/**
 * Handles the refactoring of selected text in the editor
 */
async function handleRefactorSelectedPrompt(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
        vscode.window.showWarningMessage('No active editor found. Please open a file first.');
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText || selectedText.trim() === '') {
        vscode.window.showWarningMessage('Please select some text to refactor.');
        return;
    }

    // Show progress indicator while refactoring
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'PromptLint: Refactoring prompt...',
            cancellable: false
        },
        async () => {
            try {
                const refactoredPrompt = await llmService.refactorPrompt(selectedText);
                await showRefactoredPrompt(editor, selection, refactoredPrompt);
            } catch (error) {
                handleError(error);
            }
        }
    );
}

/**
 * Shows the refactored prompt and offers options to the user
 */
async function showRefactoredPrompt(
    editor: vscode.TextEditor,
    selection: vscode.Selection,
    refactoredPrompt: string
): Promise<void> {
    // Ask user how they want to use the refactored prompt
    const choice = await vscode.window.showInformationMessage(
        'Prompt refactored successfully! What would you like to do?',
        'Replace Selection',
        'Open in New Tab',
        'Copy to Clipboard'
    );

    switch (choice) {
        case 'Replace Selection':
            await replaceSelection(editor, selection, refactoredPrompt);
            break;
        case 'Open in New Tab':
            await openInNewTab(refactoredPrompt);
            break;
        case 'Copy to Clipboard':
            await copyToClipboard(refactoredPrompt);
            break;
        // User dismissed the dialog - do nothing
    }
}

/**
 * Replaces the selected text with the refactored prompt
 */
async function replaceSelection(
    editor: vscode.TextEditor,
    selection: vscode.Selection,
    newText: string
): Promise<void> {
    // Confirm before replacing
    const confirm = await vscode.window.showWarningMessage(
        'This will replace your selected text. Continue?',
        { modal: true },
        'Yes, Replace'
    );

    if (confirm === 'Yes, Replace') {
        await editor.edit((editBuilder) => {
            editBuilder.replace(selection, newText);
        });
        vscode.window.showInformationMessage('Prompt replaced successfully!');
    }
}

/**
 * Opens the refactored prompt in a new editor tab
 */
async function openInNewTab(content: string): Promise<void> {
    const document = await vscode.workspace.openTextDocument({
        content: content,
        language: 'markdown'
    });
    await vscode.window.showTextDocument(document, { preview: false });
}

/**
 * Copies the refactored prompt to the clipboard
 */
async function copyToClipboard(content: string): Promise<void> {
    await vscode.env.clipboard.writeText(content);
    vscode.window.showInformationMessage('Refactored prompt copied to clipboard!');
}

/**
 * Handles errors from the LLM service
 */
function handleError(error: unknown): void {
    if (error instanceof LLMError) {
        switch (error.code) {
            case 'NO_API_KEY':
                showApiKeyError(error.message);
                break;
            case 'RATE_LIMIT':
                vscode.window.showWarningMessage(`PromptLint: ${error.message}`);
                break;
            default:
                vscode.window.showErrorMessage(`PromptLint: ${error.message}`);
        }
    } else {
        vscode.window.showErrorMessage(
            `PromptLint: An unexpected error occurred. ${error instanceof Error ? error.message : ''}`
        );
    }
}

/**
 * Shows an error message with a button to open settings
 */
async function showApiKeyError(message: string): Promise<void> {
    const action = await vscode.window.showErrorMessage(
        `PromptLint: ${message}`,
        'Open Settings'
    );

    if (action === 'Open Settings') {
        await vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'promptlint.apiKey'
        );
    }
}

/**
 * Deactivates the extension
 */
export function deactivate(): void {
    console.log('PromptLint extension is now deactivated');
}
