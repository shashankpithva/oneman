# Auto-post to X — one-time setup (free, ~10 minutes)

This lets OneMan publish approved posts straight to your X account. You hit **Approve** in the Outbox and the post goes live — no compose window.

**Why two steps?** Browsers physically can't call X's API (CORS), so a tiny server (a free Cloudflare Worker) makes the actual post. It holds **no passwords or secrets** — it uses X's secure OAuth 2.0 PKCE flow.

---

## Step 1 — Create a free X developer app (~5 min)

1. Go to **https://developer.x.com** and sign in. Apply for a **Free** developer account if you don't have one (instant for most).
2. In the **Developer Portal**, create a **Project**, then an **App** inside it.
3. Open your app → **User authentication settings** → **Set up** / **Edit**:
   - **App permissions:** **Read and write**
   - **Type of App:** **Native App** (this makes it a *public client* — no client secret, which is what keeps setup safe)
   - **Callback URI / Redirect URL:** paste your app page URL exactly:
     ```
     https://shashankpithva.github.io/oneman/app.html
     ```
   - **Website URL:** `https://shashankpithva.github.io/oneman/`
   - Save.
4. Go to **Keys and tokens** → copy the **OAuth 2.0 Client ID**. (You do **not** need the client secret.)

> Free tier allows ~1,500 posts/month — plenty for normal use.

---

## Step 2 — Deploy the free Worker (~5 min)

The Worker code is in this repo at `worker/oneman-x-worker.js`.

**Easiest (dashboard):**
1. Go to **https://dash.cloudflare.com** → sign up (free, no card).
2. **Workers & Pages** → **Create** → **Create Worker** → give it a name → **Deploy**.
3. Click **Edit code**, delete the sample, paste the entire contents of `worker/oneman-x-worker.js`, then **Deploy**.
4. Copy your Worker URL — it looks like:
   ```
   https://oneman-x.YOUR-NAME.workers.dev
   ```

**Or with the CLI (wrangler):**
```
npm i -g wrangler
wrangler login
wrangler deploy worker/oneman-x-worker.js --name oneman-x
```

---

## Step 3 — Connect it in OneMan (~30 sec)

1. Open the app → **Settings ▾ → X setup**.
2. Paste your **Client ID** and **Worker URL**, click **Save**.
3. Click **Connect X account** → you'll be sent to X to authorize → you'll land back on the app.
4. The status will show **✓ X account connected**.

That's it. Now when OneMan drafts an X post into the **Outbox**, just click **Post on X** / **Approve** and it publishes automatically.

---

## Notes
- If you don't connect an account, X posts fall back to the **1-click composer** (opens X with your text pre-filled).
- Tokens are stored only in your browser (localStorage) and auto-refresh.
- To lock the Worker to only your site, change `Access-Control-Allow-Origin: "*"` in the Worker to your Pages origin `https://shashankpithva.github.io`.
- LinkedIn and Instagram still use the 1-click composer (those platforms don't allow free automatic posting from a static site).
