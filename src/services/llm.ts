import * as vscode from 'vscode';

/**
 * System prompt that instructs the LLM to act as a prompt engineering expert.
 * This prompt guides the LLM to refactor user prompts without answering them.
 */
export const SYSTEM_PROMPT = `You are an expert prompt engineer specializing in crafting high-quality prompts for Large Language Models (LLMs) like ChatGPT, Claude, and other AI systems.

Your task is to REFACTOR and IMPROVE the user's prompt. You must NOT answer or respond to the prompt itself.

## Your Refactoring Guidelines:

1. **Clarity**: Remove vague language, ambiguous terms, and unclear instructions
2. **Structure**: Organize the prompt with clear sections when appropriate:
   - Role/Persona (if beneficial)
   - Context/Background
   - Task/Objective
   - Constraints/Requirements
   - Output Format
3. **Specificity**: Add specific details, examples, or constraints where the original is too vague
4. **Intent Preservation**: Maintain the original intent and goal of the prompt
5. **Actionability**: Ensure the prompt gives the LLM clear, actionable instructions

## Output Format:

Provide ONLY the refactored prompt. Do not include:
- Explanations of your changes
- Commentary about the original prompt
- Answers to the prompt
- Meta-discussion

Just output the improved, ready-to-use prompt.`;

/**
 * Configuration interface for the LLM service
 */
interface LLMConfig {
    apiKey: string;
    apiEndpoint: string;
    model: string;
    maxTokens: number;
}

/**
 * Response structure from OpenAI-compatible APIs
 */
interface ChatCompletionResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
    error?: {
        message: string;
        type: string;
    };
}

/**
 * Custom error class for LLM-related errors
 */
export class LLMError extends Error {
    constructor(
        message: string,
        public readonly code: 'NO_API_KEY' | 'API_ERROR' | 'RATE_LIMIT' | 'INVALID_RESPONSE' | 'NETWORK_ERROR'
    ) {
        super(message);
        this.name = 'LLMError';
    }
}

/**
 * Service class for interacting with LLM APIs (OpenAI/Claude compatible)
 */
export class LLMService {
    /**
     * Gets the current configuration from VS Code settings
     */
    private getConfig(): LLMConfig {
        const config = vscode.workspace.getConfiguration('promptlint');
        return {
            apiKey: config.get<string>('apiKey', ''),
            apiEndpoint: config.get<string>('apiEndpoint', 'https://api.openai.com/v1/chat/completions'),
            model: config.get<string>('model', 'gpt-4'),
            maxTokens: config.get<number>('maxTokens', 2048)
        };
    }

    /**
     * Validates that an API key is configured
     */
    private validateApiKey(apiKey: string): void {
        if (!apiKey || apiKey.trim() === '') {
            throw new LLMError(
                'No API key configured. Please set your API key in Settings > Extensions > PromptLint.',
                'NO_API_KEY'
            );
        }
    }

    /**
     * Refactors a user prompt using the configured LLM
     * @param rawPrompt The original prompt to refactor
     * @returns The refactored, improved prompt
     */
    async refactorPrompt(rawPrompt: string): Promise<string> {
        const config = this.getConfig();
        this.validateApiKey(config.apiKey);

        const requestBody = {
            model: config.model,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: rawPrompt }
            ],
            max_tokens: config.maxTokens,
            temperature: 0.7
        };

        try {
            const response = await fetch(config.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            // Handle rate limiting
            if (response.status === 429) {
                const retryAfter = response.headers.get('retry-after');
                throw new LLMError(
                    `Rate limit exceeded. Please try again ${retryAfter ? `in ${retryAfter} seconds` : 'later'}.`,
                    'RATE_LIMIT'
                );
            }

            // Handle authentication errors
            if (response.status === 401) {
                throw new LLMError(
                    'Invalid API key. Please check your API key in Settings > Extensions > PromptLint.',
                    'NO_API_KEY'
                );
            }

            // Handle other HTTP errors
            if (!response.ok) {
                const errorBody = await response.text();
                throw new LLMError(
                    `API request failed (${response.status}): ${errorBody}`,
                    'API_ERROR'
                );
            }

            const data = await response.json() as ChatCompletionResponse;

            // Check for API-level errors
            if (data.error) {
                throw new LLMError(
                    `API error: ${data.error.message}`,
                    'API_ERROR'
                );
            }

            // Extract the refactored prompt from the response
            const refactoredPrompt = data.choices?.[0]?.message?.content;
            if (!refactoredPrompt) {
                throw new LLMError(
                    'Invalid response from API: No content in response',
                    'INVALID_RESPONSE'
                );
            }

            return refactoredPrompt.trim();

        } catch (error) {
            // Re-throw LLMErrors as-is
            if (error instanceof LLMError) {
                throw error;
            }

            // Handle network errors
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new LLMError(
                    'Network error: Unable to connect to the API. Please check your internet connection.',
                    'NETWORK_ERROR'
                );
            }

            // Handle unexpected errors
            throw new LLMError(
                `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
                'API_ERROR'
            );
        }
    }
}

// Export a singleton instance for convenience
export const llmService = new LLMService();
