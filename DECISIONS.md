# Decisions

Choices made where the spec was silent or where research contradicted the spec.

## Model: DeepSeek V4 Flash (not Pro)
User explicitly chose the non-Pro variant. Model ID: `deepseek-v4-flash`. Same API endpoint, 1M context, function calling, streaming. Significantly cheaper.

## PDFs stored in IndexedDB, not OPFS
Research found OPFS has a 10MB per-file size limit on iOS Safari. Since textbook PDFs regularly exceed this, PDFs are stored as IndexedDB Blobs (500MB quota). OPFS is available for small files but unused in M1.

## pdf.js runs main-thread, no worker
pdf.js v5.x has a known bug on Safari 18.x when using workers. We pin to v4.x and set `disableWorker: true`. This avoids the crash at the cost of main-thread blocking during extraction — acceptable for single-page operations.

## Sucrase replaces @babel/standalone
@babel/standalone is 2.8MB. Sucrase is ~275KB, 10x smaller, and handles JSX/TS transforms perfectly for our use case. The only limitation is no decorator support, which we don't need.

## CodeMirror 6 instead of Monaco Editor
Monaco Editor is broken on touch devices (no touch selection, no mobile keyboard support). For M1, code is displayed read-only in `<pre>` blocks. CodeMirror 6 can be added for M2 if interactive editing is needed.

## Voice input deferred to M2
Web Speech API (`SpeechRecognition`) is disabled in standalone PWA mode on iOS. Since M1 targets installed-to-home-screen usage, voice input is not available. Text + stylus are the primary input modes.

## Apple Pencil Pro squeeze removed
There is no WebKit API for the squeeze gesture — it's native-only (UIKit). The MarginRail component provides on-screen buttons as the primary interaction pattern.

## AsyncFunction + Proxy scope for sandbox
Research compared 7 sandboxing approaches. For a trusted model on a personal device, AsyncFunction with a Proxy-wrapped scope is the right choice: zero overhead, synchronous execution, catches accidental mistakes. Not a security boundary — a structural one.

## Safe idb_migrate: declarative ops, not AI-generated code
The AI proposes schema changes as a JSON array of operations (createStore, createIndex, etc.). The tool validates against a whitelist and executes. Core stores are protected. The AI never writes or evaluates migration function code.

## Flexible ai_data store reduces migration need
A generic `ai_data` store with `type` and `threadId` indexes holds heterogeneous AI-generated data. The AI adds new `type` values without needing schema migrations for most cases.

## React 19 (not 18)
The spec said React 18 but React 19 is current. Concurrent features are useful for streaming UI updates.

## Hash router, not browser history
Using `HashRouter` for compatibility with static file hosting and iOS standalone PWA mode. Routes like `#/dev` and `#/settings` work without server-side routing.

## No KaTeX rendering in M1 chat
KaTeX is installed but LaTeX rendering in chat messages is deferred. Messages display as plain text with LaTeX delimiters visible. Full KaTeX integration (parsing `$...$` in markdown) comes with the QuestionRenderer and SolutionAnimator in M1 phase 6.
