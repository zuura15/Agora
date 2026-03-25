# Argeon Privacy Policy

## What this app is

Argeon is a client-side web application that lets you send one query to multiple AI providers and see their responses side by side. It has no server, no backend, no database, and no user accounts.

## What is stored locally in your browser

- **API keys** are stored in your browser's `localStorage`. This is a convenience mechanism, not equivalent to server-side secret storage. Anyone with access to your browser profile can read localStorage.
- **Query history** (your past questions and the responses received) is stored in your browser's IndexedDB. It never leaves your device unless you send a query to a provider.
- **Settings** (selected models, layout preferences) are stored in localStorage.

## What Argeon does NOT store on its own servers

Everything. Argeon has no server. There is no server-side component, no analytics, no telemetry, no logging, and no tracking of any kind. The app is static HTML, CSS, and JavaScript served from a CDN.

## What providers may retain under their own policies

When you send a query through Argeon, it goes directly from your browser to each provider's API. Each provider retains your query data per their own terms:

- **OpenAI** -- Retains API inputs/outputs for up to 30 days per their data controls policy. [Learn more](https://platform.openai.com/docs/guides/your-data)
- **Anthropic** -- Retains API data for up to 30 days in standard cases per their privacy policy. [Learn more](https://www.anthropic.com/privacy)
- **Google Gemini** -- Subject to Google's Gemini API data logging and sharing policy. [Learn more](https://ai.google.dev/gemini-api/docs/logs-policy)
- **xAI (Grok)** -- Stores requests and responses for up to 30 days per their API terms. [Learn more](https://docs.x.ai)

## What happens when you send a query

Your query goes directly from your browser to each AI provider's API endpoint. Argeon never sees, proxies, logs, or stores your query on any server. However, each provider receives your full query text (and any attached files) and processes it under their own terms of service and privacy policies.

## How to delete your local data

Go to Settings > Clear All Data. This removes all API keys from localStorage and clears all query history from IndexedDB. You can also clear individual history entries from the History sidebar, or use your browser's built-in tools to clear site data.

## Contact

privacy@argeon.app

---

Last updated: March 2026
