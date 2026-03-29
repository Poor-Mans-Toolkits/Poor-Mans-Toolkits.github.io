# SubTranslator

AI-powered subtitle translator using Google Gemini (default: Gemini 3 Flash preview). Translate your SRT and VTT subtitle files to multiple languages with just a few clicks.

![SubTranslator Interface](https://img.shields.io/badge/Made%20with-Gemini%20AI-blue)

## Features

- **Multiple Format Support**: Works with SRT and VTT subtitle files
- **13+ Languages**: Translate to Persian, Arabic, Spanish, French, German, and more
- **Smart Batching**: Automatically splits large files for optimal translation quality
- **Progress Tracking**: Real-time progress indicator with batch and subtitle counts
- **Preview**: Compare original and translated subtitles side-by-side
- **Modern UI**: Beautiful dark theme with smooth animations
- **Privacy First**: Your API key is stored locally and never sent to any server except Google's API

## Getting Started

### 1. Get a Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key

> **Note**: Gemini API offers a generous free tier that should be sufficient for most subtitle translation needs.

### 2. Run the Application

This app uses plain scripts (no ES module imports), so you can:

- **Open `index.html` directly** in the browser (`file://`) for local use.
- **Deploy on GitHub Pages** or any static host and open the published URL (recommended for sharing).

Optional local servers still work if you prefer them (e.g. VS Code Live Server, `npx serve`, or `python -m http.server`).

### 3. Translate Subtitles

1. Add your Gemini API key in the popup or via the header key button (it is saved in the browser)
2. Drag and drop your subtitle file (SRT or VTT)
3. Select your target language
4. Click "Translate Subtitles"
5. Download your translated file

## Configuration

### Batch Size

The batch size determines how many subtitles are sent to the API in each request:

- **100** (default): Recommended balance of speed and reliability
- **200**: Fewer API calls, higher risk of timeouts or truncated responses

### Supported Languages

- Persian (فارسی)
- Arabic (العربية)
- Spanish (Español)
- French (Français)
- German (Deutsch)
- Italian (Italiano)
- Portuguese (Português)
- Russian (Русский)
- Chinese (中文)
- Japanese (日本語)
- Korean (한국어)
- Turkish (Türkçe)
- Hindi (हिन्दी)

## Technical Details

### Project Structure

```
sub-translator/
├── index.html          # Main HTML page
├── css/
│   └── style.css       # Styles with dark theme
├── js/
│   ├── app.js          # Main application logic
│   ├── parser.js       # SRT/VTT parsing & generation
│   ├── batcher.js      # Smart batching for API
│   └── translator.js   # Gemini API integration
└── README.md           # This file
```

### How It Works

1. **Parsing**: The subtitle file is parsed to extract individual entries with timestamps
2. **Batching**: Entries are split into batches (default: 50 per batch) to stay within API limits
3. **Translation**: Each batch is sent to Gemini with context from previous translations
4. **Generation**: Translated entries are combined back into the original format

### API Usage

The app calls the Gemini REST API (default model: `gemini-3-flash-preview`). Each batch typically uses:
- ~100-500 input tokens (depending on subtitle length)
- ~100-500 output tokens

For a typical 2-hour movie (~1500 subtitles with 50 per batch = 30 batches), you can expect:
- ~15,000-30,000 total tokens
- Well within Gemini's free tier limits

## Troubleshooting

### "Invalid API key" error
- Double-check that you copied the entire API key
- Make sure there are no extra spaces
- Try generating a new key

### "Rate limit exceeded" error
- Wait a few minutes and try again
- Reduce the batch size to 25
- The app automatically retries rate-limited requests

### Subtitles not parsing correctly
- Ensure your file uses UTF-8 encoding
- Check that timestamps follow standard format (00:00:00,000 for SRT)

## License

MIT License - feel free to use and modify for your projects.

## Credits

- Powered by [Google Gemini AI](https://ai.google.dev/)
- UI inspired by modern glassmorphism design
- Fonts: [Outfit](https://fonts.google.com/specimen/Outfit) and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)
