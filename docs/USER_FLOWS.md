# Argeon — User Flows

All user flows across every user type. Each flow describes the exact sequence of actions, screens, and system responses.

---

## User Types

| Type | Description | Auth Required | Has API Keys | Has Access Codes |
|------|-------------|---------------|-------------|-----------------|
| **Visitor** | First-time user, no account | No | No | No |
| **BYOK User** | Brings own API keys, no account | No | Yes | No |
| **BYOK + Signed In** | Has keys and an account | Yes | Yes | No |
| **Access Code User** | Uses owner-provided credit | Yes | No | Yes |
| **Hybrid User** | Has both own keys and access codes | Yes | Yes | Yes |
| **Admin** | App owner (single email) | Yes | Yes | Yes |

---

## Flow 1: First Visit (Visitor)

**Entry:** User opens the app URL for the first time.

1. App checks `localStorage` for API keys → none found
2. App checks auth state → not logged in
3. **Redirect to `/setup`** (forced, since no keys and not logged in)
4. Setup page renders in **light mode**
5. User sees:
   - "Set up your AI providers" title
   - **"Have an access code?"** section at top with "Sign in to use an access code" button
   - 4 provider cards (OpenAI, Anthropic, Gemini, xAI) with key input fields
   - "Start using Argeon" button (disabled)
   - "Sign in to sync across devices" link (top-right)

**Exit paths:**
- Enter API key(s) → Flow 2
- Click "Sign in to use an access code" → Flow 5
- Click "Sign in to sync across devices" → Flow 4 (then return here)

---

## Flow 2: BYOK Setup (No Account)

**Entry:** Visitor on `/setup` page.

1. User clicks "Get your key" link on a provider card → opens provider's API key dashboard
2. User copies their API key
3. User pastes key into the provider card input field
4. User clicks "Save" on the provider card
5. Key is saved to `localStorage` under `agora_key_{provider}`
6. Provider chip appears (colored dot + name)
7. If at least 1 key saved: "Start using Argeon" button enables
8. User clicks "Start using Argeon"
9. **Navigate to `/` (Home page)**
10. User sees: Header with "Argeon" title, provider chips, query input, empty state

**Notes:**
- No account required. Keys live in browser only.
- Max 3 providers active simultaneously (can toggle in query input)
- Privacy banner visible: "Your queries go directly from your browser to the AI providers"

---

## Flow 3: Sending a Query (BYOK Mode)

**Entry:** Home page with at least 1 API key configured, BYOK mode.

1. User types question in the textarea
2. "Ask All" button enables
3. User presses Enter (or clicks "Ask All")
4. Query dispatched to all active providers in parallel (direct browser → provider API)
5. Response columns appear with:
   - Provider name + model
   - Streaming text (with blinking cursor)
   - Elapsed time counter
6. As each provider finishes:
   - Streaming cursor disappears
   - Time + tokens + cost shown in header
   - Copy/Retry/Continue buttons appear in footer
7. If Judge mode enabled: judge response appears after all providers complete
8. Follow-up mode auto-enables
9. Session saved to IndexedDB history

**Error handling:**
- Provider API error → red error message in that column with "Retry" button
- Network error → error message with retry
- All providers fail → all columns show errors

---

## Flow 4: Sign In (OAuth)

**Entry:** User clicks any "Sign in" button (setup page, settings, access code section).

1. LoginModal opens (centered overlay)
2. User sees: "Sign in to Argeon" with Google/GitHub/X buttons (only Google active)
3. User clicks "Continue with Google"
4. Browser redirects to Supabase Auth → Google OAuth consent screen
5. User authorizes with Google
6. Google redirects back to Supabase → Supabase redirects to `/auth/callback`
7. AuthCallback page:
   - Shows "Signing in..."
   - Processes the OAuth tokens
   - On success: redirects to `/`
   - On error: shows "Sign-in failed" with "Back to setup" button
8. On successful auth:
   - User avatar appears in header (replaces "Sign in" text)
   - Cloud sync starts (pulls keys, preferences, history if enabled)
   - MigrationDialog may appear (if local data exists, asking to sync)
   - Admin check runs in background

---

## Flow 5: Access Code Redemption

**Entry:** User has received an access code from the admin (e.g., `AGORA-7X9K-M2P4`).

### 5a: From Setup Page (not signed in)
1. User sees "Have an access code?" section
2. Clicks "Sign in to use an access code" button
3. LoginModal opens → completes OAuth (Flow 4)
4. After sign-in, code input field appears (replaces sign-in button)
5. User types code (auto-formats: typing `AGORA7X9KM2P4` becomes `AGORA-7X9K-M2P4`)
6. User clicks "Redeem" (or presses Enter)
7. **Success:** "Code redeemed!" message + "Start using Argeon" button
8. User clicks "Start using Argeon"
9. App switches to access-code mode, navigates to Home

### 5b: From Settings (already signed in)
1. User opens Settings → Account tab
2. Scrolls to "ACCESS CODES" section
3. Types code in input field
4. Clicks "Redeem"
5. **Success:** Code appears in active codes list with balance
6. Mode selector appears in header

### Error states:
- "Invalid code" → code doesn't exist in database
- "Already redeemed" → another user already used this code
- "Code is blocked" → admin disabled this code
- "Maximum 3 active codes" → user already has 3 active codes

---

## Flow 6: Sending a Query (Access Code Mode)

**Entry:** Home page, access-code mode selected, balance > $0, daily limit not reached.

1. Header shows mode selector: `[Own Keys] [Access Code · $4.99]` with `0/20` count
2. Provider chips show all available providers (from server, not BYOK keys)
3. Response length restricted to Brief or Super Brief (Normal hidden)
4. Privacy banner hidden (queries go through proxy, not direct)
5. User types question and presses Enter
6. **Pre-query:** Client calls `reserve-query` Edge Function
   - Server reserves $0.05 credit, claims daily query slot
   - Returns `query_group_id`, updated balance, query count
   - Balance and count update in header immediately
7. Query dispatched to all active providers via `proxy-stream` Edge Function
   - Server uses owner's API keys (user's keys not needed)
   - Server enforces: model allowlist, max tokens, input size limit, response length
8. Each provider streams response through the proxy
   - Client parses SSE (handles OpenAI, Anthropic, Gemini, xAI formats)
   - After stream: server settles actual cost, sends `argeon:balance` event
   - Header balance updates from server response
9. Rate limit counter increments: `1/20`

**Blocked states:**
- Balance $0.00: "Access credit depleted" banner, "Request More Access" mailto link, query input disabled
- 20/20 queries: "Daily query limit reached. Resets at midnight UTC." banner, query input disabled
- Both states allow switching to "Own Keys" mode if user has BYOK keys

---

## Flow 7: Mode Switching

**Entry:** Home page, user has both BYOK keys and access codes.

### BYOK → Access Code:
1. User clicks "Access Code · $X.XX" in mode selector
2. Store updates: `queryMode = 'access-code'`
3. If response length was "Normal", auto-switches to "Brief"
4. Active providers populate from `availableProviders` (server-reported)
5. Privacy banner hides
6. Conversation clears (prevents confusion about which mode funded it)

### Access Code → BYOK:
1. User clicks "Own Keys" in mode selector
2. Store updates: `queryMode = 'byok'`
3. Active providers revert to those with BYOK keys
4. Privacy banner shows
5. "Normal" response length option reappears in Settings
6. Conversation clears

---

## Flow 8: Auto-Mode for Access-Code-Only Users

**Entry:** User signs in, redeems a code, has no BYOK keys.

1. After redeeming, user clicks "Start using Argeon" → navigates to `/`
2. Home page detects: `hasActiveCodes && !hasAnyKey && queryMode === 'byok'`
3. Auto-switches to `access-code` mode
4. Mode selector shows only "Access Code · $X.XX" (no "Own Keys" button since no BYOK keys)
5. All available providers auto-activated

---

## Flow 9: Follow-Up Query

**Entry:** After initial query completes (any mode).

1. Follow-up mode auto-enables
2. Textarea placeholder changes to "Ask a follow-up..."
3. Provider picker chip appears inside input showing active count
4. "New chat" button appears
5. User types follow-up question and sends
6. Conversation history passed to each provider for context
7. New response columns appear below previous ones
8. In access-code mode: new reservation required per follow-up

---

## Flow 10: Retry Failed Provider

**Entry:** A provider column shows an error.

### BYOK mode:
1. User clicks "Retry" in the error column
2. Same query re-sent to that single provider with BYOK key
3. New streaming response replaces the error

### Access Code mode:
1. User clicks "Retry"
2. New reservation made ($0.05 for single provider)
3. Query re-sent through proxy
4. Balance deducted for the retry

---

## Flow 11: View/Manage History

**Entry:** Home page.

1. User clicks clock icon in header → History sidebar opens
2. Sidebar shows all saved sessions (most recent first)
3. User can:
   - **Search** by query text (filters in real-time)
   - **Click** a session to load it (responses shown as static, non-streaming)
   - **Delete** a session (hover to reveal X button)
   - **Clear all** history (button at bottom, with confirmation)
4. Loading a session updates URL to `/s/{sessionId}`
5. Click clock icon again to close sidebar

---

## Flow 12: Settings Management

**Entry:** Home page, click gear icon.

1. Settings drawer slides in from right
2. 4 tabs: General | Display | Data | Account

### General tab:
- View/edit API keys per provider (test, show/hide, copy, remove)
- Select model per provider (dropdown of discovered models)
- Response length (Normal/Brief/Super Brief — Normal hidden in access-code mode)
- Temperature slider (0.0 — 1.0)
- Auto-judge toggle
- Send shortcut (Enter or Ctrl+Enter)

### Display tab:
- Theme (Dark/Light)
- Column layout (Auto/1/2/3)
- Render markdown toggle
- Show cost toggle
- Show tokens toggle
- Auto-scroll toggle

### Data tab:
- Auto-clear history (Never/7/30/90 days)
- Export history as JSON
- Clear All Data (with confirmation — destructive)

### Account tab (not signed in):
- "Sign in to sync..." info text
- Sign in button
- Access code section (sign-in button)

### Account tab (signed in):
- Profile (avatar + name + email)
- "API keys and preferences are syncing" notice
- History sync toggle
- Server proxy toggles (OpenAI, xAI)
- Access code section (input + active codes list)
- Sign out button

---

## Flow 13: Admin — Generate Access Code

**Entry:** Admin navigates to `/admin` (link in user dropdown menu).

1. Admin page verifies identity via `admin-codes` Edge Function
2. If not admin email: redirected to `/`
3. Dashboard shows:
   - Stats: Total Spend, Active Codes, Total Users
   - Generate section: credit amount input (default $5) + Generate button
4. Admin sets credit amount (any value, e.g., $5, $10, $0.50)
5. Clicks "Generate"
6. Server creates code: `AGORA-XXXX-XXXX` (charset: `23456789ABCDEFGHJKMNPQRSTUVWXYZ`)
7. Code displayed with "Copy" button
8. Admin copies and sends to the user (via email, message, etc.)

---

## Flow 14: Admin — Monitor Usage

**Entry:** Admin on `/admin` page.

1. **Codes table** shows all generated codes:
   - Code, Status (unused/active/depleted/blocked), User email, Balance/Initial, Spent, Created date
2. Click a code row to expand: per-provider breakdown (cost, tokens per provider)
3. **Per-user table**: email, total spend, query count
4. **Per-provider table**: provider name, total cost, total tokens

---

## Flow 15: Admin — Block/Unblock Code

**Entry:** Admin on `/admin` page.

1. Admin clicks "Block" on a code row
2. Code status changes to "blocked" immediately
3. If user is mid-query: current stream completes, reservation already charged
4. User's next query attempt fails: "No credit remaining" (if this was their only active code)
5. User sees the code as "blocked" in Settings → Account → Access Codes list
6. Admin can click "Unblock" to re-enable

---

## Flow 16: Sign Out

**Entry:** User clicks "Sign out" in user dropdown or Settings → Account.

1. Supabase session cleared
2. If BYOK keys exist: user stays on Home, queries continue working (keys are local)
3. Banner shows: "Using your own keys works even when not signed in. But your queries won't be synced."
4. If no BYOK keys and no access codes: redirected to `/setup`
5. Access code features disabled (mode selector hidden, access code state cleared)
6. Admin link removed from dropdown

---

## Flow 17: Balance Depletion

**Entry:** User's total credit across all active codes reaches $0.

1. Balance in header shows `$0.00` in red
2. Red banner appears: "Access credit depleted · Request More Access"
3. "Request More Access" opens mailto link
4. Query input blocked in access-code mode
5. User can:
   - Switch to "Own Keys" mode (if they have BYOK keys)
   - Redeem another access code (up to 3 active)
   - Contact admin for a new code

---

## Flow 18: Daily Rate Limit

**Entry:** User sends their 20th query of the day (UTC).

1. Rate limit display shows `20/20` in red
2. Yellow banner: "Daily query limit reached. Resets at midnight UTC."
3. Query input blocked in access-code mode
4. User can still switch to "Own Keys" mode
5. Limit resets at midnight UTC automatically

---

## Flow 19: Continue in Provider

**Entry:** A response column has completed.

1. User clicks "Continue in {Provider}" button in response footer
2. Confirmation dialog appears with the response text (for copying)
3. "Copy & Open" button copies the conversation to clipboard
4. Opens the provider's chat URL in a new tab
5. User pastes the conversation to continue directly with that provider
