# Changelog

All notable changes to the "PromptLint" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-18

### 🎉 Initial Release

#### Added
- **Interactive Prompt Editor Panel** - A dedicated WebView panel for writing and refining prompts
- **Refactor Selected Text** - Select any text and refactor it with one click
- **Context Menu Integration** - Right-click menu option when text is selected
- **Multiple Output Options**:
  - Replace selection in-place
  - Open refactored prompt in new tab
  - Copy to clipboard
- **LLM Integration** - Support for OpenAI and Claude-compatible APIs
- **Configurable Settings**:
  - API Key (stored securely)
  - Custom API endpoint
  - Model selection
  - Max tokens configuration
- **Error Handling** - Graceful handling of API errors, rate limits, and invalid keys
- **Progress Indicators** - Loading states during API calls

#### Technical
- Built with TypeScript and VS Code Extension API
- Async/await for all API calls
- Clean, modular architecture
- Comprehensive error messages

---

## Future Roadmap

### [1.1.0] - Planned
- Prompt templates library
- History of refactored prompts
- Keyboard shortcuts
- Batch refactoring

### [1.2.0] - Planned
- Custom system prompts
- Export/import settings
- Team sharing features
- Analytics dashboard
