# Newton PWA — Diagnostic & Optimization Reference

> Give this file to a capable AI to debug, audit, or optimize Newton. It contains the full architecture, every prompt sent to the LLM, the request/response pipeline, tool schemas, storage layout, and known issues.

---

## 1. Architecture Overview

Newton is a browser-only AI tutor PWA targeting iPad Mini 7 + Apple Pencil Pro. Stack:

- **React 19 + TypeScript strict + Vite + Tailwind 4**
- **IndexedDB** (via `idb` package) for all persistence — PDFs as blobs, sessions, messages, patches
- **DeepSeek** as primary LLM (text, tool use, streaming)
- **OpenRouter** as optional secondary (vision/grading, model marketplace)
- **pdf.js v4.x** for PDF rendering and text extraction (main-thread, no worker — Safari compatibility)
- **Sucrase** for runtime TSX transpilation (self-modification)
- **Service Worker** via `vite-plugin-pwa` — `NetworkOnly` for API origins

### File Map

```
src/
  App.tsx                          — Router (/, /session/:id, /dev, /settings)
  main.tsx                         — Entry. Calls loadAppPatches() then renders App
  components/
    HomeShelf.tsx                   — PDF library grid, drag-drop upload
    SessionPage.tsx                 — Study session: chat + questions + ink canvas
    DevConsole.tsx                  — Agentic chat with full tool access
    Settings.tsx                    — API keys, model selection, theme, storage
    InkCanvas.tsx                   — Apple Pencil drawing surface
    questions/
      QuestionRenderer.tsx          — Routes question JSON to modality renderer
      McqRenderer.tsx               — MCQ single/multi
      TrueFalseRenderer.tsx         — True/False
      TypedShortRenderer.tsx        — Short typed answer
      TypedExtendedRenderer.tsx     — Extended response
      FillBlankRenderer.tsx         — Fill-in-the-blank
      FlashcardRenderer.tsx         — Flashcard flip
      HandwrittenRenderer.tsx       — Stylus input + vision grading
      MatchingRenderer.tsx          — Drag matching pairs
      OrderingRenderer.tsx          — Drag ordering
      CategorisationRenderer.tsx    — Drag categorisation
  hooks/
    useChat.ts                      — Core chat loop: streaming, tool calls, message persistence
  lib/
    pdf.ts                          — pdf.js wrapper: getOutline, extractText, pageHasImages, renderPageToJpeg
    pdf-sections.ts                 — Section content extraction: text + image detection + caching
    question-schemas.ts             — 17 question modality type definitions + schema description generator
    modalities.ts                   — Modality metadata + 19 subject profiles with weighted modality preferences
    app-patches.ts                  — Load/save/inject CSS and JS patches from IndexedDB
    session-progress.ts             — Session progress tracking
  prompts/
    tutorSystem.ts                  — All tutor prompts: system, index ingestion, answer check, grading
    devConsole.ts                   — Dev console system prompt (agentic + self-modification)
    animateSolution.ts              — Step-by-step solution animation prompt
    markdownIndex.ts                — Re-export of getIndexIngestionPrompt
  providers/
    types.ts                        — LLMProvider interface, ChatMessage, ChatChunk, ToolDef types
    deepseek.ts                     — DeepSeek streaming client + model list fetch
    openrouter.ts                   — OpenRouter streaming client + usage/cost + model list fetch
    anthropic.ts                    — Anthropic client (legacy, still present)
    registry.ts                     — Provider instances + task→provider routing
    settings-helper.ts              — getSetting/setSetting wrapper over IndexedDB settings store
  storage/
    db.ts                           — IndexedDB schema (LearnyDB), connection manager, generateId
    migrate.ts                      — Safe declarative migrations with protected-store validation
    pdf-store.ts                    — PDF blob CRUD
    folder-access.ts                — File System Access API integration
    persist.ts                      — navigator.storage.persist() request
  tools/
    registry.ts                     — Tool registration, lookup, risk-level filtering for ToolDef generation
    run-js.ts                       — run_js: sandboxed JS execution
    sandbox.ts                      — AsyncFunction + Proxy sandbox with curated scope
    idb-tools.ts                    — idb_get, idb_query, idb_put, idb_delete, idb_migrate
    call-model.ts                   — call_model: delegate to another LLM
    fetch-url.ts                    — fetch_url: HTTP fetch with hostname confirmation
    render-in-app.ts                — render_in_app: mount AI-generated React components
    self-modify.ts                  — patch_css, patch_startup, read_source, list_patches, remove_patch
    index.ts                        — Import all tool modules + re-export registry
```

---

## 2. LLM Provider Pipeline

### 2.1 Provider Types (`src/providers/types.ts`)

```typescript
interface LLMProvider {
  name: string;
  chat(req: ChatRequest): AsyncIterable<ChatChunk>;
}

interface ChatRequest {
  messages: ChatMessage[];        // system + user + assistant + tool messages
  tools?: ToolDef[];              // OpenAI-compatible function definitions
  temperature?: number;           // default 0.3
  maxTokens?: number;             // default 16384
  jsonMode?: boolean;             // response_format: json_object
  stream?: boolean;               // always true in practice
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];  // ContentPart for vision: [{type:'text',text}, {type:'image_url',image_url:{url}}]
  tool_calls?: ToolCall[];          // on assistant messages with function calls
  tool_call_id?: string;            // on tool result messages
}

interface ChatChunk {  // SSE stream events
  type: 'content' | 'tool_call_start' | 'tool_call_delta' | 'done' | 'error';
  content?: string;
  toolCall?: Partial<ToolCall>;
  toolCallIndex?: number;
  error?: string;
}
```

### 2.2 DeepSeek Provider (`src/providers/deepseek.ts`)

- **Base URL:** `https://api.deepseek.com/v1`
- **Default model:** `deepseek-chat` (overridden by `deepseek_model` setting)
- **Auth:** Bearer token from `api_key_deepseek` setting
- **Streaming:** SSE with `data: [DONE]` terminator
- **Tool calls:** Accumulates `function.arguments` across delta chunks (critical — arguments arrive in fragments)
- **Model discovery:** `GET /v1/models` with auth header → returns `{data: [{id, owned_by}]}`

**Request body sent:**
```json
{
  "model": "<from settings or 'deepseek-chat'>",
  "messages": [/* full message history including system */],
  "stream": true,
  "temperature": 0.3,
  "max_tokens": 16384,
  "tools": [/* if tools provided */],
  "response_format": {"type": "json_object"}  // only if jsonMode=true
}
```

### 2.3 OpenRouter Provider (`src/providers/openrouter.ts`)

- **Base URL:** `https://openrouter.ai/api/v1`
- **Auth:** Bearer token from `api_key_openrouter` setting
- **Extra headers:** `HTTP-Referer: <origin>`, `X-Title: Newton Study`
- **Model:** Read from configurable setting key (constructor param), e.g. `openrouter_model_vision` or `openrouter_model_text`
- **Cost monitoring:** `GET /api/v1/auth/key` returns `{data: {usage, limit, rate_limit}}`
- **Model discovery:** `GET /api/v1/models` (no auth needed) → full marketplace with pricing, context length, image/tool support

### 2.4 Provider Registry (`src/providers/registry.ts`)

Three singleton instances:
```typescript
const deepseek = new DeepSeekProvider();
const openrouterText = new OpenRouterProvider('openrouter_model_text', 'deepseek/deepseek-chat-v3-0324');
const openrouterVision = new OpenRouterProvider('openrouter_model_vision', 'anthropic/claude-sonnet-4-5-20241022');
```

Task routing:
- `text`, `index`, `solution` → always DeepSeek
- `vision`, `grading` → checks `vision_provider` setting:
  - `'deepseek'` → DeepSeek
  - anything else → OpenRouter vision instance

**Issue:** `getProvider()` (sync) always routes vision to OpenRouter — can't check async setting. `getProviderAsync()` does the right thing but callers must use the async version. `call_model` tool uses the sync `getProvider()`, so it always goes to OpenRouter for vision tasks regardless of the user's setting.

---

## 3. Chat Loop (`src/hooks/useChat.ts`)

This is the core agentic pipeline. Understanding it is critical for debugging.

### 3.1 Message Flow

1. **User sends message** → stored in IndexedDB `messages` store
2. **Build message array:**
   - System prompt (re-sent every request — not persistent)
   - All prior messages from state (user + assistant + tool)
   - New user message (optionally with image as base64 ContentPart)
3. **Streaming loop** (max 5 rounds):
   - Call `provider.chat(request)` → async iterable of ChatChunk
   - Accumulate `content` chunks → live-update UI via setState
   - Accumulate `tool_call_start` + `tool_call_delta` chunks → build ToolCall objects
   - On stream end: save assistant message to IndexedDB
   - If tool calls present: execute each, push results, loop back for next round
   - If no tool calls: break (done)

### 3.2 Tool Call Accumulation (SSE parsing)

Tool calls arrive as deltas across multiple SSE chunks:

```
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_abc","function":{"name":"idb_query"}}]}}]}
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"sto"}}]}}]}
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"re\":\"pdfs\"}"}}]}}]}
```

The hook uses a `Map<number, string>` (`toolCallArgs`) to accumulate argument fragments by index, then finalizes after the stream completes. This is correct but has a subtle issue:

**Bug potential:** If the model sends interleaved tool calls (index 0 and 1 alternating), the accumulation still works because it keys by index. But if the model sends a tool_call_start for index 1 before index 0's arguments are fully received, `toolCalls[1]` may be set before `toolCalls[0]` is complete — the array will have gaps. Currently handles this with optional chaining (`toolCalls[idx]!`).

### 3.3 Tool Execution

```typescript
for (const tc of toolCalls) {
  const tool = getTool(tc.function.name);
  const args = JSON.parse(tc.function.arguments || '{}');
  const res = await tool.execute(args, { threadId, confirm: onToolConfirm });
  // Push tool result message back into chatMessages array
}
```

- Tools execute **sequentially**, not in parallel
- Each tool result is a `{role: 'tool', content: string, tool_call_id: string}` message
- The confirm callback shows a UI dialog for write/exec risk tools
- Tool results are persisted to IndexedDB immediately

### 3.4 Known Issues in Chat Loop

1. **System prompt re-sent every request:** Not using conversation history from IndexedDB efficiently. The full message array grows with every exchange. For long sessions, this will hit token limits.
2. **No token counting:** No awareness of context window. Will eventually send messages that exceed model's context, causing API errors.
3. **No message truncation/summarization:** No strategy for compressing old messages when approaching limits.
4. **State race condition:** `sendMessage` captures `state.messages` at call time via closure. If called while streaming is in progress, the messages array will be stale. The `streaming` state flag prevents UI from sending concurrent messages, but there's no programmatic guard.
5. **No retry logic:** If the API returns a 5xx or network error, the error is displayed and the user must resend manually.
6. **Tool result size:** Tool results are returned as strings with no size limit enforcement in the chat loop (though `fetch_url` truncates at 512KB). A `run_js` that returns a huge string will bloat the message history.

---

## 4. System Prompts (Exact Text)

### 4.1 Tutor Session Prompt

Generated by `getTutorSystemPrompt(sectionHeading, pageText, subjectId?, recentModalities?)`:

```
You are a personal tutor. The user has opened section: "{sectionHeading}".
Subject: {name} ({category}). Exam style: {examStyle}  [if subject detected]

YOUR ROLE:
1. Greet briefly (one sentence, conversational).
2. Give a 3-4 sentence lesson intro — what this section covers and why it matters.
3. Produce a practice question as a JSON object following one of the modality schemas below.
4. After the question JSON, add 2-3 sentences about common mistakes on this topic.

QUESTION MODALITY SELECTION:
For this subject, prefer these PRIMARY modalities (~70% of questions):
  - {name} ({id})  [marked if used recently]
Mix in these SECONDARY modalities (~30%):
  - {name} ({id})
Selection strategy: weight towards primary modalities but rotate...

[Full schema description for all 17 modalities — ~2500 tokens]

TOOLS AVAILABLE (read-only):
- idb_get / idb_query

GUIDELINES:
- Output the question as a JSON code block
- Use LaTeX: $...$ inline, $$...$$ display
- Choose difficulty 1-5 based on textbook position
- VARY THE MODALITY
- Grade and give feedback before next question
- Reference page figures naturally

SECTION CONTENT:
{extracted text from PDF pages}
```

### 4.2 Index Ingestion Prompt

Generated by `getIndexIngestionPrompt(extractedText)`:

```
You are an expert curriculum designer. Your task is to analyse the first pages of a textbook and produce a structured study index.

TOOLS AVAILABLE:
- idb_get / idb_query

Read the textbook content below and produce a markdown table of contents.
For each chapter and major section:
- Use markdown ## for chapters, ### for sections
- After each heading, append " — XX min — pp. A-B" with study time and page range
- Below each heading, one sentence summary

Output ONLY markdown. No preamble, no explanation, no code fences.

TEXTBOOK CONTENT (first pages):
{extractedText}
```

### 4.3 Answer Check Prompt

Generated by `getAnswerCheckPrompt(questionJson, userAnswer, sectionContext)`:

```
You are a tutor grading a student's answer...

QUESTION:
{questionJson}

USER'S ANSWER:
{userAnswer}

SECTION CONTEXT:
{sectionContext}

TOOLS AVAILABLE (read-only):
- idb_get / idb_query

GRADING INSTRUCTIONS:
1. Determine if correct, partially correct, or incorrect
2. For auto-gradeable types: compare directly
3. For LLM-graded types: evaluate against mark scheme
4. Brief encouraging feedback (2-3 sentences)
5. Explain correct answer if wrong
6. Suggest focus areas

Output format:
{
  "correct": true|false|"partial",
  "score": {"earned": number, "possible": number},
  "feedback": "string",
  "correct_answer": "string — only if wrong",
  "next_action": "harder_question|same_difficulty|easier_question|review_topic"
}
```

### 4.4 Handwriting Grading Prompt (Vision)

Generated by `getGradingPrompt(questionJson, markScheme)`:

```
You are a UK exam-board-style examiner. The user has submitted handwritten working on a tablet...

Be generous on method marks (M), strict on accuracy marks (A).
For each error, identify bounding region as fractions: {x: 0-1, y: 0-1, w: 0-1, h: 0-1}.

Output:
{
  "marks_awarded": [{"mark_type": "M|A|B", ...}],
  "annotations": [{"kind": "tick|cross|underline|margin_note", "bbox": {...}, "text": "..."}],
  "summary": "string",
  "total_earned": int, "total_possible": int,
  "next_action": "try_again|show_solution|move_on"
}
```

### 4.5 Solution Animation Prompt

Generated by `getAnimateSolutionPrompt(questionJson)`:

```
You are a maths teacher producing a step-by-step animated worked solution.
Output JSON: {"steps": [{"equation": "LaTeX", "narration": "string", "rule_applied": "string"}], "final_answer": "string"}
6-12 steps. Don't skip algebraic steps.
```

### 4.6 Dev Console Prompt

Full system prompt in `DEV_CONSOLE_SYSTEM_PROMPT`:

```
You are a coding assistant embedded in the user's personal study PWA called "Newton"...
[Lists all 14 tools with descriptions]
[SELF-MODIFICATION STRATEGY: 7-step approach]
[Full IndexedDB schema listing all 10 stores with fields and indexes]
[STRATEGY section for investigation/computation/UI/restyling]
```

---

## 5. Tool System

### 5.1 Tool Registry (`src/tools/registry.ts`)

Tools are registered at import time (side effects in `src/tools/index.ts`). Each tool has:
- `name`: string identifier matching function calling schema
- `description`: sent to LLM as function description
- `risk`: `'read' | 'write' | 'exec'` — determines confirmation requirements
- `parameters`: JSON Schema object
- `execute(args, ctx)`: returns `{ok, content}`

Risk filtering: `getToolDefs(filter)` returns tools up to the specified risk level:
- `'read'` → only read tools
- `'write'` → read + write tools
- `'exec'` → all tools (used by dev console)

The tutor session only sends `'read'` tools (idb_get, idb_query, read_source, list_patches). The dev console sends all tools.

### 5.2 All Registered Tools

| Tool | Risk | Parameters | What It Does |
|------|------|-----------|--------------|
| `run_js` | exec | `{code: string}` | Execute async JS in sandbox. Returns value + console logs. Logged to tool_calls store. |
| `idb_get` | read | `{store, key}` | Read one record by key from any IndexedDB store |
| `idb_query` | read | `{store, index?, key?, limit?}` | Query records, optionally by index. Default limit 20. |
| `idb_put` | write | `{store, value}` | Write a record. Requires confirmation. |
| `idb_delete` | write | `{store, key}` | Delete a record. Requires confirmation. |
| `idb_migrate` | exec | `{description, operations[]}` | Safe declarative schema migration. Validates against protected stores. |
| `call_model` | exec | `{task, messages[], maxTokens?}` | Delegate to another LLM. Task determines provider (text/vision/grading). |
| `fetch_url` | exec | `{url, method?, body?}` | HTTP fetch. Shows hostname for confirmation. Response truncated at 512KB. |
| `render_in_app` | exec | `{name, source, subject?}` | Mount AI-generated React component. Sucrase transpiles TSX. Saved to dynamic_components. |
| `patch_css` | exec | `{id, css}` | Inject persistent CSS. Saved to ai_data with type='css_patch'. |
| `patch_startup` | exec | `{id, code}` | Register startup JS. Saved to ai_data with type='startup_js'. Runs on next load. |
| `read_source` | read | `{target: 'html'\|'styles'\|'dom_tree'}` | Read current page HTML (8KB), CSS variables, or DOM outline (depth 4). |
| `list_patches` | read | `{}` | List all CSS, JS, and component patches with IDs and dates. |
| `remove_patch` | write | `{id}` | Remove patch from IndexedDB and DOM. |

### 5.3 Sandbox (`src/tools/sandbox.ts`)

The `run_js` tool uses `executeSandboxed()`:

**Mechanism:** `new Function('__scope__', 'with(__scope__) { return (async () => { ${code} })(); }')` called with a Proxy scope.

**Available in scope:**
- `console` (log/warn/error → captured in logs array)
- `storage` (async: get/put/getAll/delete — direct IndexedDB access)
- `Math`, `JSON`, `Date`, `Array`, `Object`, `String`, `Number`, `Boolean`
- `Map`, `Set`, `RegExp`, `Promise`
- `parseInt`, `parseFloat`, `isNaN`, `isFinite`
- `encodeURIComponent`, `decodeURIComponent`, `atob`, `btoa`
- `crypto.randomUUID()`
- `setTimeout` (capped at 30s), `clearTimeout`

**Blocked (throws ReferenceError):**
- `window`, `globalThis`, `document`, `fetch`, `eval`, `Function`, `import`, `localStorage`, `XMLHttpRequest`

**Timeout:** 30 seconds via `Promise.race`.

**Security model:** Trusted-model-on-personal-device. Prevents accidental mistakes, not adversarial attacks. The `with` statement + Proxy blocks most accidental globals. Code can still `this.constructor.constructor('return globalThis')()` to escape — acceptable for this trust model.

### 5.4 Self-Modification System

**CSS Patches:** Stored in `ai_data` store with `type='css_patch'`. On app load, `loadAppPatches()` reads all CSS patches and injects `<style id="patch-{id}">` elements into `<head>`. Live updates apply immediately.

**Startup JS:** Stored in `ai_data` with `type='startup_js'`. On load, each is executed via `new Function(code)()`. Runs in global scope (full DOM access). Failures are caught and logged but don't block app startup.

**Dynamic Components:** Stored in `dynamic_components` store. TSX source is transpiled by Sucrase at save time. Components are React elements with `useState`, `useEffect`, and Tailwind in scope.

---

## 6. IndexedDB Schema (`newton-db`, version 1)

| Store | Key | Fields | Indexes |
|-------|-----|--------|---------|
| `pdfs` | `id` (uuid) | name, blob (Blob), pageCount, outlineMd, addedAt, lastOpenedAt, sizeBytes | `by-added` → addedAt |
| `pdf_pages` | `id` (pdfId:pageNum) | pdfId, pageNum, text, hasImages (bool), imageBlob? (Blob), extractedAt | `by-pdf` → pdfId |
| `sections` | `id` (uuid) | pdfId, heading, pageStart, pageEnd, estimatedMinutes, orderIndex | `by-pdf` → pdfId |
| `threads` | `id` (uuid) | sectionId, createdAt | `by-section` → sectionId |
| `messages` | `id` (uuid) | threadId, role, content, toolCalls? [{id,name,arguments}], toolCallId?, model?, createdAt | `by-thread` → threadId |
| `tool_calls` | autoIncrement | threadId, tool, input, output, approved, executedAt, durationMs, error? | `by-thread` → threadId |
| `ai_data` | `id` (string) | type, threadId?, data (any), createdAt | `by-type` → type, `by-thread` → threadId |
| `dynamic_components` | `id` (uuid) | subject, name, sourceTsx, createdAt | `by-subject` → subject |
| `settings` | `key` (string) | value (any) | — |
| `_migrations` | autoIncrement | version, ops[], appliedAt, description | — |

### Protected Stores (cannot be modified by idb_migrate)

`pdfs`, `pdf_pages`, `sections`, `threads`, `messages`, `tool_calls`, `settings`, `_migrations`

Stores `ai_data` and `dynamic_components` are NOT protected — the AI can add indexes to them.

### Migration Constraints

- Max 5 ops per migration
- Max 20 total stores
- Store names: `^[a-z][a-z0-9_]{0,49}$`
- Index keyPaths: max 2 levels deep
- All migrations logged to `_migrations` store

---

## 7. Question Modalities (17 Types)

Each question is a JSON object with a `modality` discriminator. The LLM generates these in tutoring sessions.

| Modality | Input | Grading | Key Fields |
|----------|-------|---------|------------|
| `mcq_single` | select | auto | options[], correctIndex, explanation |
| `mcq_multi` | select | auto | options[], correctIndices[], explanation |
| `true_false` | select | auto | statement, correct (bool), explanation |
| `typed_short` | type | LLM | acceptableAnswers[], markScheme? |
| `typed_extended` | type | LLM | wordLimit?, markScheme[], rubric |
| `fill_blank` | type | auto | textBefore, textAfter, acceptableAnswers[] |
| `cloze` | type | auto | passage (with ___), blanks[] |
| `matching` | drag | auto | left[], right[], correctPairs[] |
| `ordering` | drag | auto | items[] (shuffled), correctOrder[] |
| `categorisation` | drag | auto | categories[], items[] with categoryId |
| `hotspot` | tap | auto | imageDescription, target {x,y,radiusFraction} |
| `diagram_label` | tap | auto | imageDescription, labels[] with x,y,correctText |
| `handwritten` | draw | vision | markScheme[], commonMistakes[] |
| `graph_sketch` | draw | vision | axisLabels, description, keyFeatures[] |
| `code_write` | code | LLM | language, starterCode?, testCases[] |
| `flashcard` | select | auto | front, back |
| `socratic` | chat | LLM | openingQuestion, guidingPoints[], desiredInsights[] |

All have: `stem`, `difficulty` (1-5), optional `marks` and `timeEstimateSeconds`.

### Subject Profiles (19 subjects)

Each subject has:
- **Primary modalities** (~70% of questions): the most natural format for that subject
- **Secondary modalities** (~30%): variety to keep sessions engaging
- **Exam style**: description of assessment format (sent to LLM for tone calibration)

The system tracks the last 3 modalities used and flags them in the prompt so the LLM avoids repetition.

---

## 8. Settings Keys

All stored in the `settings` IndexedDB store as `{key, value}` pairs:

| Key | Type | Description |
|-----|------|-------------|
| `api_key_deepseek` | string | DeepSeek API key |
| `api_key_openrouter` | string | OpenRouter API key (optional) |
| `deepseek_model` | string | Selected DeepSeek model ID (default: `deepseek-chat`) |
| `vision_provider` | string | `'deepseek'` or `'openrouter'` for vision/grading tasks |
| `openrouter_model_vision` | string | OpenRouter model for vision (default: `anthropic/claude-sonnet-4-5-20241022`) |
| `openrouter_model_text` | string | OpenRouter model for text override (default: `deepseek/deepseek-chat-v3-0324`) |
| `theme` | string | `'system'`, `'light'`, `'dark'`, `'eink'` |

---

## 9. Theme System

Four modes using CSS custom properties on `:root`:

- **System** (default): follows `prefers-color-scheme` media query
- **Light**: warm cream tones (`--color-bg: #faf8f5`, accent: `#8b5e34`)
- **Dark**: dark grey (`--color-bg: #0a0a0a`, accent: `#60a5fa`)
- **E Ink**: pure black-on-white, no colour, `font-family: Charter/Georgia`

Theme is applied by setting class on `<html>`: `theme-light`, `theme-dark`, `theme-eink` (no class = system).

---

## 10. Known Issues & Optimization Opportunities

### Critical

1. **No token counting or context management.** The chat loop sends the full message history every request. For long sessions (20+ exchanges with tool calls), this will exceed DeepSeek's context window. Need: token counter, message truncation/summarization strategy.

2. **System prompt re-sent every request.** The tutor system prompt includes the full question schema (~2500 tokens) and section content (variable, could be 5000+ tokens). This is fine for short sessions but wasteful for long ones. DeepSeek has input cache pricing ($0.0028/M for cache hits) — the system prompt being identical each time means it should hit cache, but verify.

3. **`getProvider()` sync version ignores vision_provider setting.** The `call_model` tool uses `getProvider(task)` (sync), which hardcodes vision → OpenRouter. Should use `getProviderAsync()`. File: `src/tools/call-model.ts:36`.

4. **No abort signal passed to fetch.** The `abortRef` in useChat is set up but never wired into the provider's fetch call. The `abort()` function sets `streaming: false` but doesn't actually cancel the network request.

### Performance

5. **Sequential tool execution.** The chat loop executes tool calls one at a time. If the LLM requests 3 independent tool calls, they could run in parallel. Would need to check for interdependencies.

6. **PDF text extraction on main thread.** `pdf.js` runs with `disableWorker: true` for Safari compatibility. Large PDFs will block the UI during text extraction. Consider breaking extraction into per-page chunks with `requestIdleCallback`.

7. **Image blob caching.** `extractSectionContent()` in `pdf-sections.ts` renders pages to JPEG and caches in IndexedDB's `pdf_pages.imageBlob`. This is good for subsequent loads but the initial render of a 10-page section will be slow.

8. **OpenRouter model list fetched in full.** `fetchOpenRouterModels()` loads the entire model marketplace (~thousands of models) with no pagination. Should add category filters or lazy loading.

### Correctness

9. **Stale message state in sendMessage closure.** `sendMessage` captures `state.messages` via closure. If the user sends a message, then the streaming response updates state, then the loop reads `chatMessages` which was built from the stale closure. The conversation sent to the API may not include the latest messages. The streaming append within the loop mitigates this for multi-round tool calls, but the initial `state.messages` snapshot is stale if messages were added by another mechanism.

10. **No deduplication of tool_calls logging.** Every `run_js` execution is logged to the `tool_calls` store, but other tools don't log. Inconsistent observability.

11. **answer check prompt doesn't enforce JSON output.** The answer check prompt asks for JSON but doesn't set `jsonMode: true` on the request. The model might return explanatory text before/after the JSON block.

### Security (Low Priority — Personal Device)

12. **Sandbox escape possible.** The `with` + Proxy sandbox can be escaped via prototype chain access. Acceptable for trusted model on personal device, but worth noting: `({}).constructor.constructor('return globalThis')()` works.

13. **patch_startup runs arbitrary JS in global scope.** By design, but a model error could inject a startup script that breaks the app. The `list_patches` + `remove_patch` tools provide recovery, and the catch in `loadAppPatches()` prevents crashes.

### UX

14. **No conversation branching.** Can't go back and try a different answer to a question — the linear message history means earlier context is permanent.

15. **No export/import of session data.** All data locked in IndexedDB. User can't back up their progress or move to another device.

16. **No offline indicator.** The service worker caches the shell but API calls require internet. No UI feedback when offline.

17. **Missing question renderers.** The questions/index.ts exports renderers, but not all 17 modalities have dedicated renderer files (e.g. `ClozeRenderer`, `HotspotRenderer`, `DiagramLabelRenderer`, `GraphSketchRenderer`, `CodeWriteRenderer`, `SocraticRenderer` are not in the file listing). These modalities will need fallback rendering.

---

## 11. Request/Response Debugging Checklist

To debug a specific DeepSeek interaction:

1. **Check the messages store:** `idb_query({store: 'messages', index: 'by-thread', key: '<threadId>'})` — see exact messages sent and received.

2. **Check tool_calls store:** `idb_query({store: 'tool_calls', index: 'by-thread', key: '<threadId>'})` — see tool executions, inputs, outputs, durations, errors.

3. **Verify the system prompt:** Put a breakpoint in `useChat.ts:49` to see the full `chatMessages` array before it's sent to the provider.

4. **Check the model being used:** Read `settings` store for `deepseek_model` and `vision_provider` to know which model/provider handled the request.

5. **Check SSE parsing:** If tool calls are malformed, the issue is likely in argument accumulation. Add logging in the tool_call_delta handler in `useChat.ts:98-101`.

6. **Check provider errors:** Both providers yield `{type: 'error', error: string}` chunks. These are displayed in UI but also useful for debugging — the error includes HTTP status and response body.

---

## 12. Deployment

- **Repo:** GitHub Pages from `gh-pages` branch
- **Build:** `npm run build` → Vite outputs to `dist/`
- **Deploy:** `npm run deploy` (likely `gh-pages -d dist`)
- **Service Worker:** Generated by `vite-plugin-pwa`, precaches shell assets
- **API calls:** Must NOT be cached by service worker — configured as `NetworkOnly` for DeepSeek and OpenRouter origins
