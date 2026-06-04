# Polsia

Autonomous AI startup operator — marketing site + interactive web app.

Polsia onboards a founder, plans the company, runs AI "employee" agents that produce real deliverables (code, copy, plans), sends outreach email and posts to X after approval, and runs a live **Competitor Radar** that auto-detects competitors from your business description and streams their latest news.

## Project structure

```
polsia/
├── index.html        # Marketing site (landing page)
├── app.html          # The interactive Polsia app (onboarding, dashboard, Outbox, Live radar)
├── css/
│   ├── site.css      # Styles for index.html
│   └── app.css       # Styles for app.html
├── js/
│   ├── site.js       # Logic for index.html
│   └── app.js        # Logic for app.html (state, AI, agents, email, X, radar)
├── README.md
└── .gitignore
```

The app is fully client-side — no build step, no server. All state lives in the browser via `localStorage`.

## Run locally

Open `index.html` (or `app.html`) directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Serving over `http://localhost` (instead of `file://`) is recommended — some integrations (Google sign-in, secure crypto for password hashing, certain CORS news proxies) behave better in a secure/served context.

## Deploy free with GitHub Pages

1. Create a new GitHub repo and push this folder (see below).
2. In the repo: **Settings → Pages**.
3. Under **Build and deployment**, set **Source = Deploy from a branch**, **Branch = main**, **Folder = / (root)**, then **Save**.
4. Wait ~1 minute. Your site is live at `https://<your-username>.github.io/<repo-name>/`.
5. `app.html` is reachable at `.../app.html`.

## Push to GitHub (one time)

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

## Configuration (all in-app, stored in your browser)

- **Connect AI** — paste an API key from any major provider (OpenAI, Anthropic, OpenRouter, Groq, Gemini, DeepSeek, or any OpenAI-compatible/local endpoint). Required for agents and competitor auto-detection.
- **Email (EmailJS)** — public key, service ID, template ID to actually send approved outreach emails.
- **X (webhook)** — a Zapier/Make/IFTTT catch-hook URL to auto-post approved posts to X. Without it, the app falls back to opening the X composer.
- **News API** — optional. Defaults to key-free Google News; add a NewsData.io key for faster, structured competitor news.

No keys are committed to the repo — they are entered in the app UI and saved only in your browser's `localStorage`.
