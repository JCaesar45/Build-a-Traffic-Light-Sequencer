# Meridian Atelier

A waitlist-style landing page for a fictional independent watchmaker that finishes
eighteen movements a year. Built to show a real conversion flow end to end: a
static frontend with a live-ticking SVG dial, a typed client module, and a
Python API that actually stores and rate-limits applications instead of faking
a submit handler.

## Stack

- **HTML/CSS** — `index.html`, `css/styles.css`. No framework, no build step for
  the markup itself. The dial, spec sheet, and allocation steps are all real DOM/SVG,
  not screenshots.
- **JavaScript** — `js/script.js`. Draws the hour ticks, drives the hour/minute/second
  hands off `Date()` every animation frame, animates the power-reserve arc, and
  handles scroll-reveal via `IntersectionObserver`.
- **TypeScript** — `ts/src/app.ts`, compiled to `js/app.js`. A typed API client
  (`MeridianClient`), field-level validation, and the form submission flow that
  talks to the backend.
- **Python** — `backend/server.py`. FastAPI + SQLite. Validates and stores
  applications, computes queue position, detects duplicate emails per cycle,
  and rate-limits by client IP.

## Running it

### 1. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload --port 8811
```

This creates `backend/meridian.db` (SQLite) on first run. Endpoints:

- `GET /api/status` → `{ cycle, allocation_total, applications_received, spots_remaining }`
- `POST /api/applications` → body `{ name, email, country, note }`, returns
  `{ id, queue_position, cycle, status }` where `status` is `"received"` or
  `"duplicate"`.

Rate limit: 5 requests per client IP per 60-second window on the POST endpoint.

### 2. Frontend

The frontend is static. Serve the project root with anything:

```bash
python3 -m http.server 5500
```

Then open `http://localhost:5500`. By default the frontend calls the backend at
`/api`. If you're serving the frontend and backend from different origins, add
a meta tag to `index.html`:

```html
<meta name="meridian-api-base" content="http://localhost:8811/api">
```

### 3. Editing the TypeScript

Don't hand-edit `js/app.js` — it's generated. Edit `ts/src/app.ts` and rebuild:

```bash
npm install -g typescript   # if you don't already have tsc
tsc -p tsconfig.json
```

## Project layout

```
meridian/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── script.js        # hand-written, drives the dial + reveals
│   └── app.js           # compiled output — do not edit directly
├── ts/
│   └── src/app.ts       # source of truth for js/app.js
├── tsconfig.json
├── backend/
│   ├── server.py
│   └── requirements.txt
└── README.md
```

## Notes on the content

The brand, spec numbers, and copy are invented for this exercise — there's no
real "Meridian Atelier." The horological terms used (caliber, escapement,
power reserve, grand feu enamel, câté finishing) are real techniques described
accurately; only the specific product is fictional.
