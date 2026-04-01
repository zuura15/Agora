# Argeon — User Flows

Pure user journeys. What the user does, what happens next. No UI details or technical specs — those live in SCREENS.md.

---

## User Types

| Type | Description | Sign-in needed? |
|------|-------------|-----------------|
| **Visitor** | First-time user, no account | No |
| **BYOK User** | Uses their own API keys, no account | No |
| **Access Code User** | Received a code from the admin | Yes |
| **Hybrid User** | Has both own keys and an access code | Yes |
| **Admin** | App owner who generates and manages codes | Yes |

---

## Flow 1: First Visit

**Prerequisite:** None
**Screen:** Setup Page (Screen 1)

A new user opens Argeon for the first time. They're taken to a setup page where they have three paths:

- **Add their own API keys** — see Flow 2
- **Redeem an access code** — they sign in first (Flow 4), then type the code they received, click Redeem, and they're in
- **Just sign in** — to sync data from another device (Flow 4)

---

## Flow 2: Setting Up Own API Keys

**Prerequisite:** Flow 1
**Screen:** Setup Page (Screen 1)

The user wants to use their own API keys.

1. They pick a provider (e.g., OpenAI) and click the link to get an API key
2. They come back with the key and paste it in
3. They click "Validate & Save" — the app checks if the key works
4. If it works, the key is saved. If not, they see an error and can try again
5. They repeat for as many providers as they want (up to 4)
6. Once at least one key is saved, they can enter the app

No sign-in required for this path.

---

## Flow 3: Sending a Query (Own Keys)

**Prerequisite:** Flow 2
**Screen:** Home Page (Screen 2)

The user has their own keys and wants to ask a question.

1. They type a question and hit Enter
2. All their active providers answer at the same time
3. Responses stream in live, side by side (stacked on mobile)
4. After the responses finish, they can copy any response, retry one, or continue the conversation with a specific provider
5. Follow-up mode kicks in automatically — they can keep asking related questions with full context

Their queries go directly from their browser to each provider.

---

## Flow 4: Signing In

**Prerequisite:** None
**Screen:** Login Modal (Screen 7) → Auth Callback (Screen 6)

The user decides to sign in (from any sign-in button in the app).

1. They click "Sign in" and choose Google
2. They authorize on Google's screen
3. They're returned to Argeon, now signed in
4. Everything syncs to the cloud automatically in the background — keys, settings, and history work across devices

Signing in is optional for BYOK users. It's required for access codes.

---

## Flow 5: Redeeming an Access Code (Existing User)

**Prerequisite:** Flow 4
**Screen:** Settings Drawer (Screen 4, Account tab)

An existing user who is already signed in receives a code and wants to redeem it.

1. They open Settings → Account
2. They type the code (dashes fill in automatically)
3. They click "Redeem"
4. The code appears in their active codes list with a balance
5. The mode selector appears in the header so they can switch to Access Code mode

If the code is invalid, already used by someone else, blocked, or they already have 3 active codes, they see an error and can try again.

---

## Flow 6: Sending a Query (Access Code)

**Prerequisite:** Flow 1 (new user code redemption) or Flow 5 (existing user)
**Screen:** Home Page (Screen 2)

The user has a code with credit remaining and is in Access Code mode.

1. They type a question and hit Enter
2. All available providers answer (they don't need their own keys)
3. Responses stream in, and a small amount of credit is deducted for each
4. Their remaining balance and daily query count update after each query

They get 20 queries per day and responses are limited to shorter lengths to conserve credit.

---

## Flow 7: Switching Between Modes

**Prerequisite:** Flow 2 + Flow 5
**Screen:** Home Page (Screen 2, header)

A user has both their own keys and an access code. They can switch between the two modes anytime using a toggle in the header. Switching clears the current conversation. If they only have access codes, there's no toggle — they're always in Access Code mode.

---

## Flow 8: Running Out of Credit

**Prerequisite:** Flow 6
**Screen:** Home Page (Screen 2, banner)

The user's credit runs out. They're told their credit is depleted and can request more from the admin. If they have their own keys, they can switch to using those. They can also redeem another code if they have one.

---

## Flow 9: Hitting the Daily Limit

**Prerequisite:** Flow 6
**Screen:** Home Page (Screen 2, banner)

The user has sent 20 queries today. They're told the limit resets at midnight PST. If they have their own keys, they can switch to those and keep going.

---

## Flow 10: Follow-Up Questions

**Prerequisite:** Flow 3 or Flow 6
**Screen:** Home Page (Screen 2)

After getting responses, the user can ask follow-up questions. Each provider remembers the conversation context. They can also start a fresh conversation anytime. In Access Code mode, each follow-up uses a new query slot.

---

## Flow 11: Retrying a Failed Response

**Prerequisite:** Flow 3 or Flow 6
**Screen:** Home Page (Screen 2, response column)

If a provider fails to respond, the user can retry just that one provider. The other responses stay. In Access Code mode, a retry uses a new query slot.

---

## Flow 12: Viewing Query History

**Prerequisite:** Flow 3 or Flow 6
**Screen:** Home Page (Screen 2, sidebar)

The user can open a sidebar to see all their past queries. They can search, click to reload a past conversation, or delete sessions. History is stored locally and optionally synced to the cloud.

---

## Flow 13: Changing Settings

**Prerequisite:** Flow 2 or Flow 5
**Screen:** Settings Drawer (Screen 4)

The user can open settings to manage their API keys, choose models, adjust response length and temperature, change the theme, configure display options, manage history, and handle their account (sign in/out, sync, access codes).

---

## Flow 14: Signing Out

**Prerequisite:** Flow 4
**Screen:** Home Page (Screen 2, user menu)

The user signs out. If they have their own keys, the app keeps working — their keys are stored locally. They see a note that queries won't be synced. If they have no keys at all, they're sent back to setup. Access code features stop working until they sign back in.

---

## Flow 15: Admin — Generating a Code

**Prerequisite:** Flow 4 (admin account)
**Screen:** Admin Page (Screen 3)

The admin opens the admin dashboard, sets a credit amount, and generates a code. They copy the code and share it with someone (via email, message, etc.).

---

## Flow 16: Admin — Monitoring Usage

**Prerequisite:** Flow 15
**Screen:** Admin Page (Screen 3)

The admin can see every code they've generated: who redeemed it, how much credit remains, how much was spent, and a breakdown by provider. They can also see per-user and per-provider spending totals.

---

## Flow 17: Admin — Blocking a Code

**Prerequisite:** Flow 15
**Screen:** Admin Page (Screen 3)

The admin can block any code, which immediately prevents the user from sending more queries with it. They can unblock it later. If the user was mid-query when blocked, that query finishes but no more are allowed.

---

## Flow 18: Continue in Provider

**Prerequisite:** Flow 3 or Flow 6
**Screen:** Home Page (Screen 2, response column)

After getting a response, the user can choose to continue the conversation directly in that provider's own chat interface. The conversation is copied to their clipboard and the provider's site opens in a new tab.

---

## Flow 19: Judge Mode (parked)

Not exposed to users yet. The feature exists in code but needs a clearer product direction before surfacing.

---

## Negative Flows

### Sign-in fails

**Prerequisite:** Flow 4 attempted
**Screen:** Auth Callback (Screen 6)

The user tries to sign in but cancels on Google's screen or Google returns an error. They see an error page and can go back to setup. Nothing is saved or changed.

### API key is invalid

**Prerequisite:** Flow 2 attempted
**Screen:** Setup Page (Screen 1)

The user pastes a key and clicks "Validate & Save". The validation fails and they see an error message. The key is not saved. They can fix it and try again.

### Query fails for some providers

**Prerequisite:** Flow 3 or Flow 6 attempted
**Screen:** Home Page (Screen 2, response columns)

One or more providers fail to respond (bad key, outage, rate limit, network issue). The failed columns show error messages. The successful ones still show their responses. The user can retry the failed ones.

### Access code redemption fails

**Prerequisite:** Flow 1 or Flow 5 attempted
**Screen:** Setup Page (Screen 1) or Settings Drawer (Screen 4, Account tab)

The user enters a code and it doesn't work. They see a specific error: invalid code, already redeemed by someone else, blocked by admin, or they already have 3 active codes. The input stays filled so they can correct and retry.

### Query fails in Access Code mode

**Prerequisite:** Flow 6 attempted
**Screen:** Home Page (Screen 2)

The user sends a query but something goes wrong. If the server can't be reached, they see a reservation error. If providers fail after the reservation, the daily query slot is used but credit is partially refunded. They can retry or switch to their own keys.

### Session expires

**Prerequisite:** Flow 4 completed
**Screen:** Any screen requiring authentication

After about an hour, the sign-in session expires silently. The next action that needs authentication will fail. The user just needs to sign in again. Their local data is unaffected.

### Admin page access denied

**Prerequisite:** Flow 4 completed (non-admin user)
**Screen:** Admin Page (Screen 3) → redirects to Home Page (Screen 2)

A non-admin user tries to access the admin page directly. They're quietly redirected to the main page. No error shown.
