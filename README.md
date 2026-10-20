# SMS Sentinel

> **Spot suspicious SMS before you click.**

SMS Sentinel is an Android app that reads every incoming SMS in real time (even with the screen off or the app closed), scores it for phishing and scam risk, and fires a high-priority alert when something looks dangerous.

* **Offline, instant:** 19 bilingual (EN/FR) regex rules score the message on the phone in milliseconds, no internet needed.
* **Online, deeper:** when internet is available, the text is also sent to your own Django backend, which asks an LLM (Gemini / Groq / any OpenAI-compatible API) and blends both scores.
* **Private by default:** the backend stores only a SHA-256 hash of each message unless you opt in.

```
┌──────────── Android phone ─────────────┐        ┌──────── Django backend ────────┐
│ SMS arrives                            │        │ POST /api/v1/analyze/          │
│   └─ Kotlin SmsReceiver (always on)    │        │   ├─ rules.json heuristics     │
│       1. offline rules  → score  ──────┼─alert─►│   ├─ LLM (Gemini/Groq/...)     │
│       2. if online: HTTP ──────────────┼───────►│   └─ blended score + reasons   │
│       3. update alert, save record     │◄───────┼── JSON                         │
│ React Native UI (Expo Router)          │        │ PostgreSQL (Neon/Supabase/...) │
└────────────────────────────────────────┘        └────────────────────────────────┘
```

Why the analysis runs in Kotlin and not in JavaScript: when an SMS arrives while the app is closed there is no JS runtime. The receiver therefore does the whole job natively (rules, network call, notification) and hands the result to the UI the next time it is open.

---

## 1. Repository layout

```
sms-sentinel/
├── package.json            npm workspaces + root scripts
├── turbo.json              Turborepo tasks (typecheck, test)
├── docker-compose.yml      optional local PostgreSQL
├── scripts/
│   ├── sync-rules.mjs      copies rules.json to the Kotlin assets + Django
│   └── doctor.mjs          checks your PC setup:  npm run doctor
├── packages/
│   └── contracts/          shared TypeScript DTOs + rules.json (single source of truth)
│       ├── rules.json
│       └── src/index.ts
└── apps/
    ├── backend/            Django + DRF + PostgreSQL
    │   ├── manage.py, requirements.txt, .env.example
    │   ├── Dockerfile, build.sh, render.yaml        (deployment)
    │   ├── sentinel/       settings.py, urls.py, wsgi.py
    │   └── analysis/       the API app
    │       ├── views.py, serializers.py, models.py, permissions.py, tests.py
    │       ├── data/rules.json                      (synced copy)
    │       └── services/
    │           ├── heuristics.py                    offline rule engine
    │           ├── ai_client.py                     Gemini / OpenAI-compatible clients
    │           └── analyzer.py                      hybrid blend
    └── mobile/             React Native + Expo (dev client) + Kotlin
        ├── app.json, eas.json, package.json, tsconfig.json, .env.example
        ├── app/            Expo Router screens: (tabs)/index|history|tips|settings, message/[id]
        ├── src/
        │   ├── components/ GlassCard, ShieldHero, ScoreBadge, MessageRow, ...
        │   ├── services/   ruleEngine.ts, api.ts, analyzer.ts, native.ts, permissions.ts, storage.ts
        │   ├── state/      SentinelContext.tsx
        │   └── theme.ts    colours, 12px radius, monospace font
        ├── modules/sentinel-sms/        ← the native Android module (Kotlin)
        │   ├── expo-module.config.json
        │   └── android/src/main/
        │       ├── AndroidManifest.xml  SMS_RECEIVED receiver + permissions
        │       ├── assets/sentinel_rules.json           (synced copy)
        │       └── java/expo/modules/sentinelsms/
        │           ├── SmsReceiver.kt   BroadcastReceiver entry point
        │           ├── Pipeline.kt      rules → alert → AI → alert update → save
        │           ├── RuleEngine.kt, ApiClient.kt, Notifier.kt
        │           ├── ConfigStore.kt, PendingStore.kt
        │           └── SentinelSmsModule.kt            JS ⇄ Kotlin bridge
        └── tests/ruleEngine.test.mjs
```

**One rules file, three engines.** Edit `packages/contracts/rules.json`, then run `npm run sync:rules`. The TypeScript, Kotlin and Python engines all read the same file, so the phone and the server never disagree.

---

## 2. Prerequisites

| Tool | Needed for | Check |
|---|---|---|
| **Node.js 20+** and npm | everything | `node -v` |
| **Python 3.10+** | backend | `python --version` |
| **Git** | EAS Build requires a git repo | `git --version` |
| **EAS CLI** + free Expo account | building the APK in the cloud (recommended) | `npm i -g eas-cli` |
| Android Studio, JDK 17, USB debugging | *only* if you build locally with `expo run:android` | `java -version` |
| Docker (optional) | local PostgreSQL | `docker -v` |

Run `npm run doctor` at any time for a quick report.

You do **not** need Android Studio to get the app on your phone: EAS builds the APK in the cloud (section 6).

---

## 3. Quick start on your PC (about 10 minutes)

### 3.1 Install

```bash
cd sms-sentinel
npm install                       # installs mobile + contracts + turbo
```

### 3.2 Start the backend

**macOS / Linux**

```bash
cd apps/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # works as-is: SQLite + rules-only
python manage.py migrate
python manage.py test             # 17 tests should pass
python manage.py runserver 0.0.0.0:8000
```

**Windows (PowerShell)**

```powershell
cd apps\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py test
python manage.py runserver 0.0.0.0:8000
```

Check it: open <http://localhost:8000/api/health/> → `{"status":"ok", ...}`.

Try the API:

```bash
curl -X POST http://localhost:8000/api/v1/analyze/ \
  -H "Content-Type: application/json" \
  -d '{"sender":"MTN","body":"URGENT: account suspended. Verify now http://bit.ly/x and confirm your PIN"}'
```

With `AI_PROVIDER=none` (default) you get the rules-only result. Add an AI key (section 4) to enable the AI half.

### 3.3 Use PostgreSQL locally (optional)

```bash
docker compose up -d              # from the repo root
# then in apps/backend/.env:
# DATABASE_URL=postgres://sentinel:sentinel@localhost:5432/sentinel
python manage.py migrate
```

### 3.4 Configure the mobile app

```bash
cd apps/mobile
cp .env.example .env              # Windows: Copy-Item .env.example .env
```

Set `EXPO_PUBLIC_API_URL` according to where the app runs:

| App runs on | `EXPO_PUBLIC_API_URL` |
|---|---|
| Android emulator | `http://10.0.2.2:8000` |
| Real phone, same Wi-Fi as the PC | `http://<PC-LAN-IP>:8000` (Windows: `ipconfig`, macOS/Linux: `ifconfig`) |
| Friends / anywhere | an HTTPS URL: your deployed backend or a tunnel (section 7.3) |

On Windows, allow Python through the firewall the first time it asks, or the phone cannot reach the PC.

> The URL can also be changed **inside the app** (Settings → Server URL) with a "Test connection" button, so a wrong value never forces a rebuild.

### 3.5 Run the app

SMS interception is native code, so **Expo Go cannot run it**. You need a *development build* (a custom APK that contains the Kotlin module). Pick one:

* **Cloud build (no Android Studio):** `eas build --profile development --platform android`, install the APK, then `npm run mobile` on your PC and open the project from the installed app. See section 6.
* **Local build:** with an emulator or a USB-connected phone, run `npm run mobile:android` from the repo root (first build takes several minutes).

The JS-only UI also opens in Expo Go for a quick look at the design; the shield then shows **Preview mode** and live SMS capture is disabled.

---

## 4. Environment variables and secrets

Two files, both created from templates and both git-ignored:

* `apps/backend/.env` (copy of `apps/backend/.env.example`)
* `apps/mobile/.env` (copy of `apps/mobile/.env.example`)

### Backend (`apps/backend/.env`)

| Key | Required | What it is | Where to get it (free) |
|---|---|---|---|
| `DJANGO_DEBUG` | yes | `True` locally, `False` in production | n/a |
| `DJANGO_SECRET_KEY` | prod | Django signing key | `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DJANGO_ALLOWED_HOSTS` | prod | Comma-separated hostnames | your Render/Koyeb hostname |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | prod (admin) | e.g. `https://my-api.onrender.com` | same |
| `DATABASE_URL` | no | Empty = local SQLite. Otherwise a Postgres URL | Neon / Supabase (section 5) |
| `APP_API_KEY` | recommended | Shared secret; app must send `X-API-Key` | invent one: `python -c "import secrets; print(secrets.token_hex(24))"` |
| `THROTTLE_RATE` | no | Per-IP limit, default `60/min` | n/a |
| `AI_PROVIDER` | no | `none`, `gemini`, `groq`, `openai`, `openrouter`, `huggingface`, `custom` | n/a |
| `AI_API_KEY` | if AI on | Provider key | see table below |
| `AI_MODEL` | no | Override the default model | provider docs |
| `AI_BASE_URL` | custom only | OpenAI-compatible base URL | n/a |
| `AI_TIMEOUT_SECONDS` | no | Default `8` | n/a |
| `STORE_MESSAGE_BODY` | no | `False` (default): store only a hash. `True`: also store first 160 chars | n/a |

### Mobile (`apps/mobile/.env`)

| Key | What it is |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend base URL, no trailing slash |
| `EXPO_PUBLIC_API_KEY` | Same value as `APP_API_KEY` (or empty) |

Important: `EXPO_PUBLIC_*` values are compiled into the app and readable by anyone who unpacks the APK. `APP_API_KEY` therefore deters casual abuse only; the real protection is the per-IP throttle and your AI provider's quota. Never put an AI key in the mobile app: it lives on the server only.

For cloud builds the `.env` file is **not** uploaded (it is git-ignored). Put the same two values in `apps/mobile/eas.json` (`build.<profile>.env`) or create them with `eas env:create` (section 6).

### Free AI providers

| `AI_PROVIDER` | Get a key | Notes |
|---|---|---|
| `gemini` | Google AI Studio → "Get API key" (aistudio.google.com) | Generous free tier; default model `gemini-2.5-flash-lite` |
| `groq` | console.groq.com → API Keys | Free tier, very fast; default `llama-3.3-70b-versatile` |
| `openrouter` | openrouter.ai → Keys | Has `:free` models; default `meta-llama/llama-3.3-70b-instruct:free` |
| `huggingface` | huggingface.co → Settings → Access Tokens | You must set `AI_MODEL` |
| `openai` | platform.openai.com | Paid |
| `custom` | any OpenAI-compatible server (Ollama, vLLM, LM Studio...) | Set `AI_BASE_URL` and `AI_MODEL` |

Free-tier limits and model names change often. If a call fails, open `/api/health/` and the server logs, then check the provider's current docs and set `AI_MODEL`. When the AI fails the backend automatically falls back to rules-only (`provider: "heuristics-fallback"`), so the app keeps working.

---

## 5. Zero-cost infrastructure

| Piece | Free option | Caveat |
|---|---|---|
| Backend hosting | **Render** (free web service), **Koyeb** (free instance), **Railway** (trial credit) | Free web services sleep when idle; first request after a pause can take 30-60 s. The app keeps the offline result meanwhile and Settings → Test connection has a 15 s timeout for this reason |
| PostgreSQL | **Neon** (free tier), **Supabase** (free tier) | Prefer Neon: Render's own free Postgres expires after about 30 days. Supabase pauses idle projects |
| AI | **Gemini**, **Groq**, **OpenRouter free models**, **Hugging Face** | Rate limits apply |
| APK builds | **EAS Build** free plan | Limited builds per month, queue may be slow |
| Public URL for tests | **cloudflared** quick tunnel | URL changes each run |

### 5.1 Neon database (2 minutes)

1. Sign up at neon.tech → create a project.
2. Copy the connection string (it ends with `?sslmode=require`).
3. Put it in `DATABASE_URL` (locally in `.env`, in production in the host's environment variables).
4. `python manage.py migrate`.

### 5.2 Deploy the backend on Render

1. Push this repo to GitHub.
2. Render → New → **Blueprint** → select the repo (it reads `apps/backend/render.yaml`), or create a *Web Service* manually: root directory `apps/backend`, build command `./build.sh`, start command `gunicorn sentinel.wsgi:application --workers 2 --timeout 30`.
3. Add environment variables: `DATABASE_URL` (Neon), `AI_PROVIDER`, `AI_API_KEY`, `APP_API_KEY`, `DJANGO_ALLOWED_HOSTS` (your `xxx.onrender.com`), `DJANGO_CSRF_TRUSTED_ORIGINS` (`https://xxx.onrender.com`). `DJANGO_SECRET_KEY` is generated by the blueprint.
4. Open `https://xxx.onrender.com/api/health/`.

Koyeb / Railway / Fly: use `apps/backend/Dockerfile` (it runs migrations on start and honours `$PORT`).

Optional admin: `python manage.py createsuperuser`, then `/admin/` lists scans (no message text unless you enabled `STORE_MESSAGE_BODY`).

---

## 6. Build the Android APK with EAS (cloud, no Android Studio)

```bash
npm i -g eas-cli
eas login
git init && git add . && git commit -m "SMS Sentinel"   # once, at the repo root
cd apps/mobile
eas init                                                # links an Expo project, writes projectId
```

Set the backend URL used inside the build, either by editing `apps/mobile/eas.json` (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_API_KEY` under `build.preview.env`) or with:

```bash
eas env:create --name EXPO_PUBLIC_API_URL --value https://xxx.onrender.com --environment preview --visibility plain-text
```

### Profiles

| Command | Result | Use it for |
|---|---|---|
| `eas build --profile preview --platform android` | Standalone release **APK**, works without your PC | Phones of you and your friends |
| `eas build --profile development --platform android` | **Development client** APK that loads JS from your PC | Daily coding with hot reload |
| `eas build --profile production --platform android` | AAB for Google Play | Later (see "Limits") |

The first build asks to generate an Android keystore: answer yes and let EAS keep it. Keep using the same keystore so updates install over older versions.

### Development client workflow

1. Install the `development` APK on your phone.
2. On the PC: `npm run mobile` (from the repo root) and open the app on the phone, or scan the QR code.
3. Edit code, save, the phone reloads. Kotlin changes require a new build.

---

## 7. Install and share the app (no Google Play account)

### 7.1 On your phone

When the build finishes, the terminal prints a link and a **QR code**; the same page is under *expo.dev → your project → Builds*. Open that link on the phone (or scan the QR), download the APK and install it. Android will ask you to allow "Install unknown apps" for your browser the first time.

Google Play Protect may show a warning for an unknown app that requests SMS access. Tap **More details → Install anyway**. This is expected for sideloaded apps.

### 7.2 Share with friends

Internal distribution on Android needs no device registration. Send your friends the build page link (or show the QR). They open it on their Android phone, download, install. You can also download the `.apk` from the build page and send the file directly.

### 7.3 Give testers a working backend without hosting anything

Keep the Django server running on your PC and expose it with a free tunnel:

```bash
cloudflared tunnel --url http://localhost:8000      # prints https://something.trycloudflare.com
```

Paste that URL in the app (Settings → Server URL → Save → Test connection). No rebuild is needed. The URL changes each time you restart the tunnel, and the PC must stay on. For stable testing deploy to Render (section 5.2).

---

## 8. Permissions, background execution and battery

### First launch

On the Shield tab press **Allow** next to *Read incoming SMS* and *Show alerts*. This requests `RECEIVE_SMS`, `READ_SMS` (only used by "Scan my recent inbox") and, on Android 13+, `POST_NOTIFICATIONS`.

* **SMS permission dialog missing or greyed out (Android 13+, sideloaded app):** Settings → Apps → SMS Sentinel → ⋮ (top-right) → **Allow restricted settings**, then grant the permissions again. The app's Settings tab has an "Open app settings" button.
* The app does **not** need to be your default SMS app to receive messages.

### Keep it alive

Android receives SMS broadcasts for installed apps even when they are closed, but aggressive battery managers can block that.

1. Shield tab → *Run in background* → **Open**, find SMS Sentinel and choose **Don't optimise / Unrestricted**.
2. Do **not** use *Force stop*. A force-stopped app receives nothing until you open it once.
3. On Xiaomi/Redmi/POCO, Tecno/Infinix/itel, Oppo, Vivo, Huawei, Samsung: also enable **Autostart** and remove the app from *sleeping/battery saver* lists (Settings → Battery → App launch / Sleeping apps). Device-specific steps: dontkillmyapp.com.
4. Keep notifications for the "Scam alerts" channel set to **High / Pop on screen**.

### How to test the alert

| Test | How |
|---|---|
| UI + scoring only | Shield tab → *Check a message* → paste → Analyze |
| Full native alert | Shield tab → *Simulate incoming scam SMS* (needs the dev/preview build) |
| Emulator, real SMS broadcast | `adb emu sms send 12345 "URGENT: verify at http://bit.ly/x and confirm your PIN"` |
| Real phone | Text it from a friend's phone, or use a second SIM / online SMS sender |

Then lock the screen, close the app from recents, send another test SMS: the heads-up alert should still appear.

---

## 9. How scoring works

* Each rule in `rules.json` that matches adds its `weight` (once). Total is clamped to 0-100. Negative weights are protective signals (e.g. a genuine "never share this code" line).
* Verdict: **Safe** `< 35` (green `#10B981`), **Caution** `35-64` (amber `#F59E0B`), **Danger** `≥ 65` (crimson `#EF4444`).
* Online: `final = round(0.35 × rules + 0.65 × AI)`. If the AI is ≥ 80 sure, final is at least `AI - 10`. If rules alone say Danger, the AI can lower the result but not below 60.
* Alerts: Danger by default; Settings → *Alert on suspicious too* also alerts on Caution. If a message looks risky offline, the alert appears **immediately**; when the AI answers, the same alert is updated in place (or removed if the AI says false alarm).

---

## 10. Commands cheat-sheet

```bash
npm install                      # root, once
npm run doctor                   # environment report
npm run sync:rules               # after editing packages/contracts/rules.json
npm run typecheck                # TypeScript, via Turborepo
npm test                         # backend tests + rules parity test
npm run backend                  # runserver on 0.0.0.0:8000 (venv active)
npm run mobile                   # Metro for the dev client
npm run mobile:android           # local native build + run
cd apps/mobile && npm run eas:preview   # cloud APK
```

---

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| Shield says **Preview mode** | You are in Expo Go or a build without the native module. Install the dev/preview APK |
| Test connection: "Cannot reach the server" | Wrong URL, firewall, or phone not on the same Wi-Fi. Emulator must use `10.0.2.2` |
| Test connection: "API key rejected (403)" | `APP_API_KEY` on the server ≠ key in Settings |
| `HTTP 400 Invalid HTTP_HOST` in Django logs | Add the hostname to `DJANGO_ALLOWED_HOSTS` (production) |
| Render cold start / timeout | Wait ~60 s and retry; the app already keeps the offline result |
| AI shows "heuristics-fallback" | Check `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`; read the server log line "AI unavailable" |
| `http://` backend blocked in a release build | `app.json` enables cleartext traffic for LAN testing. For production use HTTPS and set `usesCleartextTraffic` to `false` |
| No alert with screen off | Section 8: battery, autostart, force-stop |
| EAS build fails at Kotlin compile | Read the "Run gradlew" phase in the build log; Kotlin sources are in `apps/mobile/modules/sentinel-sms/android/src/main/java/...` |
| `expo install` version warnings | `cd apps/mobile && npx expo install --fix` |

Native logs on a USB-connected phone: `adb logcat -s SentinelSms SentinelPipeline SentinelApi SentinelRules`.

---

## 12. Privacy, limits and honest notes

* **Privacy:** SMS text leaves the phone only when *Online AI analysis* is on, and only goes to the backend URL you configured. The backend stores a SHA-256 hash by default. The LLM provider you choose does receive the text, so read its data policy before analysing sensitive messages.
* **Google Play:** Play restricts `RECEIVE_SMS`/`READ_SMS` to apps that are the default SMS handler or qualify for a narrow exception, so a Play Store release of this concept is unlikely to be approved. Sideloading (this guide) is not affected.
* **Android only.** iOS does not allow apps to read incoming SMS.
* **Rules are heuristics.** They will miss novel scams and sometimes flag legitimate messages; that is why the AI layer and the per-message breakdown exist. Tune `rules.json` for your country's senders and scams.
* **Verification status of this repository:** the Django backend (17 tests), the TypeScript type-check, the JS rule-parity test, the Metro bundle and Expo autolinking of the native module were run successfully when this project was generated. The Kotlin code could not be compiled in that environment, so the **first EAS build is its compile check**. If Gradle reports an error, the build log names the exact file and line.

---

## 13. Roadmap ideas

Per-sender allow-list, "report scam" feedback loop to refine rules, local on-device ML model, Kinyarwanda/Swahili rule packs, home-screen widget.
