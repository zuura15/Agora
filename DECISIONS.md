# Architectural Decisions

## Provider-native `fetch` over SDKs

All four provider adapters use raw `fetch` with `ReadableStream` for streaming instead of provider SDKs. This reduces bundle size and avoids SDK/browser edge cases. The Anthropic SDK's `dangerouslyAllowBrowser` flag is handled via the `anthropic-dangerous-direct-browser-access` HTTP header directly.

## No encryption theater for localStorage keys

API keys are stored in `localStorage` in plaintext. Client-side AES-GCM encryption would require storing the encryption key in the same browser context, providing no meaningful security benefit while giving users false assurance. The UI is honest about this tradeoff.

## SSE parsing without EventSource

We use `fetch` + `ReadableStream` instead of the browser's `EventSource` API because `EventSource` only supports GET requests. All provider streaming endpoints require POST requests with JSON bodies.

## Gemini uses SSE via `alt=sse` parameter

Gemini's `streamGenerateContent` endpoint supports both chunked JSON and SSE modes. We use `alt=sse` for consistency with other providers' SSE-based streaming.

## Model discovery is fire-and-forget on load

Discovery calls happen in a `useEffect` after mount. They do not block the UI. If they fail, the app falls back to hardcoded defaults. Discovery results are cached in localStorage with a 24-hour TTL.

## Dexie.js for IndexedDB

Direct IndexedDB usage is verbose and error-prone. Dexie provides a thin wrapper with TypeScript support. It adds minimal bundle weight (~15KB gzipped).

## Zustand over React Context

Zustand avoids the re-render cascading issues of React Context for high-frequency updates (like streaming tokens). It also provides a simpler API for combining persistent (localStorage) and transient state.

## File upload: client-side normalization layer

Files are normalized to `{ type, mimeType, base64Data, filename }` before being passed to provider adapters. Each adapter maps this to the provider's native format. This keeps file handling logic out of UI code.

## PDF fallback for unsupported providers

OpenAI and xAI don't support native PDF input. For these providers, we attempt basic client-side text extraction. For production use, a library like pdf.js would provide better extraction.

## No React Markdown library

Response rendering uses simple inline formatting (code backticks, bold) rather than a full Markdown parser. This keeps the bundle small. A full Markdown library (e.g., react-markdown + rehype) could be added later if needed.
