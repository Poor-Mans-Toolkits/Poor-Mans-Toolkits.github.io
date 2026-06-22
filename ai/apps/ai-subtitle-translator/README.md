# SubTranslator

AI-powered subtitle translator using Google Gemini (default: Gemini 3 Flash preview). Translate your SRT and VTT subtitle files to multiple languages with just a few clicks — or import a video and have its subtitles generated automatically with ElevenLabs Speech-to-Text, then translated.

![SubTranslator Interface](https://img.shields.io/badge/Made%20with-Gemini%20AI-blue)

## Features

- **Multiple Format Support**: Works with SRT and VTT subtitle files
- **Video Import**: Drop a video to auto-generate subtitles — audio is extracted in your browser with ffmpeg.wasm, transcribed to SRT via the ElevenLabs Speech-to-Text API, then translated
- **13+ Languages**: Translate to Persian, Arabic, Spanish, French, German, and more
- **Smart Batching**: Automatically splits large files for optimal translation quality
- **Progress Tracking**: Real-time progress indicator with batch and subtitle counts, plus a step-by-step progress bar for video imports
- **Preview**: Compare original and translated subtitles side-by-side
- **Modern UI**: Beautiful dark theme with smooth animations
- **Privacy First**: Your API keys are stored locally in your browser and sent only to Google (Gemini) and ElevenLabs respectively

## Getting Started

### 1. Get a Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key

> **Note**: Gemini API offers a generous free tier that should be sufficient for most subtitle translation needs.

### Optional: Get an ElevenLabs API Key (for video import)

Only needed if you want to import a video and generate subtitles from its audio.

1. Visit [ElevenLabs API Keys](https://elevenlabs.io/app/settings/api-keys)
2. Sign in and create an API key
3. Copy it, then paste it into the app via the **STT KEY** button in the header

> **Note**: Speech-to-Text is billed by ElevenLabs based on audio duration. The key is stored locally in your browser and sent only to ElevenLabs.

### 2. Run the Application

This app uses plain scripts (no ES module imports), so you can:

- **Open `index.html` directly** in the browser (`file://`) for local use.
- **Deploy on GitHub Pages** or any static host and open the published URL (recommended for sharing).

Optional local servers still work if you prefer them (e.g. VS Code Live Server, `npx serve`, or `python -m http.server`).

> **Video import requires http(s)**: Subtitle translation works from `file://`, but the in-browser audio extraction for video uses a Web Worker, which browsers block on `file://`. To import video, run the app from GitHub Pages or a local server.

### 3. Translate Subtitles

1. Add your Gemini API key in the popup or via the header key button (it is saved in the browser)
2. Drag and drop your subtitle file (SRT or VTT)
3. Select your target language
4. Click "Translate Subtitles"
5. Download your translated file

### 4. Import a Video (optional)

1. Add your ElevenLabs API key via the **STT KEY** button in the header
2. Drag and drop a video file (MP4, MKV, MOV, WEBM, AVI, …) onto the same upload area
3. A step-by-step progress bar appears below the upload:
   - **Extract audio** — ffmpeg.wasm pulls an audio-only track (mono 16 kHz) from the video in your browser
   - **Transcribe** — the audio is sent to the ElevenLabs Speech-to-Text API, which returns subtitles in SRT
   - **Translate** — the generated subtitles flow into the normal translation step
4. Download your translated file

> On first use, the app downloads the ffmpeg core (~31 MB) from a CDN; it is cached for subsequent runs.

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
├── index.html             # Main HTML page
├── css/
│   └── style.css          # Styles with dark + hand-drawn light themes
├── js/
│   ├── app.js             # Main application logic
│   ├── parser.js          # SRT/VTT parsing & generation
│   ├── batcher.js         # Smart batching for API
│   ├── translator.js      # Gemini API integration
│   ├── audio-extractor.js # In-browser audio extraction (ffmpeg.wasm)
│   ├── transcriber.js     # ElevenLabs Speech-to-Text integration
│   └── vendor/ffmpeg/     # Vendored ffmpeg.js + worker (core/wasm load from CDN)
└── README.md              # This file
```

### How It Works

**Subtitle translation**

1. **Parsing**: The subtitle file is parsed to extract individual entries with timestamps
2. **Batching**: Entries are split into batches (default: 50 per batch) to stay within API limits
3. **Translation**: Each batch is sent to Gemini with context from previous translations
4. **Generation**: Translated entries are combined back into the original format

**Video import**

1. **Extract**: `ffmpeg.wasm` (single-threaded core — no special headers required) extracts an audio-only track as mono 16 kHz MP3. The tiny `ffmpeg.js` + worker are bundled locally (`js/vendor/ffmpeg/`) so the worker runs same-origin as a classic worker; the ~31 MB core/wasm are fetched from the CDN as blob URLs on first use
2. **Transcribe**: The audio is posted to `https://api.elevenlabs.io/v1/speech-to-text` with `additional_formats: [{ "format": "srt" }]`, which returns ready-made SRT
3. **Translate**: The SRT is parsed and fed into the same translation pipeline above

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

### Video import issues
- **"Audio engine failed to load"**: Video import requires http(s) (not `file://`) and internet access on first use. Run the app from GitHub Pages or a local server.
- **Very large videos**: Audio extraction runs in the browser and holds the file in memory; videos around 1 GB and larger may be slow or run out of memory. Trim long videos first if needed.
- **ElevenLabs errors**: Make sure your STT key is valid and that your account has speech-to-text quota. ElevenLabs accepts files up to several GB and up to 10 hours of audio.

## License

MIT License - feel free to use and modify for your projects.

## Credits

- Powered by [Google Gemini AI](https://ai.google.dev/)
- Speech-to-Text by [ElevenLabs](https://elevenlabs.io/)
- In-browser audio extraction by [ffmpeg.wasm](https://ffmpegwasm.netlify.app/)
- UI inspired by modern glassmorphism design
- Fonts: [Outfit](https://fonts.google.com/specimen/Outfit) and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)
