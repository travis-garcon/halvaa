# Halvaa.net — Project Documentation

Halvaa is a digital memorial platform. Families and communities can create bright, multilingual memorial profiles with timelines, guestbooks, galleries, geo discovery, and personalized themes.

This repository rebuilds the original **PHP/HTML prototype** as a production-oriented **FastAPI + PostgreSQL/PostGIS** backend and a **Next.js 16** frontend. The frontend goal is a **faithful port of the original UI** — same layout, class names, and visual design — not a redesign.

---

## Table of contents

1. [Architecture](#architecture)
2. [Tech stack](#tech-stack)
3. [Repository structure](#repository-structure)
4. [Legacy UI port strategy](#legacy-ui-port-strategy)
5. [Prerequisites](#prerequisites)
6. [Quick start](#quick-start)
7. [Environment variables](#environment-variables)
8. [Database & migrations](#database--migrations)
9. [Backend API](#backend-api)
10. [Security](#security)
11. [Domain model](#domain-model)
12. [Frontend](#frontend)
13. [Internationalization & RTL](#internationalization--rtl)
14. [Persian locale (`/fa`)](#persian-locale-fa)
15. [Typography & theming](#typography--theming)
16. [Testing](#testing)
17. [Deployment](#deployment)
18. [Production checklist](#production-checklist)
19. [Current status](#current-status)
20. [Known issues & audit notes](#known-issues--audit-notes)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js 16 (frontend)                   │
│  Legacy SPA shell (HalvaaApp) · next-intl · SWR · Swiper    │
│  /en  /fa  →  5-tab app (Home · Explore · Messages · …)     │
│  /explore · /memorial/[slug]  →  API-wired modern routes    │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP (JSON)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI (backend)                        │
│  JWT auth · RBAC · Rate limits · GeoJSON · BackgroundTasks  │
└───────┬─────────────────────────────┬───────────────────────┘
        │                             │
        ▼                             ▼
┌───────────────┐             ┌───────────────┐
│  PostgreSQL   │             │     Redis     │
│  + PostGIS    │             │  rate limits  │
└───────────────┘             └───────────────┘
```

**Data flow highlights**

- The home route renders a single-page app matching `old/halvaa.html` (Swiper tabs, bottom nav, legacy CSS).
- Memorial carousels and the Explore canvas load **locale-specific seed data**: Western figures for `/en`, Iranian poets, artists, and cultural icons for `/fa`.
- The home hero shows a **culture-specific featured gallery** (three rotating personalities) based on the active locale.
- Separate routes `/explore` and `/memorial/[slug]` use SWR hooks against the FastAPI backend (GeoJSON nearby search, guestbook, profile).
- Guestbook entries are moderated (`PENDING` → `APPROVED` / `REJECTED`).
- Image uploads trigger a background WebP thumbnail job (max 400×400).

---

## Tech stack

| Layer | Technology | Version (pinned in repo) |
|-------|------------|--------------------------|
| Backend | FastAPI, Python 3.11+, SQLModel, Alembic | FastAPI ≥0.115, Pydantic ≥2.10 |
| Database | PostgreSQL 16 + PostGIS | PostGIS 3.4 (Docker image) |
| Cache / limits | Redis | Redis 7 (Docker) |
| Frontend | Next.js App Router, TypeScript, React 19 | Next **16.2.7**, React **19.2.7** |
| Styling | Tailwind CSS 4 (modern routes) + legacy CSS (SPA shell) + `halvaa-ui-polish.css` | Tailwind **4.3** |
| UI (primary) | Legacy CSS (`public/assets/app.css`), Swiper 12, canvas explore grid | Swiper **12.2** |
| UI (secondary) | Tailwind + MapLibre on `/explore` and `/memorial/[slug]` | maplibre-gl **5.24** |
| i18n | next-intl (`en`, `fa`) with legacy translation keys from `old/api.php` | next-intl **4.13** |
| Client data | SWR | SWR **2.4** |
| Maps | MapLibre GL — tiles/fonts/sprites proxied through same-origin Next.js API routes | Zero external tile requests in browser |
| Auth | Zitadel OIDC (PKCE, session cookie) + legacy JWT Bearer fallback; wired in `AuthModal` + `ProfileTab` | `Authlib` on backend |

**Design language** (preserved from prototype)

- Dominant colors: White `#FFFFFF`, Halvaa Orange `#FF6B00`
- Bright, minimalist UI — no dark cemetery aesthetic
- English: **Google Sans** (self-hosted woff2; no Google Fonts API dependency)
- Persian: **IRANYekanX** (via `IRANYekanX Pro/` font package)

---

## Repository structure

```
Halvaa/
├── backend/                      # FastAPI application
│   ├── Dockerfile                # Backend runtime image
│   ├── alembic/                  # Database migrations
│   ├── app/
│   │   ├── api/                  # Routes & dependencies
│   │   ├── core/                 # Config, auth, security, limiter
│   │   ├── models/               # SQLModel tables & enums
│   │   ├── schemas/              # Pydantic V2 request/response models
│   │   └── services/             # Permissions, geo, media, uploads
│   ├── lib/                      # Zitadel OAuth client, config, guard
│   ├── scripts/
│   │   └── seed_dev_data.py      # Idempotent dev seed (Boston memorials)
│   ├── tests/                    # 39 pytest tests
│   ├── requirements.txt
│   ├── .env.example
│   └── .env.production.example
├── frontend/                     # Next.js application
│   ├── Dockerfile                # Frontend runtime image
│   ├── .env.production.example
│   ├── messages/                 # en.json, fa.json (legacy keys)
│   ├── public/
│   │   ├── assets/               # Legacy CSS, images (from old/assets/)
│   │   ├── fonts/google-sans/    # Self-hosted Google Sans woff2 + @font-face CSS
│   │   ├── fonts/iranyekan/      # fontiran.css (+ woff2 binaries)
│   │   └── images/               # Local SVG placeholders (avatar, etc.)
│   ├── src/
│   │   ├── app/[locale]/         # App Router pages
│   │   ├── proxy.ts              # next-intl locale routing (replaces middleware.ts)
│   │   ├── components/
│   │   │   ├── legacy/           # Faithful UI port (HalvaaApp, tabs, AuthModal, …)
│   │   │   ├── explore/          # MapLibre explore hub (separate route)
│   │   │   ├── memorial/         # Profile + guestbook (separate route)
│   │   │   └── ui/               # MemorialImage, shared modern primitives
│   │   ├── data/
│   │   │   ├── memorial-data.json
│   │   │   └── memorial-data-fa.json
│   │   ├── hooks/                # SWR data hooks
│   │   ├── i18n/                 # next-intl routing
│   │   ├── lib/
│   │   │   ├── legacy/           # explore-canvas.ts, memorials.ts
│   │   │   └── api-client.ts, auth-storage.ts, …
│   │   ├── providers/            # SWR provider
│   │   └── styles/
│   │       └── legacy-overrides.css
│   ├── package.json
│   └── .env.local.example
├── old/                          # Original prototype (read-only reference)
│   ├── halvaa.html               # Single-page app structure
│   ├── api.php                   # Legacy API + i18n strings
│   ├── memorial-data.json
│   └── assets/                   # app.css, app.js, explore-canvas.js, img/
├── IRANYekanX Pro/               # Licensed Persian font package
│   └── Webfonts/                 # fontiran.css, woff2/ (copy into public/)
├── docker-compose.yml            # Local dev infra (PostGIS + Redis + local map)
├── docker-compose.prod.yml       # App + PostGIS + Redis deployment stack
└── docs.md                       # This file
```

**Do not delete `old/`** — it is the authoritative reference for UI structure, class names, and behavior during the Next.js port.

---

## Legacy UI port strategy

The rebuild follows these rules:

1. **Preserve the original design** — reuse legacy CSS (`app.css`) and HTML class names; avoid Tailwind-based redesigns on the main app shell.
2. **Single-page tab model** — the home route (`/[locale]`) renders `HalvaaApp`, mirroring `old/halvaa.html`:
   - Swiper tab container (`#tabsSwiper`) with five slides: Home, Explore, Messages, Store, Profile
   - Desktop header, mobile drawer, bottom navigation with glider
   - Auth modal and create-memorial bottom sheet (UI ported; backend wiring pending)
3. **TypeScript ports of legacy JS** — e.g. `lib/legacy/explore-canvas.ts` from `old/assets/explore-canvas.js`.
4. **Locale-specific seed data** — `memorial-data.json` (EN) and `memorial-data-fa.json` (FA) power carousels, hero gallery, and explore canvas until FastAPI replaces `api.php`.
5. **Separate API routes remain** — `/explore` and `/memorial/[slug]` were built earlier with SWR + Mapbox; they will be merged into the tab/modal model or kept as deep links.

### Port status

| Area | Status |
|------|--------|
| Layout shell (`HalvaaApp`, header, nav, tabs) | Done |
| Home tab (hero gallery, carousels, upgrades, footer) | Done (locale-aware) |
| Explore tab (canvas grid) | Done (locale-aware static data) |
| Persian locale (`/fa`) — IRANYekan, RTL, culture-specific data | Done |
| Messages / Store / Profile tabs | UI shell |
| Auth modal → FastAPI login/register | **Done** (`useAuth`, `AuthModal`, `ProfileTab`) |
| Create memorial sheet | UI shell |
| Memorial profile modal (legacy used modal, not page) | Not ported — `/memorial/[slug]` page instead |
| FastAPI wiring (auth, memorials, guestbook, explore) | **Done** on modern routes |
| Dev seed data (`scripts/seed_dev_data.py`) | **Done** |
| IRANYekanX font binaries in `public/fonts/` | CSS linked; copy `.woff2` from font package |

---

## Prerequisites

- **Docker Desktop** (for PostGIS + Redis)
- **Python 3.11+**
- **Node.js 20+** and npm
- **IRANYekanX license** — font files from `IRANYekanX Pro/Webfonts/`
- **Map tiles (production)** — optional self-hosted MapLibre style URL (`NEXT_PUBLIC_MAP_STYLE_URL`); dev uses free OpenFreeMap

---

## Quick start

### 1. Start infrastructure

```bash
docker compose up -d db redis
```

PostgreSQL is available at `localhost:5432` (user/password/db: `halvaa`).

### 2. Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux

alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

API docs (development): http://localhost:8000/docs

Health check: http://localhost:8000/health

### 3. Frontend

```bash
cd frontend
npm install
copy .env.local.example .env.local   # Windows
# cp .env.local.example .env.local   # macOS/Linux

npm run dev
```

App: http://localhost:3000 (redirects to `/en`)

The legacy UI loads at `/en` and `/fa`. Separate routes `/en/explore` and `/en/memorial/[slug]` remain available for API-integrated views.

### 3b. Local map terrain (optional)

To extract a matching local terrain DEM archive for 3D terrain:

```powershell
.\scripts\download-local-map.ps1 -IncludeTerrain
```

The default terrain extract uses `-TerrainMaxZoom 10` to keep the local file
size practical. Increase it manually only if you need more terrain detail.

Then enable it in `frontend/.env.local`:

```text
NEXT_PUBLIC_LOCAL_MAP_TERRAIN_PM_TILES_URL=http://localhost:8081/terrain-dem.pmtiles
```

The terrain source is a Terrarium-encoded raster DEM subset extracted from Mapterhorn PMTiles.

### 4. IRANYekanX fonts (Persian UI)

Copy font binaries from the package into the public folder:

```
IRANYekanX Pro/Webfonts/woff2/*  →  frontend/public/fonts/iranyekan/woff2/
IRANYekanX Pro/Webfonts/woff/*   →  frontend/public/fonts/iranyekan/woff/
```

`fontiran.css` is already linked in `[locale]/layout.tsx` with absolute paths (`/fonts/iranyekan/woff2/...`).

### 5. Seed development data (recommended)

With the backend running and migrations applied, seed published memorials near Boston (for `/explore` and map views):

```bash
cd backend
.venv\Scripts\python.exe -m scripts.seed_dev_data    # Windows
# python -m scripts.seed_dev_data                     # macOS/Linux
```

This creates (idempotently):

- Admin user: `dev@example.com` / `devpassword123`
- Several `PUBLISHED` / `FEATURED` memorials with PostGIS coordinates, timelines, and guestbook entries

Sign in via the Profile tab auth modal or test at http://localhost:3000/en/explore.

**Manual alternative** — register via API:

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@halvaa.net","password":"securepass1","full_name":"Owner","locale":"en"}'
```

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://halvaa:halvaa@localhost:5432/halvaa` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis for rate limiting |
| `SECRET_KEY` | `change-me-in-production` | JWT signing secret |
| `ENVIRONMENT` | `development` | `development` \| `staging` \| `production` |
| `CORS_ORIGINS` | `http://localhost:3000,...` | Comma-separated allowed origins |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | JWT lifetime |
| `UPLOAD_DIR` | `uploads` | Local media storage path |
| `ZITADEL_DOMAIN` | `http://localhost:8080` | Zitadel instance URL (Cloud or self-hosted) |
| `ZITADEL_CLIENT_ID` | — | OIDC client ID from Zitadel console |
| `ZITADEL_CLIENT_SECRET` | — | OIDC client secret |
| `ZITADEL_CALLBACK_URL` | `http://localhost:3000/api/v1/auth/callback` | Redirect URI registered in Zitadel |
| `ZITADEL_POST_LOGIN_URL` | `/` | Where to send user after login |
| `ZITADEL_POST_LOGOUT_URL` | `/` | Where to send user after logout |
| `SESSION_SECRET` | `change-me-to-a-strong-random-secret` | Starlette session encryption (generate with `secrets.token_hex(32)`) |
| `SESSION_DURATION` | `86400` | Session cookie max age (seconds) |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1` | Backend base URL |
| `NEXT_PUBLIC_MAP_STYLE_URL` | *(OpenFreeMap liberty)* | MapLibre-compatible `style.json` URL; set `""` to disable map |
| `NEXT_PUBLIC_DEMO_FALLBACK` | `false` | When `true`, show sample grid/map data if API is empty or errors |
| `NEXT_PUBLIC_LOCAL_MAP_TERRAIN_PM_TILES_URL` | — | Optional local Terrarium DEM PMTiles URL for 3D terrain, e.g. `http://localhost:8081/terrain-dem.pmtiles` |

---

## Database & migrations

PostGIS is enabled in migration `001_initial_schema`.

```bash
cd backend
alembic upgrade head      # Apply migrations
alembic downgrade -1      # Roll back one revision
```

**Main tables**

- `users`
- `memorials` (JSONB translations, theme overrides, PostGIS burial point)
- `memorial_collaborators` (RBAC)
- `timeline_events`
- `guestbook_entries`
- `media_assets`

---

## Backend API

Base path: `/api/v1`

### Auth

| Method | Path | Auth | Rate limit |
|--------|------|------|------------|
| `POST` | `/auth/register` | — | 10/min (legacy password-based) |
| `POST` | `/auth/login` | — | 10/min (legacy form: `username`, `password`) |
| `GET` | `/auth/me` | Session cookie or Bearer | default |
| `GET` | `/auth/signin` | — | Redirects to Zitadel OIDC login |
| `GET` | `/auth/callback` | — | Zitadel redirect handler; sets session cookie |
| `POST` | `/auth/logout` | Session | Clears session + redirects to Zitadel logout |

Zitadel uses PKCE flow with session cookies (HttpOnly, same-site=lax). Legacy JWT Bearer tokens still work for backward compat.

### Memorials

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `POST` | `/memorials` | Bearer | Creates DRAFT + OWNER collaborator |
| `GET` | `/memorials/{id}` | Optional | Draft hidden as 404 for strangers |
| `GET` | `/memorials/slug/{slug}` | Optional | Public slug lookup |
| `PATCH` | `/memorials/{id}` | Bearer (EDITOR+) | |
| `POST` | `/memorials/{id}/status` | Bearer (OWNER) | Workflow transitions |

### Explore

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/explore/nearby` | GeoJSON `FeatureCollection` of published/featured memorials |

Query params: `latitude`, `longitude`, `radius_m` (100–100000), `locale`

### Guestbook

| Method | Path | Auth | Rate limit |
|--------|------|------|------------|
| `GET` | `/memorials/{id}/guestbook` | — | Approved entries only |
| `POST` | `/memorials/{id}/guestbook` | Optional | 5/min |
| `PATCH` | `/memorials/{id}/guestbook/{entry_id}` | Bearer (EDITOR+) | Moderation |

### Media

| Method | Path | Auth | Rate limit |
|--------|------|------|------------|
| `GET` | `/memorials/{id}/media` | Bearer (VIEWER+) | |
| `POST` | `/memorials/{id}/media` | Bearer (EDITOR+) | 20/hour upload |

Uploads validate magic bytes (JPEG, WebP, MP4, PDF) and size limits. Images get an async WebP thumbnail (400×400 max).

---

## Security

| Control | Implementation |
|---------|----------------|
| Rate limiting | slowapi + Redis; IP or user key |
| CORS | Explicit origins only; credentials enabled |
| Headers | `X-Content-Type-Options`, `X-Frame-Options: DENY`, strict CSP |
| BOLA/BFLA | Memorial ownership checked per request; draft → 404 for unauthorized |
| Input sanitization | Pydantic V2 `SanitizedStr` strips HTML/control chars |
| Upload safety | Magic-number validation, extension allowlist, size ceilings |
| JWT | HS256; set a strong `SECRET_KEY` in production |
| Auth | Zitadel OIDC PKCE (primary); JWT Bearer fallback (legacy) | Session cookie (HttpOnly, signed) |

**Verify security headers**

```bash
curl -i http://localhost:8000/health
```

**Verify rate limit**

```bash
# Repeat login rapidly; expect 429
curl -X POST http://localhost:8000/api/v1/auth/login \
  -F "username=test@halvaa.net" -F "password=wrongpass"
```

---

## Domain model

### Memorial workflow

```
DRAFT → PENDING_APPROVAL → PUBLISHED → FEATURED
```

Only `PUBLISHED` and `FEATURED` memorials appear in `/explore/nearby` and public search.

### Collaborator roles

| Role | Permissions |
|------|-------------|
| `OWNER` | Full control, status changes |
| `EDITOR` | Edit content, moderate guestbook, upload media |
| `VIEWER` | Read private drafts |

### Translations (JSONB)

```json
{
  "en": { "name": "...", "biography": "...", "epitaph": "..." },
  "fa": { "name": "...", "biography": "...", "epitaph": "..." }
}
```

### Theme overrides (JSONB)

Injected as CSS custom properties on memorial profile roots:

```json
{ "--color-primary": "#FF6B00" }
```

---

## Frontend

### Routes

| Path | Description |
|------|-------------|
| `/[locale]` | **Primary UI** — legacy single-page app (`HalvaaApp`) with 5 tabs |
| `/[locale]/explore` | Standalone explore hub (SWR + MapLibre + watch grid) |
| `/[locale]/memorial/[slug]` | Memorial profile, timeline, guestbook (API-backed) |

Locales: `en` (LTR), `fa` (RTL)

### Legacy app shell (`components/legacy/`)

| Component | Role |
|-----------|------|
| `HalvaaApp` | Root shell: tab Swiper, nav, modals |
| `HomeTab` | Hero (featured gallery), memorial carousels, store teasers, footer |
| `HeroFeaturedMemorials` | Dynamic hero portraits — culture-specific by locale |
| `ExploreTab` | Search, filters, draggable canvas (`useExploreCanvas`) |
| `MessagesTab` | Messages placeholder |
| `StoreTab` | Credit packs swiper, purchase history |
| `ProfileTab` | Account — shows user info when signed in (`useAuth`) |
| `SiteHeader` / `MobileMenu` / `BottomNav` | Navigation |
| `AuthModal` | Sign in / sign up — wired to FastAPI (`useAuth`) |
| `MemorialCarousel` / `MemorialCard` | Swiper carousels on home |

Styles are loaded from `/assets/app.css` (legacy) plus `src/styles/legacy-overrides.css` (font families, RTL tweaks).

### Data layer (SWR) — API routes

| Hook | Purpose |
|------|---------|
| `useGeolocation` | Browser coords with Boston fallback |
| `useNearbyMemorials` | Explore GeoJSON + grid items |
| `useMemorial` | Profile by slug |
| `useGuestbook` | Approved entries + submit |

Auth is session-cookie based via Zitadel OIDC (HttpOnly, same-site=lax). Legacy JWT Bearer tokens in `localStorage` (`halvaa_access_token`) still work for backward compat. `useAuth` always fetches `/auth/me` (session cookie sent automatically by browser). Memorial slug fetches include credentials so collaborators can view drafts.

### Static data — legacy tab app

| File | Purpose |
|------|---------|
| `src/data/memorial-data.json` | English/Western seed memorials (`/en`) |
| `src/data/memorial-data-fa.json` | Persian/Iranian cultural figures (`/fa`) |
| `src/lib/legacy/memorials.ts` | `getLegacyMemorials(locale)`, `getHeroFeaturedMemorials(locale)` |
| `src/lib/legacy/explore-canvas.ts` | Canvas engine (port of `old/assets/explore-canvas.js`) |

### Explore canvas animation (`ExploreTab`)

The explore tab renders an **Apple Watch-style honeycomb grid** using an HTML5 Canvas engine (`src/lib/legacy/explore-canvas.ts`):

- **Grid layout**: 20×20 circular cells arranged in a honeycomb pattern where odd-numbered rows are offset by half a cell width.
- **Distance scaling**: Circles near the center appear larger; those near the edges shrink proportionally (controlled by `SCALE_FACTOR = 420`), creating a subtle 3D depth effect.
- **Touch interaction**: Pointer events drive drag-to-pan with a 6px threshold. Clicking/tapping a circle navigates to the memorial profile.
- **Image loading**: Person images from `memorial-data.json` (or `memorial-data-fa.json` for `/fa`) are loaded into the canvas; fallback to `i.pravatar.cc` if no image is provided.
- **Performance**: Uses `requestAnimationFrame` for smooth 60fps rendering and HiDPI (`devicePixelRatio`) canvas scaling.

The engine automatically pauses when the explore tab is not active (prevents unnecessary CPU usage).

These predate the legacy port and remain on `/explore` and `/memorial/[slug]`:

- `ExploreHub`, `ExploreWatchGrid`, `MapboxMap`
- `MemorialProfile`, `MemorialTimeline`, `GuestbookSection`
- `MemorialImage`, `MemorialThemeRoot`

The redesign components (`Header`, `HeroSection`, `ExploreTeaser`) are **not** used on the home route.

### Scripts

```bash
npm run dev        # Development server
npm run build      # Production build
npm run start      # Serve production build
npm run lint       # ESLint
npm run typecheck  # TypeScript
```

---

## Internationalization & RTL

- **next-intl** with `src/proxy.ts` locale routing (Next.js 16 proxy convention; replaces `middleware.ts`)
- Message files: `frontend/messages/en.json`, `frontend/messages/fa.json`
- Translation keys match the legacy `old/api.php` structure (`nav`, `hero`, `section`, `store`, `auth`, `explore`, `messages`, `profile`, `common`, `memorial`)
- `<html lang="..." dir="rtl|ltr">` set in `[locale]/layout.tsx`
- Language switcher in header/mobile menu calls `router.replace` to swap locale while preserving path

---

## Persian locale (`/fa`)

The original product spec called for **strict bilingual support** with a dedicated Persian experience — not just translated strings, but culture-specific content, RTL layout, and IRANYekan typography. This section documents that implementation.

### Route & direction

| Item | Value |
|------|-------|
| URL prefix | `/fa` (e.g. `http://localhost:3000/fa`) |
| HTML | `<html lang="fa" dir="rtl">` |
| Body class | `rtl-mode` (set in `[locale]/layout.tsx`) |

Switching language from the header preserves the current path and reloads content for the new locale.

### Typography (IRANYekanX)

Persian text uses **IRANYekanX** from the licensed `IRANYekanX Pro/` package:

```
IRANYekanX Pro/Webfonts/woff2/*  →  frontend/public/fonts/iranyekan/woff2/
```

CSS is loaded via `/fonts/iranyekan/fontiran.css`. Font families are applied in `src/styles/legacy-overrides.css`:

- Body copy: `IRANYekanX`
- Headings (hero title, section titles): `IRANYekanX` with Anybody fallback

English (`/en`) uses **Google Sans** (self-hosted woff2, local `@font-face` in `public/fonts/google-sans/google-sans.css`). No Google Fonts API dependency.

### Culture-specific content

As specified in the initial feature brief — *“Dynamic Hero showing culture-specific celebrities based on selected locale”* — the app serves different memorial seed data per locale:

| Locale | Data file | Content |
|--------|-----------|---------|
| `en` | `memorial-data.json` | Western/international sample memorials |
| `fa` | `memorial-data-fa.json` | Iranian poets, writers, musicians, filmmakers, and cultural figures |

**Where locale data appears**

1. **Hero featured gallery** (`HeroFeaturedMemorials`) — three rotating portraits with name, occupation, and epitaph
2. **Home carousels** — Recently Passed, In Loving Memory, Remembered Today, Anniversaries
3. **Explore canvas** — draggable circular grid of the same locale’s memorials

Helper functions in `src/lib/legacy/memorials.ts`:

```typescript
getLegacyMemorials(locale)        // full list for carousels + canvas
getHeroFeaturedMemorials(locale) // first three for hero gallery
getMemorialById(id, locale)     // lookup by ID within locale data
```

### RTL layout adjustments

Legacy CSS was authored primarily for LTR. Persian overrides in `legacy-overrides.css` include:

- Right-aligned hero featured copy
- RTL direction on hero buttons, section headers, and explore filter chips
- Bottom-nav glider origin flipped for RTL

Further RTL polish should follow the same pattern: prefer `html[lang="fa"]` / `html[dir="rtl"]` selectors in `legacy-overrides.css` rather than modifying the base `app.css`.

### Persian translations

UI strings live in `frontend/messages/fa.json`. Keys mirror the legacy `old/api.php` structure:

- `nav`, `hero`, `section`, `store`, `auth`, `explore`, `messages`, `profile`, `common`, `memorial`, `metadata`

Hero featured label example: `hero.featured.label` → `"امروز به یادشان"`.

### Testing the Persian experience

```bash
cd frontend && npm run dev
```

Open http://localhost:3000/fa and verify:

- [ ] Page direction is RTL; IRANYekanX renders (after font binaries are copied)
- [ ] Hero shows three Iranian cultural figures, rotating every ~4.5s
- [ ] Home carousels list Persian names and biographies
- [ ] Explore tab canvas shows Persian memorial portraits
- [ ] Language switcher toggles between `/en` and `/fa` without losing tab state path

---

## Typography & theming

### Fonts

| Locale | Font | Source |
|--------|------|--------|
| English | Google Sans | Self-hosted woff2 (`public/fonts/google-sans/google-sans.css`); no external CDN |
| Persian | IRANYekanX | `IRANYekanX Pro/` → `public/fonts/iranyekan/woff2/` |

### CSS layers

1. **`public/assets/app.css`** — full legacy stylesheet (~4500 lines, from `old/assets/`)
2. **`src/styles/legacy-overrides.css`** — font-family overrides via `html[lang]` selectors, hero featured gallery, RTL layout, `.sr-only` utility
3. **`src/styles/halvaa-ui-polish.css`** — design system tokens (colors, z-index scale, shadows), interaction rules (focus-visible, hover states, transitions), `prefers-reduced-motion`
4. **`src/styles/globals.css`** — Tailwind tokens, component classes (`.halvaa-container`, `.halvaa-btn-primary`, `.halvaa-btn-secondary`), CSS custom properties

Memorial-specific theme overrides via `MemorialThemeRoot` and `lib/theme.ts` apply on `/memorial/[slug]`.

---

## Testing

### Backend

```bash
cd backend
.venv\Scripts\python.exe -m pytest tests/ -v    # Windows
# python -m pytest tests/ -v                    # macOS/Linux — 39 tests
```

| Test file | Coverage |
|-----------|----------|
| `test_models.py` | Enums, memorial graph, PostGIS fields |
| `test_validators.py` | XSS sanitization, slug rules |
| `test_api_security.py` | Security headers, CORS |
| `test_permissions.py` | RBAC ordering, 404 on missing memorial |
| `test_api_integration.py` | Explore GeoJSON, memorial profiles, guestbook, auth |
| `test_upload_and_workflow.py` | Upload validation, memorial status workflow |
| `test_config.py` | Production `SECRET_KEY` + `CORS_ORIGINS` guards |

**Note**: Models use PostgreSQL-specific `JSONB` columns. The permissions test mocks the database session instead of using SQLite, avoiding incompatible type compilation.

### Frontend

```bash
cd frontend
npm run typecheck    # TypeScript type checking (tsc --noEmit)
npm run lint         # ESLint (legacy port rules: img-element, css-tags allowed)
npm run build        # Production build (typecheck + lint included)
```

---

## Deployment

### Docker-based deployment

The repository now includes runtime images for both apps plus a deployment compose file:

- `backend/Dockerfile`
- `frontend/Dockerfile`
- `docker-compose.prod.yml`
- `.env.prod.example`
- `backend/.env.production.example`
- `frontend/.env.production.example`
- `scripts/deploy.sh`

The frontend image now uses Next.js `output: "standalone"`, so the runtime container does not perform a second `npm install`.

### Recommended deployment flow

1. Create real production env files:
   - `.env` at repo root (start from `.env.prod.example`)
   - `backend/.env.production` (start from `backend/.env.production.example`)
   - keep frontend public envs in the root `.env` so compose can pass them into the frontend image build
2. Set at minimum:
   - `ENVIRONMENT=production`
   - strong `SECRET_KEY`
   - production `DATABASE_URL`
   - production `REDIS_URL`
   - production `CORS_ORIGINS` as a JSON array, for example `["https://halvaa.example.com"]`
    - production `NEXT_PUBLIC_API_URL`
    - optional production map overrides if you are self-hosting map assets
3. Build and start:

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

4. Apply database migrations:

```bash
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

5. Verify health:

```bash
curl http://localhost:8000/health
curl http://localhost:3000
```

### One-click deployment

After you create `.env` and `backend/.env.production`, run:

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

Optional overrides:

```bash
PROJECT_NAME=halvaa-prod ENV_FILE=.env ./scripts/deploy.sh
```

### Notes

- The current deployment stack uses Docker volumes for uploads (`halvaa_uploads`).
- `NEXT_PUBLIC_*` values are injected at frontend image build time via compose build args, so rebuild the frontend image when those values change.
- `docker-compose.prod.yml` reads `BACKEND_ENV_FILE`, defaulting to `./backend/.env`, so you can point production at a dedicated backend env file without editing compose.
- `docker-compose.prod.yml` also respects `BACKEND_PORT` and `FRONTEND_PORT`, which is handy for side-by-side preview stacks.
- Compose now includes healthchecks for PostgreSQL, backend, and frontend plus `restart: unless-stopped` on long-running services.
- The memorial weather card now uses a same-origin Next.js proxy route (`/api/weather`) instead of calling Open-Meteo directly from the browser.
- Uploaded asset URLs are versioned with `?v=` for safer cache invalidation.
- Versioned upload responses are served with immutable cache headers.
- Non-versioned upload requests are forced to `no-cache`.
- If you later move uploads to S3/R2, keep the same URL-versioning behavior.

---

## Production checklist

- [ ] Set `ENVIRONMENT=production`
- [ ] Set a strong backend `SECRET_KEY`
- [ ] Restrict `CORS_ORIGINS` to real frontend origin(s)
- [ ] Set `NEXT_PUBLIC_API_URL` to the production backend URL
- [ ] Rebuild the frontend image after changing any `NEXT_PUBLIC_*` value
- [ ] Set `SESSION_SECRET` plus real Zitadel domain, client ID, client secret, and callback URLs
- [ ] Run `./scripts/deploy.sh` or the equivalent compose + migration commands
- [ ] Run `alembic upgrade head`
- [ ] Persist PostgreSQL, Redis, and uploads volumes or replace them with managed services
- [ ] Ensure IRANYekanX font binaries exist under `frontend/public/fonts/iranyekan/`
- [ ] Put HTTPS termination in front of both services
- [ ] Configure Zitadel production callback URLs and secrets
- [ ] Verify `/health`, login, memorial create/edit, uploads, map, and guestbook moderation in production

---

## Current status

| Feature | Status |
|---------|--------|
| Discovery feeds and landing/explore wiring | **Done** |
| Draft/submit/review memorial workflow | **Done** |
| Collaboration, invites, roles, capability gating | **Done** |
| Memorial approval queue and guestbook moderation | **Done** |
| Append-only review history | **Done** |
| QR tribute generation/rendering | **Done** |
| Timeline CRUD with media | **Done** |
| Typed tributes/messages | **Done** |
| Artifacts/belongings + richer document metadata | **Done** |
| Family tree | **Done** |
| Burial site / plot modeling | **Done** |
| Grouped geo behavior | **Done** |
| UI consistency pass for new memorial/review surfaces | **Done** |
| Media delivery hardening (versioned URLs, cache headers, safer delete flow) | **Done** |
| Zitadel OIDC auth (frontend hook + modal) | **Done** |
| Create memorial sheet → FastAPI | UI only |
| Carousels / canvas → live API data | Not wired |
| Stripe / credits / gift cards | UI shell on Store tab; no backend |
| Legacy SQLite → PostgreSQL migration script | Not built |
| Dedicated timeline API endpoint | Timeline built client-side from memorial fields |
| QR code generation | DB field exists; no generator yet |
| Live weather on profiles | **Done** (same-origin weather proxy) |
| Wills / documents UI | Media model supports it; no dedicated UI |
| Cloud media CDN | Local `uploads/` only |
| Consolidate `/explore` route into tab app | Open decision |

---

## Known issues & audit notes

Issues found during codebase audit (June 2026). **Critical/medium items fixed in code**; low-priority items documented here.

### Fixed in UI polish audit (June 2026, round 2)

| Severity | Issue | Fix |
|----------|-------|-----|
| Critical | AuthModal form inputs missing labels | Added `<label htmlFor>` with `.sr-only` class |
| Critical | Featured memorial portraits missing alt text | Changed `alt=""` → `alt={person.name}` |
| Critical | Modal backdrops not keyboard accessible | Added `role="button"`, `tabIndex={0}`, `onKeyDown` |
| High | Missing `:focus-visible` on interactive elements | Added global focus-visible ring in `halvaa-ui-polish.css` + `globals.css` |
| High | Missing hover states on nav/buttons/auth-tabs | Added hover rules in `halvaa-ui-polish.css` |
| High | `z-index: 9999` / `10000` arbitrary values | Replaced with CSS custom property scale (`--z-modal: 50`, etc.) |
| High | Missing HSTS + CSP security headers | Added to `next.config.mjs` `async headers()` |
| High | Hardcoded hex in box-shadow bypassing theme vars | Changed to `color-mix(in srgb, var(--color-primary) ...)` |
| High | Missing `images.formats` config | Added `formats: ["image/avif", "image/webp"]` |
| Medium | `×` character used as close button | Replaced with SVG close icon matching AuthModal pattern |
| Medium | `transform` missing from transition list | Added to universal transition in polish CSS |
| Medium | Missing hover on `.hero-featured-dot` pagination | Added hover state |
| Medium | Duplicated CSS variable values in theme.ts | Added `brandTheme` export as single source of truth |
| Medium | fontiran.css referenced missing `.woff` files | Removed all woff references, kept only woff2 |
| Low | `prefers-reduced-motion` not covering all animations | Extended coverage in polish CSS + JS hooks |
| Low | Google Fonts Inter/Anybody causing mixed fonts | Removed; unified to Google Sans (EN) / IRANYekanX (FA) everywhere |
| Low | Legacy app.css font-family conflicts | Overridden via `html[lang] :is(...)` comprehensive selectors |

### Fixed in self-hosting & Zitadel audit (June 2026, round 3)

| Severity | Issue | Fix |
|----------|-------|-----|
| High | Google Fonts API `<link>` in layout.tsx (CSP violation + external request) | Replaced with self-hosted woff2 + local `@font-face` |
| High | CSP `style-src` included `fonts.googleapis.com` | Removed; all fonts same-origin |
| High | CSP `img-src` included `https:` (allowed any CDN) | Tightened to `'self'` + inline data |
| High | Map tiles loaded from `tiles.openfreemap.org` (external request + blocked by CSP) | Added same-origin proxy API routes for tiles/sprites/fonts |
| High | Pravatar CDN (`i.pravatar.cc`) for avatar images | Replaced with local SVG placeholders (`avatar-placeholder.svg`) |
| Medium | JWT-form auth lacks SSO, email verification, refresh tokens | Zitadel OIDC with PKCE + session cookies; legacy JWT still supported |
| Medium | Backend `User.hashed_password` was required for all users | Made nullable — Zitadel users have no password |
| Medium | `get_current_user` dependency only checked Bearer token | Now checks session cookie first, then JWT fallback |
| Medium | `apiFetch` didn't send credentials cross-origin | Added `credentials: "include"` for cookie support |
| Low | Auth routes `auth.py` and `auth_zitadel.py` both defined `/auth/me` | Removed duplicate from `auth_zitadel.py` |

### Open — low priority

| Severity | Issue | Fix |
|----------|-------|-----|
| Medium | Stale JWT left in `localStorage` after `/auth/me` 401 | `use-auth.ts` clears token on 401 |
| Medium | Profile tab flashed “sign in” before client token check | `useSyncExternalStore` in `use-auth.ts` for hydration-safe token reads |
| Medium | Draft memorials invisible to owners on `/memorial/[slug]` | `use-memorial.ts` sends Bearer token when present |
| Medium | FastAPI validation errors showed generic message | `api-client.ts` parses `detail` arrays |
| Low (opt) | SWR retried 4xx errors unnecessarily | `SWRProvider` retries only 5xx |
| Low (opt) | MapLibre bundled on initial `/explore` load | `ExploreHub` dynamic-imports `MapboxMap` |

### Open — low priority

| Severity | Area | Notes |
|----------|------|-------|
| Low | Legacy `ExploreTab` filter chips | UI only — `activeFilter` does not filter `people` |
| Low | Orphaned components | `HeroSection.tsx`, `ExploreTeaser.tsx` unused (superseded by legacy shell) |
| Low | Zitadel Docker Compose service | Commented out; manual Cloud setup recommended for now |
| Low | `memorial_to_public` | Extra PostGIS query per memorial for lat/lng (acceptable for single-profile fetches) |
| Low | Guestbook POST | Returns `PENDING` entry; list endpoint shows `APPROVED` only (by design) |
| Low | Create memorial sheet | UI shell only — no FastAPI wiring yet |
| Low | Legacy carousels / canvas | Still use static JSON, not live API |
| Low | IRANYekanX binaries | woff references removed (only woff2 used); font loaded via `fontiran.css` + `localFont` |
| Low | Google Fonts Inter/Anybody | Removed — replaced by Google Sans (English) and IRANYekanX (Persian) everywhere |

### Security review summary

- SQL: parameterized queries (`text()` with bound params in `geo.py`); no injection found
- RBAC: `require_memorial_access` on mutating routes; drafts return 404 to strangers
- CORS: explicit origins; credentials enabled
- Uploads: magic-byte validation, size limits, extension allowlist
- No secrets committed in source (dev credentials documented for local seed only)

### Map (MapLibre)

Map tiles, sprites, and fonts are proxied through same-origin Next.js API routes — the browser makes zero external tile requests:

| Route | Source |
|-------|--------|
| `/api/map-style` | Fetches OpenFreeMap Liberty style JSON, rewrites tile URLs to proxy |
| `/api/tiles/[...path]` | Proxies `tiles.openfreemap.org` tile requests |
| `/api/sprites/[...path]` | Proxies sprite JSON/PNG |
| `/api/fonts/[...path]` | Proxies PBF font glyphs |

This design ensures CSP can restrict all resources to `'self'` only. In production, replace with a self-hosted tile server (TileServer GL, Martin, PMTiles) and update `map-config.ts`.

`MapboxMap.tsx` uses MapLibre GL despite the legacy component name. Map instance is removed on unmount/data change to avoid leaks.

---

## Support & development workflow

The project follows an iterative cycle:

1. **Implement** one component or endpoint
2. **Test & secure** (pytest, curl, manual UI check)
3. **Debug** from logs/feedback before moving on

When porting UI from `old/`, match existing class names and structure before adding new abstractions. When adding API features, follow conventions in `backend/app/` — minimal diffs, typed code, JSONB translation layers, and strict memorial ownership checks on every mutating route.

**Reference files for UI work**

- Structure & markup: `old/halvaa.html`
- Styles: `old/assets/app.css`
- Behavior: `old/assets/app.js`, `old/assets/explore-canvas.js`
- i18n keys: `old/api.php` → `frontend/messages/*.json`

---

*Halvaa.net — Where memories live forever.*
