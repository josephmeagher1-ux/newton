# Newton

AI-powered personal study tool. Browser-only PWA for iPad Mini 7 with Apple Pencil Pro.

## Run

```bash
npm install
npm run dev     # dev server at localhost:5173
npm run build   # static dist/ folder
```

## Install on iPad

1. Open the dev server URL in Safari
2. Tap Share → Add to Home Screen
3. Launch from home screen — runs in standalone mode

## Setup

1. Open Settings (gear icon)
2. Enter your DeepSeek API key (for text/tutoring)
3. Enter your Anthropic API key (for vision/grading)
4. Tap "Test Keys" to verify

## Add a Textbook

Drop or select a PDF on the home shelf. The outline is extracted automatically. Tap a section to start a tutored session.

## Dev Console

Access at `#/dev` or tap the terminal icon on the home shelf. Full agentic tool access — the AI can query IndexedDB, execute JavaScript, render components.

## Known Limitations

- Voice input unavailable in standalone PWA mode (iOS restriction)
- Apple Pencil Pro squeeze gesture not available (no WebKit API)
- PDFs stored in IndexedDB (OPFS has 10MB per-file limit on iOS)
- No offline AI — requires network for API calls
