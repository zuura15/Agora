# Claude Code Prompt v5: Agora — AI Multiplexer App

---

## What You Are Building

**Agora** is a personal AI multiplexer — a web app where a user types one query and sees responses from multiple AI models side by side, simultaneously. It is a pure client-side app: no backend, no database, no user accounts. All state lives in the browser.

This is a power-user tool. Users supply their own API keys. The app's honest privacy story is: **"Agora has no server of its own. Your history stays in your browser. Your queries are sent directly to the AI providers you configure, subject to each provider's own data retention policies."**

---

## Architecture — No Ambiguity

| Decision | Choice |
|---|---|
| Framework | **Vite + React + TypeScript** |
| Routing | **React Router v6** |
| Styling | **Tailwind CSS** |
| IndexedDB | **Dexie.js** |
| App state | **Zustand** |
| No SSR, no Next.js, no server actions, no backend | confirmed |

Deploy target: **Vercel or Netlify static hosting** (pure static, no server functions needed).

---

## Honest Architecture Notes

- All API calls are made **directly from the browser** to each provider's API endpoint
- User API keys are stored in **`localStorage`**, masked in the UI, with a note to users that browser storage is not equivalent to server-side secret storage — it is convenient local persistence, not a vault
- Do **not** add AES-GCM encryption theater — it provides false assurance. Just store keys plainly in localStorage and be honest in the UI
- Query history is stored in **IndexedDB via Dexie.js** — never sent anywhere
- The app has **no analytics, no telemetry, no logging**

---

## Supported Providers

Build a **`ProviderCapability`** object for each provider. This is the foundation of the integration layer — do not fake uniformity across providers.

```typescript
interface ProviderCapability {
  id: string;
  name: string;
  apiStyle: 'openai-responses' | 'anthropic-messages' | 'gemini-generate' | 'xai-responses';
  supportsDirectBrowserCalls: 'supported' | 'possible-but-discouraged' | 'unsupported';
  // CORS feasibility + vendor stance on browser-direct calls
  browserKeyExposurePosture: 'approved' | 'supported-with-warning' | 'discouraged';
  // How strongly the vendor endorses exposing API keys client-side.
  // These two fields diverge meaningfully across providers — do not collapse them.
  // Use both to drive UI warnings in setup screen and column headers.
  supportsStreaming: boolean;
  supportsImageInput: boolean;
  supportsPdfInput: boolean;
  supportsModelDiscovery: boolean; // provider has a model listing endpoint
  defaultModels: string[];         // sensible seed fallbacks
  retentionNote: string;           // honest note about provider's own data retention policy
}
```

### Provider Specs

**OpenAI**
- API style: OpenAI Responses API (`/v1/responses`) — use this, not legacy Chat Completions
- `supportsDirectBrowserCalls`: `possible-but-discouraged` — OpenAI's key safety docs explicitly say do not deploy API keys in browsers or mobile apps; route through a backend. Surface a strong warning in the UI.
- `browserKeyExposurePosture`: `discouraged`
- Streaming: yes (SSE)
- Image input: yes — use Responses API `input_image` blocks with base64 data URIs (not `image_url` chat-completions syntax)
- PDF input: via client-side text extraction fallback (no native PDF support in Responses API)
- Model discovery: yes — `GET /v1/models`, filter to `gpt-*` prefixes
- Default seed models: `gpt-4o`, `gpt-4o-mini`
- Retention note: "OpenAI retains API inputs/outputs for up to 30 days per their data controls policy (platform.openai.com/docs/guides/your-data)"

**Anthropic**
- API style: Anthropic Messages API (`/v1/messages`)
- `supportsDirectBrowserCalls`: `supported` — CORS headers are returned; use `dangerouslyAllowBrowser: true` in the Anthropic SDK. Explain this flag briefly in the setup UI — the name itself is the warning.
- `browserKeyExposurePosture`: `supported-with-warning` — Anthropic explicitly supports browser SDK access, but the key is still exposed client-side. This is not a broad vendor endorsement of client-side key storage as safe practice.
- Streaming: yes (SSE)
- Image input: yes (native)
- PDF input: yes (native, first-class)
- Model discovery: yes — `GET /v1/models`
- Default seed models: `claude-sonnet-4-6`, `claude-opus-4-6`
- Retention note: "Anthropic retains API data for up to 30 days in standard cases per their privacy policy (anthropic.com/privacy)"

**Google Gemini**
- API style: Gemini `generateContent` / `streamGenerateContent` APIs
- `supportsDirectBrowserCalls`: `supported`
- `browserKeyExposurePosture`: `approved` — API key usage is standard for Gemini Developer API
- Streaming: yes
- Image input: yes (native)
- PDF input: yes (native)
- Model discovery: yes — `GET /v1beta/models`
- Default seed models: `gemini-2.5-flash`, `gemini-2.5-pro`
- Note: Gemini 2.0 Flash is deprecated — do not hardcode it
- Retention note: "Subject to Google's Gemini API data logging and sharing policy — link ai.google.dev/gemini-api/docs/logs-policy in the Privacy page rather than stating a hard retention number"

**xAI (Grok)**
- API style: xAI Responses API — use this, not legacy Chat Completions
- `supportsDirectBrowserCalls`: `possible-but-discouraged` — no official xAI documentation endorsing browser-direct key usage found; treat same as OpenAI and surface a warning in UI
- `browserKeyExposurePosture`: `discouraged`
- Streaming: yes (SSE)
- Image input: yes
- PDF input: no (show warning badge in column if PDF uploaded)
- Model discovery: yes — use xAI's documented language-model listing endpoint (`/v1/language-models`); fall back to seeded defaults if discovery fails
- Default seed models: `grok-3`, `grok-3-mini` — treat as fallbacks only, always prefer discovery
- Retention note: "xAI stores requests and responses for up to 30 days per their API terms (docs.x.ai)"

### Model Discovery Pattern

```typescript
// On app load for each provider that supports discovery:
// 1. Fetch available models from provider's /models endpoint
// 2. Merge with hardcoded defaults (defaults win if discovery fails)
// 3. Cache result in localStorage with a 24h TTL
// 4. Fall back gracefully to defaults if discovery errors
```

**Critical guardrail — do not block the UI on model discovery.** Fire discovery calls in the background after the app renders. The app must be fully usable — query input active, provider chips visible — even if all discovery calls fail or time out. Never gate the main interface on discovery completion.

Never hardcode model IDs as the only option. Discovery + fallback is required.

---

## App Structure & Routes

| Route | Page |
|---|---|
| `/` | Main query interface (redirects to `/setup` if no keys configured) |
| `/setup` | First-time API key setup |
| `/settings` | Settings (opens as right drawer over `/`) |
| `/privacy` | Privacy policy page |

---

## UI Screens

### Setup Screen (`/setup`)
- Full-page welcoming experience, not a modal
- Headline: "Set up your AI providers"
- Subhead: "Agora sends your queries directly to each provider using your own API key. You pay providers directly. We never see your queries."
- Four provider cards, each with:
  - Provider logo + name
  - Password input for API key
  - Link to provider's API dashboard ("Get your key →")
  - "Test" button — fires the cheapest possible minimal request to verify the key works (e.g. list models, or a 1-token completion). Must not store the test request in query history. Must not be confused with a real query.
  - Green checkmark on success, red error message on failure
- **No minimum requirement** — user can configure even one provider and proceed
- "Start using Agora" button — active as soon as any key is saved (verified or not)
- Small note below CTA: "Keys are saved in your browser's local storage. You can update or remove them anytime in Settings."

### Main Interface (`/`)

**Layout (desktop):**
```
[Privacy Banner — always visible, 32px]
[Header: Agora logo | History toggle | Settings icon]
[Query Input Area — sticky]
[Response Columns — fill remaining height, each column independently scrollable]
[History Sidebar — collapsible, left side]
```

**Privacy Banner text** (honest version):
> 🔒 Agora has no servers. Your history stays in your browser. Queries go directly to the AI providers you configure — subject to their own privacy policies. [Privacy Policy](#/privacy)

**Query Input:**
- Large textarea, auto-resizing up to ~4 lines
- Paperclip icon for file upload
- Provider toggle chips above input (showing each configured provider — click to deselect for this query)
- "Ask All" send button
- Keyboard shortcut: Cmd/Ctrl+Enter to send

**Response Columns:**
- One column per active provider
- Column header: provider logo, model name, status indicator
- While waiting for first token: subtle animated "thinking" state (pulsing dots or shimmer)
- Streaming text renders tokens as they arrive with a blinking cursor at the stream end
- On completion: show total time elapsed + estimated token count
- Column actions: Copy | Retry | Thumbs up / down
- Error state: clear message + retry button (do not crash other columns)
- Columns fade in as responses begin — staggered, not all at once

**Responsive:**
- Desktop (≥1024px): up to 4 columns side by side
- Tablet (768–1023px): 2 columns
- Mobile (<768px): single column with provider tabs to switch between responses

**History Sidebar:**
- Hidden by default, toggle via history icon in header
- Lists past query sessions (timestamp + truncated query text)
- Click to reload full response set
- Search/filter input
- Delete individual entries or clear all

### Settings Drawer (`/settings`)
- Slides in from right
- Sections: API Keys | Model Selection | Layout Preferences | Clear All Data
- Per-provider model selector: shows discovered models (with fallback to defaults)
- "Clear All Data" with confirmation dialog — wipes localStorage + IndexedDB

### Privacy Policy Page (`/privacy`)
- Clean readable page
- Sections:
  - What this app is (plain English, 2 sentences)
  - What is stored locally in your browser (keys in localStorage, history in IndexedDB)
  - What Agora does NOT store on its own servers (everything — Agora has no server)
  - What providers may retain under their own policies (each provider retains query data per their own terms — this section lists each provider with a one-line summary and a link to their policy page)
  - What happens when you send a query (goes directly from your browser to each provider — Agora never sees it, but the provider does)
  - How to delete your local data (Settings > Clear All Data)
  - Contact: `privacy@agora.app`
  - Last updated: [date of build]
- Tone: written like a person, not a lawyer

---

## File Upload Handling

Accept: `.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`, `.txt`, `.md` — max 10MB

Build a **file normalization layer** that adapts to each provider's preferred format:

```typescript
interface NormalizedFile {
  type: 'image' | 'pdf' | 'text';
  mimeType: string;
  base64Data: string;
  filename: string;
}

// Each provider adapter handles NormalizedFile in its own way:
// - OpenAI: images via Responses API `input_image` blocks with base64 data URIs; PDFs as client-side extracted text
// - Anthropic: images and PDFs as native document blocks (first-class support)
// - Gemini: images and PDFs via inlineData blocks or file API
// - xAI: images via Responses API image input; PDFs not supported (show warning badge)
```

If a provider doesn't support the uploaded file type, show a warning badge in that column: **"⚠️ [Provider] doesn't support PDF input — text query only"**

---

## Streaming Implementation

**Implementation rule: prefer provider-native REST `fetch` implementations over SDKs** unless the SDK materially simplifies streaming or browser support (e.g. Anthropic SDK's `dangerouslyAllowBrowser` flag is worth using). This reduces bundle size and avoids SDK/browser edge cases.

Use `fetch` with `ReadableStream` for all providers. Do not use polling.

- OpenAI Responses API: SSE stream
- Anthropic Messages API: SSE stream with `stream: true`
- Gemini: `streamGenerateContent` endpoint
- xAI: SSE stream (same pattern as OpenAI Responses API)

All four streams fire simultaneously on query send. Each column updates independently.

---

## UI / Design Direction

**Aesthetic: "Refined Dark Cockpit"** — precise, technical, alive. Not generic. Not purple gradient on white.

**Colors:**
- Background: `#0e0e12` (near-black with a hint of blue)
- Surface/cards: `#16161d`
- Border: `#2a2a35`
- Accent: `#6366f1` (electric indigo) — used sparingly: CTAs, active states, streaming cursor
- Text primary: `#f0f0f5`
- Text secondary: `#8888a0`
- Success: `#22c55e` | Error: `#ef4444`

**Typography:**
- Display/Logo: `Syne` (Google Fonts)
- UI/Body: `IBM Plex Mono` — precise, technical, readable
- Never use Inter, Roboto, Arial, or Space Grotesk

**Visual details:**
- Subtle dot-grid pattern on background (CSS `radial-gradient` — no image files)
- Response columns: faint glassmorphism border, `backdrop-filter: blur(8px)`, `background: rgba(22,22,29,0.8)`
- Streaming cursor: blinking `|` in accent color at the end of stream
- Provider logos glow faintly in their brand color when streaming
- Columns fade in with staggered `animation-delay` as responses start arriving

**Micro-interactions:**
- Send button: brief pulse/scale on click
- Key verified: green checkmark animates in
- Copy button: transitions to "Copied ✓" for 1.5s
- Column collapse/expand: smooth height transition
- Provider toggle chips: smooth active/inactive transition

**Empty state (no query yet):**
- Centered input with a very subtle animated gradient mesh behind it
- Tagline: "One question. Many minds."
- Show configured provider logos as small glowing orbs below the input

---

## Folder Structure

```
/src
  /components
    QueryInput.tsx
    ResponseColumn.tsx
    ProviderChip.tsx
    PrivacyBanner.tsx
    HistorySidebar.tsx
    SettingsDrawer.tsx
    FileUploadChip.tsx
    ProviderCard.tsx        (setup screen)
  /pages
    Home.tsx
    Setup.tsx
    Privacy.tsx
  /providers
    capabilities.ts         (ProviderCapability objects for all 4 providers)
    openai.ts
    anthropic.ts
    gemini.ts
    xai.ts
    index.ts                (unified sendMessage interface)
  /hooks
    useProviders.ts
    useQueryHistory.ts
    useModelDiscovery.ts
  /store
    appStore.ts             (Zustand — keys, active providers, settings)
    historyStore.ts         (Zustand + Dexie)
  /lib
    dexie.ts                (IndexedDB schema)
    fileUtils.ts            (normalization layer)
    streamUtils.ts          (shared SSE/ReadableStream helpers)
  /styles
    globals.css
  App.tsx
  main.tsx
```

---

## Security / Privacy — Honest Language Only

Use this exact framing in the UI and docs. Do not embellish it:

> "Your API keys are saved in your browser's localStorage for convenience. This is a convenience mechanism used by many local-first web apps. It is not equivalent to server-side secret storage. Anyone with access to your browser profile can read localStorage. Use a dedicated API key for this app and rotate it if you suspect exposure."

This is honest, informative, and not alarmist. Do not use terms like "encrypted," "secure vault," or "protected" for localStorage unless you are implementing something that genuinely warrants that language.

---

## Deliverables

1. Full working app as described
2. `README.md`:
   - What Agora is
   - Local dev setup (`npm install && npm run dev`)
   - Deploy to Vercel (static)
   - How to add a new provider (developer guide, 1 page)
3. `PRIVACY.md` — mirrors the in-app `/privacy` page
4. `DECISIONS.md` — any architectural choices not specified here

---

## Success Criteria & Prioritization

This is a large surface area. If tradeoffs appear during build, prioritize in this order:

1. **Provider adapters** — all 4 must fire real streaming requests; this is the core value
2. **Honest privacy copy** — banner and policy page must use accurate language throughout
3. **Model discovery** — with graceful fallback; no hardcoded-only model IDs
4. **File upload routing** — per capability matrix; wrong behavior is worse than a clear warning
5. **UI quality** — Refined Dark Cockpit aesthetic; distinctive not generic
6. **History / Dexie** — persistence across refreshes
7. **Settings drawer** — functional but can be simpler if time is tight

A correct first pass means:
- [ ] All 4 provider adapters fire real streaming requests
- [ ] `ProviderCapability` matrix is the source of truth — no provider-specific hacks scattered in UI code
- [ ] Model discovery works per provider and falls back gracefully
- [ ] File uploads route correctly per capability matrix with warning badges where unsupported
- [ ] Privacy banner always visible, uses accurate honest copy
- [ ] Privacy policy page correctly distinguishes Agora's servers (none) from provider retention
- [ ] Setup flow works with even one provider configured
- [ ] History persists across refreshes via Dexie
- [ ] UI matches Refined Dark Cockpit aesthetic — not generic
- [ ] No fake security language anywhere
- [ ] No hardcoded stale model IDs as the only option
