# Argeon

A personal AI multiplexer. Type one query, see responses from multiple AI models side by side.

Argeon is a pure client-side web app: no backend, no database, no user accounts. Your queries go directly from your browser to each AI provider. Your history stays in your browser.

## How It Works

```mermaid
flowchart LR
    U[You] -->|query| B[Browser]
    B -->|stream| O[OpenAI]
    B -->|stream| A[Anthropic]
    B -->|stream| G[Gemini]
    B -->|stream| X[xAI]
    O -->|tokens| B
    A -->|tokens| B
    G -->|tokens| B
    X -->|tokens| B
    B -->|side by side| U
```

All requests go directly from your browser to each provider. No backend, no proxy, no middleman.

## Architecture

```mermaid
graph TD
    subgraph Browser
        UI[React UI]
        ZS[Zustand Store]
        DX[Dexie / IndexedDB]
        LS[localStorage]
        PA[Provider Adapters]
    end

    UI --> ZS
    ZS --> LS
    UI --> PA
    UI --> DX
    PA -->|fetch + ReadableStream| API[Provider APIs]

    subgraph Storage
        LS -->|API keys, settings, theme| LS
        DX -->|query history| DX
    end
```

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant OpenAI
    participant Anthropic
    participant Gemini

    User->>Browser: "What is quantum computing?"
    par Simultaneous requests
        Browser->>OpenAI: POST /v1/responses (stream)
        Browser->>Anthropic: POST /v1/messages (stream)
        Browser->>Gemini: POST streamGenerateContent
    end
    loop Token streaming
        OpenAI-->>Browser: token delta
        Anthropic-->>Browser: token delta
        Gemini-->>Browser: token delta
    end
    Browser->>User: Side-by-side responses with cost
```

## Supported Providers

- **OpenAI** (GPT-4o, GPT-4o-mini, etc.)
- **Anthropic** (Claude Sonnet, Claude Opus, etc.)
- **Google Gemini** (Gemini 2.5 Flash, Gemini 2.5 Pro, etc.)
- **xAI** (Grok 3, Grok 3 Mini, etc.)

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Deploy to Vercel (Static)

```bash
npm run build
```

The `dist/` directory contains a fully static site. Deploy it to Vercel, Netlify, or any static hosting.

For Vercel: push to a Git repo and import it. Vercel will auto-detect Vite and build correctly. No server functions needed.

## How to Add a New Provider

```mermaid
flowchart TD
    A[1. Define ProviderCapability] -->|capabilities.ts| B[2. Create Adapter]
    B -->|yourprovider.ts| C[3. Register in index.ts]
    C --> D[Done - UI picks it up automatically]
```

1. **Define capabilities** in `src/providers/capabilities.ts`:
   - Add a new entry to the `PROVIDERS` object with all required `ProviderCapability` fields
   - Set `apiStyle`, `supportsDirectBrowserCalls`, `browserKeyExposurePosture`, and feature flags accurately

2. **Create the adapter** in `src/providers/yourprovider.ts`:
   - Export `streamYourProvider(apiKey, model, query, files, callbacks, signal)` -- implements streaming via `fetch` + `ReadableStream`
   - Export `testYourProviderKey(apiKey)` -- minimal request to verify the key
   - Export `discoverYourProviderModels(apiKey)` -- fetch available models from the provider's API

3. **Register in the index** in `src/providers/index.ts`:
   - Import your three functions and add them to `streamFns`, `testFns`, and `discoverFns`

4. **That's it.** The UI automatically picks up new providers from the `PROVIDERS` object:
   - Setup page shows a new provider card
   - Main interface adds a new toggle chip and response column
   - Settings drawer shows model selection
   - Privacy page should be updated manually with the provider's retention note

## Privacy

Argeon has no server. See [PRIVACY.md](./PRIVACY.md) or the in-app `/privacy` page.

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS
- Zustand (state management)
- Dexie.js (IndexedDB for history)
- React Router v6
