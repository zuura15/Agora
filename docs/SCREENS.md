# Argeon — Screen Documentation

Every screen in the app with exact layout, components, states, and interactions.

---

## Screen 1: Setup Page (`/setup`)

**Purpose:** Onboarding. Users configure API keys or redeem an access code.
**File:** `src/pages/Setup.tsx`
**Theme:** Forces light mode on mount, restores user theme on exit.

```
+----------------------------------------------------------+
| [top-right]                    Sign in to sync across     |
|                                devices (or user info)     |
+----------------------------------------------------------+
|                                                          |
|           Set up your AI providers                       |
|     Argeon sends your queries directly to each           |
|     provider using your own API key.                     |
|                                                          |
| +------------------------------------------------------+ |
| | Have an access code?                                  | |
| |                                                       | |
| | [Sign in to use an access code]  (if not signed in)  | |
| |   — OR —                                              | |
| | [AGORA-XXXX-XXXX input] [Redeem]  (if signed in)    | |
| | Code redeemed! [Start using Argeon]  (after redeem)  | |
| | AGORA-7X9K  $4.99  active                            | |
| | Up to 3 active access codes                           | |
| +------------------------------------------------------+ |
|                                                          |
| +------------+  +------------+                           |
| | OpenAI     |  | Anthropic  |                           |
| | [key input]|  | [key input]|                           |
| | [Validate] |  | [Validate] |                           |
| | Get key -> |  | Get key -> |                           |
| +------------+  +------------+                           |
| +------------+  +------------+                           |
| | Gemini     |  | xAI (Grok) |                           |
| | [key input]|  | [key input]|                           |
| | [Validate] |  | [Validate] |                           |
| | Get key -> |  | Get key -> |                           |
| +------------+  +------------+                           |
|                                                          |
|         [Start using Argeon]  (disabled until            |
|          keys or codes configured)                       |
|     Keys saved in browser localStorage.                  |
+----------------------------------------------------------+
```

### Components on this screen:
| Component | Purpose |
|-----------|---------|
| AccessCodeSection | Code entry or sign-in prompt |
| ProviderCard (x4) | API key input per provider |
| LoginModal | OAuth sign-in (triggered by buttons) |

### Conditional states:
| Condition | What changes |
|-----------|-------------|
| Not signed in | Access code section shows "Sign in" button |
| Signed in, no codes | Access code input visible, empty list |
| Signed in, has codes | Active codes list shown with balances |
| No keys, no codes | "Start using Argeon" disabled |
| Has keys OR codes | "Start using Argeon" enabled |

---

## Screen 2: Home Page (`/`)

**Purpose:** Main query interface. Send questions to multiple AI providers.
**File:** `src/pages/Home.tsx`

```
+----------------------------------------------------------+
| [Privacy Banner] Your queries go directly from your      |
| browser... Privacy Policy                (BYOK mode only)|
+----------------------------------------------------------+
| [Zero Balance Banner] Access credit depleted · Request   |
| More Access                       (access-code mode, $0) |
+----------------------------------------------------------+
| [Unsigned Banner] Using your own keys works even when    |
| not signed in. But your queries won't be synced.         |
|                              (signed out + has BYOK keys)|
+----------------------------------------------------------+
| Argeon    [Own Keys|Access Code·$4.99] 0/20   ☀ ⏱ ⚙ 👤 |
+----------------------------------------------------------+
| +--------+  +------------------------------------------+ |
| |History |  | ● OpenAI  ● Anthropic  ● Gemini  (chips)| |
| |sidebar |  |                                          | |
| |        |  | 📎 [Ask anything...            ] [Ask All]| |
| |session1|  |            Enter to send · Shift+Enter   | |
| |session2|  |                                          | |
| |session3|  |         One question. Many minds.        | |
| |        |  |    Type a question above to get responses| |
| |        |  |    from all your configured providers.   | |
| |        |  |              ● (shimmer dot)             | |
| |        |  |                                          | |
| +--------+  +------------------------------------------+ |
+----------------------------------------------------------+
```

### After sending a query:
```
+----------------------------------------------------------+
| ... (header, banners as above)                           |
+----------------------------------------------------------+
| ● OpenAI  ● Anthropic  ● Gemini                         |
| 📎 [Ask a follow-up... ] [3 providers ▾] [New] [Follow] |
+----------------------------------------------------------+
| You asked: "What is quantum computing?"                  |
| +----------------+ +----------------+ +----------------+ |
| | ● OpenAI       | | ● Anthropic    | | ● Gemini       | |
| | gpt-4o         | | claude-sonnet  | | gemini-flash   | |
| | 1.2s · 342 tok | | 2.1s · 518 tok | | 0.8s · 201 tok | |
| |                | |                | |                | |
| | Quantum        | | Quantum        | | Quantum comput | |
| | computing is...| | computing      | | ing uses...    | |
| |                | | leverages...   | |                | |
| | [Copy] [Retry] | | [Copy] [Retry] | | [Copy] [Retry] | |
| | [Continue in   | | [Continue in   | | [Continue in   | |
| |  OpenAI]       | |  Anthropic]    | |  Gemini]       | |
| +----------------+ +----------------+ +----------------+ |
+----------------------------------------------------------+
```

### Components on this screen:
| Component | Purpose |
|-----------|---------|
| PrivacyBanner | Privacy notice (BYOK mode only) |
| ZeroBalanceBanner | Depleted/rate-limit notice (access-code mode) |
| ModeSelector | Toggle BYOK / Access Code + balance display |
| UserMenu | Sign in / avatar dropdown / admin link |
| HistorySidebar | Session history (left panel, toggleable) |
| QueryInput | Textarea + file upload + provider chips + send button |
| ProviderChip | Toggle individual providers (max 3) |
| ResponseColumn | Streaming response per provider |
| SettingsDrawer | Right panel (see Screen 4) |

### Conditional states:
| Condition | What changes |
|-----------|-------------|
| BYOK mode | Privacy banner visible, all response lengths available |
| Access-code mode | Privacy banner hidden, "Normal" response length hidden |
| Balance $0 | Red banner, query blocked |
| 20/20 queries | Yellow banner, query blocked |
| Not signed in + has keys | "not synced" banner shown |
| Signed in + has codes | Mode selector visible |
| No codes | Mode selector hidden |
| No BYOK keys | "Own Keys" button hidden in mode selector |
| Streaming | Blinking cursor, animated dots, cancel button |
| Follow-up mode | Provider picker inside input, "New chat" button |
| History open | Left sidebar with sessions |
| Settings open | Right drawer with tabs |
| Empty state | "One question. Many minds." tagline |

---

## Screen 3: Admin Page (`/admin`)

**Purpose:** Owner manages access codes and monitors usage.
**File:** `src/pages/Admin.tsx`
**Access:** Admin email only. Non-admins redirected to `/`.

```
+----------------------------------------------------------+
| Argeon Admin                           [Back to app]     |
+----------------------------------------------------------+
| +----------------+ +----------------+ +----------------+ |
| | TOTAL SPEND    | | ACTIVE CODES   | | TOTAL USERS    | |
| | $0.02          | | 3              | | 2              | |
| +----------------+ +----------------+ +----------------+ |
|                                                          |
| GENERATE CODE                                            |
| $ [5.00  ] [Generate]                                    |
| AGORA-7X9K-M2P4  [Copy]         (after generating)      |
|                                                          |
| ACCESS CODES                                             |
| +--------------------------------------------------------|
| | Code         Status  User         Balance    Created   |
| |--------------------------------------------------------|
| | AGORA-7X9K  active  user@gm..  $4.99/$5   Mar 31     |
| |   [expand] Provider Breakdown:                         |
| |     openai: $0.0003 (340 tok)                         |
| |     anthropic: $0.0016 (170 tok)                      |
| |     gemini: $0.0001 (21 tok)                          |
| |--------------------------------------------------------|
| | AGORA-A1B2  unused  —           $10/$10    Mar 31     |
| |--------------------------------------------------------|
| | AGORA-C3D4  blocked foo@bar.. $0/$5       Mar 30     |
| +--------------------------------------------------------|
|                                                          |
| +------------------------+ +---------------------------+ |
| | PER USER               | | PER PROVIDER              | |
| |------------------------|  |---------------------------| |
| | user@gm..  $0.01  5q  | | openai     $0.003  1.2k  | |
| | foo@bar..  $0.00  1q  | | anthropic  $0.008  890    | |
| +------------------------+ | gemini     $0.001  210    | |
|                            | xai        $0.002  1.5k  | |
|                            +---------------------------+ |
+----------------------------------------------------------+
```

### Components on this screen:
| Component | Purpose |
|-----------|---------|
| Stats cards (3) | Total spend, active codes, total users |
| Code generator | Credit input + generate button + copy |
| Codes table | All codes with status, user, balance |
| Expandable rows | Per-provider breakdown per code |
| Per-user table | Spend and query count per user |
| Per-provider table | Spend and tokens per provider |

### Conditional states:
| Condition | What changes |
|-----------|-------------|
| Loading | "Loading..." placeholder |
| No codes | "No codes yet. Generate your first code above." |
| Code expanded | Provider breakdown row appears below |
| Code blocked | "Unblock" button (green), "blocked" badge (red) |
| Code active | "Block" button (red), "active" badge (green) |
| Code unused | "unused" badge (indigo), no user email |
| Code depleted | "depleted" badge (grey), $0 balance |
| Just generated | Code + Copy button appear inline |

---

## Screen 4: Settings Drawer (overlay on Home)

**Purpose:** Configure all app settings.
**File:** `src/components/SettingsDrawer.tsx`
**Trigger:** Click gear icon in header.

```
+---------------------------+
| Settings            Close |
+---------------------------+
| [General][Display][Data][Account]
+---------------------------+

GENERAL TAB:
+---------------------------+
| API KEYS                  |
| OpenAI    sk-...****      |
|   [Validate & Save]      |
|   [Show] [Copy] [Remove] |
| Anthropic sk-ant-...****  |
|   [Validate & Save]      |
|   [Show] [Copy] [Remove] |
| (etc.)                    |
|                           |
| MODELS                    |
| OpenAI    [gpt-4o     ▾] |
| Anthropic [claude-son ▾] |
|                           |
| RESPONSE LENGTH           |
| [Normal] [Brief] [Super] |
|  (Normal hidden in        |
|   access-code mode)       |
|                           |
| TEMPERATURE               |
| [====●=====] 0.7         |
|                           |
| AUTO-JUDGE     [  toggle] |
|                           |
| SEND SHORTCUT             |
| [Enter] [Ctrl+Enter]     |
+---------------------------+

DISPLAY TAB:
+---------------------------+
| THEME                     |
| [Dark] [Light]            |
|                           |
| COLUMN LAYOUT             |
| [Auto] [1] [2] [3]       |
|                           |
| Render markdown  [toggle] |
| Show cost        [toggle] |
| Show tokens      [toggle] |
| Auto-scroll      [toggle] |
+---------------------------+

DATA TAB:
+---------------------------+
| AUTO-CLEAR HISTORY        |
| [Never][7d][30d][90d]     |
|                           |
| [Export history as JSON]  |
|                           |
| DANGER ZONE               |
| [Clear All Data]          |
| This will delete...       |
+---------------------------+

ACCOUNT TAB (signed out):
+---------------------------+
| Sign in to sync your API  |
| keys, settings...         |
| [Sign in]                 |
|                           |
| [Sign in to use an        |
|  access code]             |
+---------------------------+

ACCOUNT TAB (signed in):
+---------------------------+
| [avatar] User Name        |
|          user@email.com   |
|                           |
| Keys and preferences are  |
| syncing.                  |
|                           |
| Sync query history [toggle]|
|                           |
| SERVER PROXY              |
| OpenAI           [toggle] |
| xAI              [toggle] |
|                           |
| ACCESS CODES              |
| [AGORA-XXXX-XXXX] [Redeem]|
| AGORA-7X9K  $4.99  active |
| Up to 3 active codes      |
|                           |
| Sign out                  |
+---------------------------+
```

---

## Screen 5: Privacy Page (`/privacy`)

**Purpose:** Static privacy policy.
**File:** `src/pages/Privacy.tsx`

```
+----------------------------------------------------------+
| ← Back to Argeon                                        |
|                                                          |
| Privacy Policy                                           |
|                                                          |
| What this app is                                         |
| ...                                                      |
|                                                          |
| What is stored locally in your browser                   |
| ...                                                      |
|                                                          |
| What Argeon does NOT collect server-side                 |
| ...                                                      |
|                                                          |
| What providers may retain                                |
| ...                                                      |
|                                                          |
| What happens when you send a query                       |
| ...                                                      |
|                                                          |
| What changes when you sign in                            |
| ...                                                      |
|                                                          |
| How to delete your local data                            |
| ...                                                      |
|                                                          |
| Contact: privacy@argeon.app                              |
| Last updated: March 2026                                 |
+----------------------------------------------------------+
```

No components, no state, no interactions (except external links and back link).

---

## Screen 6: Auth Callback (`/auth/callback`)

**Purpose:** Processes OAuth redirect after Google sign-in.
**File:** `src/pages/AuthCallback.tsx`

### Loading state:
```
+----------------------------------------------------------+
|                                                          |
|                    Signing in...                          |
|                                                          |
+----------------------------------------------------------+
```

### Error state:
```
+----------------------------------------------------------+
|                                                          |
|                   Sign-in failed                         |
|                   {error message}                        |
|                   [Back to setup]                        |
|                                                          |
+----------------------------------------------------------+
```

### Success: Auto-redirects to `/` (no visible screen).

---

## Screen 7: Login Modal (overlay)

**Purpose:** OAuth provider selection.
**File:** `src/auth/LoginModal.tsx`
**Trigger:** Any "Sign in" button in the app.

```
+----------------------------------------------------------+
|                  +-----------------------+                |
|                  | Sign in to Argeon     |                |
|                  |                       |                |
|                  | Syncing is optional.  |                |
|                  | The app works fully   |                |
|                  | without an account.   |                |
|                  |                       |                |
|                  | [Continue with Google]|                |
|                  | [GitHub - Coming soon]|                |
|                  | [X - Coming soon]    |                |
|                  |                       |                |
|                  | {error message}       |                |
|                  |                       |                |
|                  | Cancel                |                |
|                  +-----------------------+                |
+----------------------------------------------------------+
```

---

## Behavior & Rules

Specifications that apply across screens. These are the details behind the user flows.

### Access Code Mode Restrictions
- Response length limited to **Brief** or **Super Brief** only. "Normal" is hidden from the selector.
- Maximum **20 queries per day** per user. Resets at midnight PST.
- All queries go through the server proxy (not direct browser-to-provider).
- Privacy banner is hidden (since queries pass through the server).
- Model selection restricted to a server-side allowlist per provider.
- Maximum input size: 100KB. File uploads not supported.
- Balance display floors to the lower cent (e.g., $4.9967 shows as $4.99).

### Mode Selector Behavior
- Only visible when signed in AND user has at least one active access code.
- "Own Keys" button only appears if user has at least one BYOK key saved.
- Switching modes clears the current conversation.
- Switching to access-code mode auto-activates available providers (up to 3).
- If entering access-code mode with "Normal" response length, auto-switches to "Brief".

### Provider Selection
- Maximum 3 active providers at once.
- In BYOK mode: only providers with validated keys can be activated.
- In access-code mode: only providers the server has keys for can be activated.
- Provider chips show colored dots matching each provider's brand color.
- Judge toggle ("J" button) appears on active provider chips.

### Credit & Billing
- Each query reserves $0.05 credit before any API calls are made.
- After each provider responds, actual cost is calculated from real token usage and the reservation is settled (refund if actual < reserved, extra charge if actual > reserved).
- Refunds are capped at the code's initial credit (can't exceed original amount).
- If settlement fails (server error, disconnect), the reservation stands as the charge.
- Daily query slot is consumed even if all providers fail (prevents retry abuse).
- Balances are always set from server responses, never computed client-side.

### API Key Validation
- Keys can only be saved through successful validation ("Validate & Save" button).
- There is no separate Save button.
- Invalid keys show a red error and are not stored.
- Saved keys are masked by default with Show/Copy/Remove options.

### Access Code Input
- Auto-formats as user types: `AGORA7X9KM2P4` becomes `AGORA-7X9K-M2P4`.
- Pasting a code with dashes already present works as-is.
- Input auto-uppercases all characters.
- Maximum 3 active codes per user (active = has remaining credit and not blocked).

### Authentication
- Google OAuth only (GitHub and X shown as "Coming soon").
- Session lasts ~1 hour before expiring.
- Signing out does not delete BYOK keys (they're local).
- Signing out disables access code features until re-sign-in.
- When signed out with BYOK keys, a banner warns about no sync.

### Admin Access
- Single admin email, configured server-side.
- "Admin" link appears in user dropdown only for the admin.
- Non-admin users accessing `/admin` are silently redirected to `/`.
- Admin can generate codes with any credit amount.
- Admin can block/unblock codes immediately.
- Code generation charset: `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (no ambiguous characters).

### History
- Stored locally in the browser.
- Optionally synced to cloud when signed in with sync enabled.
- Searchable by query text.
- Sessions can be deleted individually or all at once.
- Auto-clear configurable: never, 7, 30, or 90 days.
- Loading a past session shows static responses (not re-streamed).

### Error Messages
| Situation | Message shown |
|-----------|--------------|
| API key invalid | "Invalid API key" or "Authentication failed" (red, below input) |
| Code not found | "Invalid code" (red, below input) |
| Code already redeemed | "Already redeemed" (red) |
| Code blocked | "Code is blocked" (red) |
| Max 3 codes | "Maximum 3 active codes" (red) |
| Credit depleted | "Access credit depleted" (red banner) + "Request More Access" link |
| Daily limit hit | "Daily query limit reached. Resets at midnight PST." (yellow banner) |
| Provider error | Provider-specific error in the response column + "Retry" button |
| Not authenticated | "Not authenticated" or "Reservation failed" (red) |
| Sign-in failed | Error message on callback page + "Back to setup" button |
| Not signed in (keys banner) | "Using your own keys works even when not signed in. But your queries won't be synced." |

### Responsive Behavior
- Response columns: side by side on desktop (2-4 columns), stacked on mobile.
- Column layout configurable: Auto, 1, 2, or 3 columns.
- Mode selector: full text on desktop, compact on mobile.
- Admin tables: horizontal scroll on mobile.
- Settings drawer: max 90vw width on mobile.

---

## Component Reference

### Shared across screens:

| Component | File | Used on |
|-----------|------|---------|
| AccessCodeSection | `src/components/AccessCodeSection.tsx` | Setup, Settings |
| ModeSelector | `src/components/ModeSelector.tsx` | Home (header) |
| ZeroBalanceBanner | `src/components/ZeroBalanceBanner.tsx` | Home |
| PrivacyBanner | `src/components/PrivacyBanner.tsx` | Home |
| UserMenu | `src/auth/UserMenu.tsx` | Home (header) |
| LoginModal | `src/auth/LoginModal.tsx` | Setup, Settings, AccessCodeSection |
| ProviderChip | `src/components/ProviderChip.tsx` | Home (QueryInput) |
| ProviderCard | `src/components/ProviderCard.tsx` | Setup |
| ResponseColumn | `src/components/ResponseColumn.tsx` | Home |
| QueryInput | `src/components/QueryInput.tsx` | Home |
| HistorySidebar | `src/components/HistorySidebar.tsx` | Home |
| SettingsDrawer | `src/components/SettingsDrawer.tsx` | Home |
| FileUploadChip | `src/components/FileUploadChip.tsx` | Home (QueryInput) |

### State management:
| Store | File | Purpose |
|-------|------|---------|
| appStore | `src/store/appStore.ts` | All settings, API keys, query mode, access codes |
| historyStore | `src/store/historyStore.ts` | Query session history |

### Hooks:
| Hook | File | Purpose |
|------|------|---------|
| useProviders | `src/hooks/useProviders.ts` | Query dispatch, streaming, judge |
| useAccessCodes | `src/hooks/useAccessCodes.ts` | Load/redeem codes, polling |
| useModelDiscovery | `src/hooks/useModelDiscovery.ts` | Auto-fetch available models |
| useAuth | `src/auth/useAuth.ts` | OAuth login/logout |
| useAuthContext | `src/auth/AuthProvider.tsx` | Auth state context |

### Services:
| Service | File | Purpose |
|---------|------|---------|
| accessCodeService | `src/lib/accessCodeService.ts` | Edge Function API calls |
| supabase | `src/lib/supabase.ts` | Supabase client |
| syncEngine | `src/sync/historySyncEngine.ts` | Cloud sync for history/settings |
| logger | `src/lib/logger.ts` | Structured console logging |
| streamUtils | `src/lib/streamUtils.ts` | SSE parsing, cost estimation |

### Edge Functions:
| Function | File | Purpose |
|----------|------|---------|
| proxy-stream | `supabase/functions/proxy-stream/index.ts` | Proxy API calls (BYOK + access code) |
| reserve-query | `supabase/functions/reserve-query/index.ts` | Reserve credit + daily slot |
| redeem-code | `supabase/functions/redeem-code/index.ts` | Redeem access code |
| admin-codes | `supabase/functions/admin-codes/index.ts` | Admin CRUD + usage stats |
| encrypt-keys | `supabase/functions/encrypt-keys/index.ts` | Encrypt/decrypt BYOK keys for cloud sync |

### Database:
| Table | Purpose |
|-------|---------|
| access_codes | Access codes with credit balances |
| usage_log | Per-provider cost tracking |
| daily_usage | Atomic rate limiting counter |
| encrypted_keys | Cloud-synced BYOK keys (encrypted) |
| preferences | Cloud-synced user settings |
| synced_history | Cloud-synced query history |
