import { Link } from 'react-router-dom';

export function Privacy() {
  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <Link
          to="/"
          className="text-xs text-accent hover:text-accent-hover transition-colors mb-6 inline-block"
        >
          {'\u2190'} Back to Argeon
        </Link>

        <h1 className="text-2xl font-display font-bold text-text-primary mb-8">Privacy Policy</h1>

        <div className="space-y-8 text-sm text-text-primary leading-relaxed">
          <Section title="What this app is">
            <p>
              Argeon is a client-side web application that lets you send one query to multiple AI providers and see their responses side by side. It has no backend, no database, and no user accounts. The app is served as static files — all processing happens in your browser.
            </p>
          </Section>

          <Section title="What is stored locally in your browser">
            <ul className="list-disc list-inside space-y-1 text-text-secondary">
              <li><strong className="text-text-primary">API keys</strong> are stored in your browser's <code className="text-xs bg-surface px-1 rounded">localStorage</code>. This is a convenience mechanism, not equivalent to server-side secret storage. Anyone with access to your browser profile can read localStorage.</li>
              <li><strong className="text-text-primary">Query history</strong> (your past questions and the responses received) is stored in your browser's IndexedDB. It never leaves your device unless you send a query to a provider.</li>
              <li><strong className="text-text-primary">Settings</strong> (selected models, layout preferences) are stored in localStorage.</li>
            </ul>
          </Section>

          <Section title="What Argeon does NOT collect or store server-side">
            <p className="text-text-secondary">
              Everything. Argeon has no backend server that processes your data. There is no server-side logic, no analytics, no telemetry, no logging, and no tracking of any kind. The app is static HTML, CSS, and JavaScript served from a CDN. Your queries and data never pass through our infrastructure.
            </p>
          </Section>

          <Section title="What providers may retain under their own policies">
            <p className="text-text-secondary mb-3">
              When you send a query through Argeon, it goes directly from your browser to each provider's API. Each provider retains your query data per their own terms:
            </p>
            <ul className="space-y-2 text-text-secondary">
              <li>
                <strong className="text-text-primary">OpenAI</strong> — Retains API inputs/outputs for up to 30 days per their data controls policy.{' '}
                <a href="https://platform.openai.com/docs/guides/your-data" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover">Learn more</a>
              </li>
              <li>
                <strong className="text-text-primary">Anthropic</strong> — Retains API data for up to 30 days in standard cases per their privacy policy.{' '}
                <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover">Learn more</a>
              </li>
              <li>
                <strong className="text-text-primary">Google Gemini</strong> — Subject to Google's Gemini API data logging and sharing policy.{' '}
                <a href="https://ai.google.dev/gemini-api/docs/logs-policy" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover">Learn more</a>
              </li>
              <li>
                <strong className="text-text-primary">xAI (Grok)</strong> — Stores requests and responses for up to 30 days per their API terms.{' '}
                <a href="https://docs.x.ai" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover">Learn more</a>
              </li>
            </ul>
          </Section>

          <Section title="What happens when you send a query">
            <p className="text-text-secondary">
              Your query goes directly from your browser to each AI provider's API endpoint. Argeon never sees, proxies, logs, or stores your query on any server. However, each provider receives your full query text (and any attached files) and processes it under their own terms of service and privacy policies.
            </p>
          </Section>

          <Section title="What changes when you sign in">
            <p className="text-text-secondary mb-2">
              Signing in is completely optional. The app works fully without an account. If you choose to sign in (via Google, GitHub, or X), the following additional features become available:
            </p>
            <ul className="list-disc list-inside space-y-1 text-text-secondary">
              <li><strong className="text-text-primary">API key sync</strong> — Your API keys are encrypted server-side using AES-256-GCM and stored in a Supabase Postgres database. They are decrypted only when retrieved by your authenticated session.</li>
              <li><strong className="text-text-primary">Preference sync</strong> — Your selected models, theme, and other settings are stored in the database so they follow you across devices.</li>
              <li><strong className="text-text-primary">History sync (opt-in)</strong> — If you enable this in Settings, your query history is stored in the cloud. This is disabled by default.</li>
            </ul>
            <p className="text-text-secondary mt-2">
              All cloud-stored data is protected by row-level security — only your authenticated session can access your data.
            </p>
          </Section>

          <Section title="How to delete your local data">
            <p className="text-text-secondary">
              Go to Settings {'\u2192'} Clear All Data. This removes all API keys from localStorage and clears all query history from IndexedDB. You can also clear individual history entries from the History sidebar, or use your browser's built-in tools to clear site data.
            </p>
          </Section>

          <Section title="Contact">
            <p className="text-text-secondary">
              <a href="mailto:privacy@argeon.app" className="text-accent hover:text-accent-hover">privacy@argeon.app</a>
            </p>
          </Section>

          <p className="text-[11px] text-text-secondary/50 pt-4 border-t border-border">
            Last updated: March 2026
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-text-primary mb-2">{title}</h2>
      {children}
    </section>
  );
}
