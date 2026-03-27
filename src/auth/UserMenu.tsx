import { useState, useRef, useEffect } from 'react';
import { useAuth } from './useAuth';
import { LoginModal } from './LoginModal';

export function UserMenu() {
  const { user, isLoggedIn, isLoading, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  if (isLoading) return null;

  if (!isLoggedIn) {
    return (
      <>
        <button
          onClick={() => setShowLogin(true)}
          className="text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          Sign in
        </button>
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      </>
    );
  }

  const avatarUrl = user?.user_metadata?.avatar_url;
  const displayName = user?.user_metadata?.full_name || user?.email || 'User';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(v => !v)}
        className="flex items-center gap-1.5"
        title={displayName}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="w-5 h-5 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-accent/30 flex items-center justify-center text-[10px] text-accent font-bold">
            {displayName[0]?.toUpperCase()}
          </div>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-8 w-48 bg-surface border border-border rounded-lg shadow-lg py-1 z-50">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[11px] text-text-secondary truncate">{displayName}</p>
          </div>
          <button
            onClick={async () => {
              setShowDropdown(false);
              await logout();
            }}
            className="w-full px-3 py-2 text-left text-xs text-text-secondary hover:text-text-primary hover:bg-bg/50 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
