# OneMan — Site-provided AI credits: setup

This replaces "connect your own AI key" with a site-owned model and a per-user
credit balance (metered by tokens). Free model now; swap to a premium model later
by changing 3 secrets — no code change.

## Files in this change
- `supabase/migrations/0001_credits.sql` — `credits` table + RLS + signup seed + debit/topup functions.
- `supabase/functions/ai/index.ts` — OpenAI-compatible proxy (holds the real key, checks balance, meters tokens).
- `js/credits.js` — client drop-in: auto-points the app at the proxy, shows the meter, billing modal.
- `app.html` — adds `<script src="js/credits.js?v=1"></script>`.

## 1. Database
Open Supabase → SQL editor → paste and run `supabase/migrations/0001_credits.sql`.
(The free base allowance is the `balance` default — 200,000 tokens. Change it there.)

## 2. Pick the model (free now)
Set the function secrets. Any OpenAI-compatible provider works.

Free example (OpenRouter free tier):
```
supabase secrets set AI_BASE_URL=https://openrouter.ai/api/v1
supabase secrets set AI_API_KEY=<your_openrouter_key>
supabase secrets set AI_MODEL=meta-llama/llama-3.1-8b-instruct:free
```
Other OpenAI-compatible free options: Groq (`https://api.groq.com/openai/v1`), Google Gemini's OpenAI endpoint, etc.

**Switch to premium later** — just change the secrets, e.g.:
```
supabase secrets set AI_BASE_URL=https://api.openai.com/v1 AI_API_KEY=<openai_key> AI_MODEL=gpt-4o
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — don't set them.

## 3. Deploy the function
```
supabase functions deploy ai --no-verify-jwt
```
`--no-verify-jwt` lets the browser call it with just the user's access token as the
`Authorization` bearer (the function verifies the user itself). CORS is handled in code.

## 4. Ship the site files
Drop in `js/credits.js` and the updated `app.html`, commit, push, hard-refresh.

## How it works
- On login, `credits.js` sets the app's AI config to `provider=compatible`,
  `base=<your-project>.supabase.co/functions/v1/ai`, `key=<user access token>`.
- Every `llmChat()` call (onboarding, agents, chat, website builder, social/email)
  now hits the proxy. The proxy ignores any client-supplied model and uses `AI_MODEL`.
- After each call the proxy reads `usage.total_tokens` and debits the balance via
  `consume_credits()`. At zero it returns HTTP 402 and the UI prompts to top up.
- The "Connect AI" pill now shows the credit balance and opens the billing modal.

## Stripe (later)
When ready: create a Stripe Checkout + a webhook function that, on `checkout.session.completed`,
calls `add_credits(user_id, tokens, plan)` (already in the migration). Then replace the
`Get more credits` button handler in `js/credits.js` with a redirect to Checkout.
