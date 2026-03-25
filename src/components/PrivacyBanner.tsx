import { Link } from 'react-router-dom';

export function PrivacyBanner() {
  return (
    <div className="h-8 flex items-center justify-center px-4 text-xs text-text-secondary bg-surface/80 border-b border-border shrink-0">
      <span className="truncate">
        <span className="mr-1.5">&#x1f512;</span>
        Your queries go directly from your browser to the AI providers you configure. We don't process, intercept, or even send your queries to our servers.{' '}
        <Link to="/privacy" className="text-accent hover:text-accent-hover underline underline-offset-2">
          Privacy Policy
        </Link>
      </span>
    </div>
  );
}
