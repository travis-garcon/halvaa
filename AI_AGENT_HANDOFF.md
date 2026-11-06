# Halvaa Change Handoff

Date: 2026-06-27

This file summarizes the implementation work done for the Halvaa app so other AI coding agents can continue without rediscovering context.

## User Goals

- Single email OTP form for sign-in/sign-up, with SMS support that can work for Iran and other countries.
- Random public memorial IDs by default; custom/special IDs are purchasable.
- Store page for digital features assignable to users or memorials.
- Stripe for non-Persian/non-Iran traffic; Zarinpal for Persian/Iran traffic.
- Admin console backed by DB role, including income, KPIs, and API-driven landing-page memorial selections.
- No approval required for new memorials, but add basic text policy and duplicate-content checks.
- Temporarily use Mapbox-style map config with API key and preserve/comment existing local tile approach.
- Add Chinese and Arabic languages.
- Improve landing page, app-like mobile UX, RTL behavior, Explore bugs, and overall visual polish.
- Add famous admin-created seed memorials with rich data and gallery references.
- Add Wikipedia-like contribution structure so users can propose edits to memorials.

## Backend Completed

### Auth OTP

Files:
- `backend/app/models/auth_otp.py`
- `backend/app/schemas/auth.py`
- `backend/app/api/routes/auth.py`
- `backend/app/services/otp.py`
- `backend/app/core/config.py`

Added:
- `AuthOtp` table model.
- `POST /api/v1/auth/otp/start`
- `POST /api/v1/auth/otp/verify`
- OTP creates or resolves a user by email.
- Optional phone number is stored.
- SMS provider is config-driven. Kavenegar-compatible send path added for Iranian SMS, with console fallback.
- Existing password login/register endpoints remain for backward compatibility.

Config added:
- `OTP_EXPIRE_MINUTES`
- `OTP_MAX_ATTEMPTS`
- `SMS_PROVIDER`
- `SMS_API_KEY`
- `SMS_SENDER`

### Users and Roles

Files:
- `backend/app/models/user.py`
- `backend/app/models/enums.py`

Added:
- `UserRole`: `USER`, `ADMIN`
- `users.role`
- `users.phone_number`
- Existing `is_superuser` still works; admin access checks accept either `is_superuser` or `role == ADMIN`.

### Memorial IDs and Publishing

Files:
- `backend/app/models/memorial.py`
- `backend/app/schemas/memorial.py`
- `backend/app/api/routes/memorials.py`
- `backend/app/services/memorials.py`

Added:
- `memorials.public_id`
- Backend-generated random public IDs like `m-xxxxxxxx`.
- `slug` is optional on memorial creation.
- If a user submits a custom `slug`, the API requires a paid/assigned `CUSTOM_MEMORIAL_ID` purchase.
- New memorials are immediately `PUBLISHED` with `published_at`, not `DRAFT` or `PENDING_APPROVAL`.
- Owner collaborator is immediately accepted.

### Text Policy and Duplicate Checks

Files:
- `backend/app/services/text_policy.py`
- `backend/app/api/routes/memorials.py`
- `backend/app/api/routes/guestbook.py` still needs integration if stricter guestbook checks are desired.

Added:
- Basic blocked-term policy.
- Near-duplicate check using `difflib.SequenceMatcher`.
- Applied to memorial creation text.

### Store and Payments

Files:
- `backend/app/models/store.py`
- `backend/app/schemas/store.py`
- `backend/app/api/routes/store.py`
- `backend/app/services/payments.py`
- `backend/app/core/config.py`

Added:
- `StoreItem`
- `Purchase`
- Default seeded store catalog in route:
  - `custom-memorial-id`
  - `featured-placement`
- `GET /api/v1/store/items`
- `POST /api/v1/store/checkout`
- `GET /api/v1/store/purchases`
- Payment provider selection:
  - `ZARINPAL` for `fa` locale or Iran country code.
  - `STRIPE` otherwise.
- Current checkout response returns placeholder checkout URLs. Real Stripe Checkout Session and Zarinpal authority calls still need production keys and gateway integration.

Config added:
- `STRIPE_SECRET_KEY`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`
- `ZARINPAL_MERCHANT_ID`
- `ZARINPAL_CALLBACK_URL`
- `ZARINPAL_SANDBOX`

### Admin Console APIs

Files:
- `backend/app/schemas/admin.py`
- `backend/app/api/routes/admin.py`
- `backend/app/models/store.py`

Added:
- `LandingMemorialPlacement`
- `GET /api/v1/admin/kpis`
- `GET /api/v1/admin/landing-placements`
- `POST /api/v1/admin/landing-placements`
- `DELETE /api/v1/admin/landing-placements/{placement_id}`
- KPIs include users, memorials, published memorials, guestbook entries, USD income, IRR income.

### Public Landing Feed API

Files:
- `backend/app/schemas/explore.py`
- `backend/app/api/routes/explore.py`

Added:
- `GET /api/v1/explore/landing`
- Returns admin-selected memorial placements grouped by category.

### Contributions

Files:
- `backend/app/models/contribution.py`
- `backend/app/schemas/contribution.py`
- `backend/app/api/routes/contributions.py`
- `backend/app/api/router.py`

Added:
- `MemorialContribution`
- `POST /api/v1/memorials/{memorial_id}/contributions`
- `GET /api/v1/memorials/{memorial_id}/contributions`
- `PATCH /api/v1/memorials/{memorial_id}/contributions/{contribution_id}`
- `GET /api/v1/contributions/mine`
- First contribution type: `PROFILE_TEXT`.
- Contributors can propose localized `name`, `biography`, `epitaph`, and source note.
- Owners/editors/admins can approve/reject.
- Approved profile text is merged into `memorial.translations[locale]`.

### Seeds

Files:
- `backend/scripts/seed_dev_data.py`
- `backend/app/services/media_public.py`

Added/updated:
- Dev admin user now has `role=ADMIN`.
- Existing seed memorials now set `public_id`.
- Added Arabic and Chinese translation content for notable memorials.
- Added famous memorial examples including:
  - Ferdowsi
  - Parvin Etesami
  - Sohrab Sepehri
  - Maryam Mirzakhani
  - Mahatma Gandhi
- Added gallery/avatar `MediaAsset` rows with external image URLs.
- `media_asset_to_public` now supports external `http(s)` media URLs.
- Featured seeded memorials get landing placements.

### Migration

File:
- `backend/alembic/versions/009_auth_store_admin_public_ids.py`

Adds:
- `users.role`
- `users.phone_number`
- `memorials.public_id`
- `auth_otps`
- `store_items`
- `purchases`
- `landing_memorial_placements`
- `memorial_contributions`

### Backend Verification

Command run successfully:

```bash
python3 -m compileall backend/app backend/scripts
```

Docker verification on 2026-06-27:
- Rebuilt `halvaa-backend:latest`.
- Applied Alembic migration `009_auth_store_admin_public_ids`.
- Ran `python -m scripts.seed_dev_data` inside the backend container.
- Rebuilt `halvaa-frontend:latest`.
- Backend health: `http://localhost:8000/health` returns `{"status":"ok"}`.
- Frontend pages verified with HTTP 200: `/en`, `/ar`, `/zh/store`, `/fa/explore`, `/en/memorial/maryam-mirzakhani`.
- Store API verified: `GET http://localhost:8000/api/v1/store/items`.
- Landing feed verified: `GET http://localhost:8000/api/v1/explore/landing?locale=en`.
- Famous memorial media verified: Maryam Mirzakhani gallery URLs return `https://upload.wikimedia.org/...`.

Running containers after restart:
- `halvaa-frontend-1`: healthy on port `3000`.
- `halvaa-backend-1`: healthy on port `8000`.
- `halvaa-db-1`: healthy.
- `halvaa-redis-1`: running.
- `halvaa-local-map-1`: running but unhealthy because `map-data/health.txt` and map assets are missing.
- `halvaa-zitadel-1`: running but unhealthy; OTP auth does not depend on Zitadel.
- `halvaa-zitadel-db-1`: healthy.

Public domain audit on 2026-06-27:
- `https://halvaa.app` reaches CDN/Nginx and redirects to `/en`.
- `https://halvaa.app/en`, `/fa`, `/ar`, `/zh` return HTTP 200.
- `https://halvaa.app/fa/explore` and `/ar/explore` return HTTP 200 with `dir="rtl"`.
- `https://halvaa.app/api/v1/store/items` returns store catalog JSON.
- OTP start works for both email and phone identifiers:
  - Email payload starts a server-side OTP challenge. User creation happens only after a valid OTP is verified.
  - Phone payload creates/continues a synthetic phone-backed user.
- Admin API works with seeded admin credentials:
  - `dev@example.com / devpassword123`
  - `GET /api/v1/admin/kpis` returns KPI JSON with a bearer token.
- Store checkout provider routing works:
  - `locale=fa` returns `ZARINPAL` and `IRR`.
  - `locale=en` returns `STRIPE` and `USD`.
- Contribution create endpoint works with auth and returns a pending contribution.
- Famous memorial media returns external Wikimedia URLs and frontend CSP now allows `https://upload.wikimedia.org`.

Frontend UI rebuild pass on 2026-06-27:
- Backend was not changed in this pass.
- Rebuilt the mobile-first app shell with a sticky top bar and mobile bottom navigation.
- Rebuilt landing hero and memorial showcase with a more premium app-like visual system while preserving the orange/white Halvaa theme.
- Reworked Explore into stable responsive cards and app-like controls, reducing RTL/mobile issues.
- Polished Store, Admin, and Profile headers/cards to match the new visual system.
- `npm run typecheck` passed.
- `npm run build` passed.
- Rebuilt/restarted only `halvaa-frontend-1`; it is healthy.
- Local origin serves new HTML:
  - `http://localhost:3000/en` content length `51544`
  - `http://localhost:3000/fa/explore` content length `55185`
- Public CDN clean URLs were still returning cached old HTML immediately after deploy.
- Cache-busted public URLs such as `https://halvaa.app/en?ui_rebuild=1` and `https://halvaa.app/fa/explore?ui_rebuild=1` return the new build. Purge CDN cache for clean URLs.

Landing/PWA pass on 2026-06-28:
- Rebuilt landing hero as a 100vw/100vh light-gray split section.
- Hero text/CTA side switches naturally with RTL/LTR direction.
- Hero media side uses two vertical infinite-loop photo-card marquee columns, one up and one down, with top/bottom CSS mask fade. The earlier bird-eye transform was removed per user request.
- Added `LandingScrollStory` section with centered sticky media placeholder and alternating left/right value paragraphs within a 1200px layout.
- Added a distinct display title font using existing `DMSerifDisplay-Regular.ttf`; RTL title fonts fall back to the existing Persian/Arabic stack.
- Tightened mobile sizing and auth modal safe-area margins.
- Added installable PWA support:
  - `frontend/public/manifest.webmanifest`
  - `frontend/public/pwa-icon.svg`
  - `frontend/public/sw.js`
  - `PWARegister` client component
  - metadata/manifest/apple web app tags in locale layout.
- Allowed temporary image host `https://gapgpt.cloud` in Next image config and CSP.
- Verification:
  - `npm run typecheck` passed.
  - `docker compose -f docker-compose.prod.yml build frontend` passed.
  - Rebuilt/restarted `halvaa-frontend-1`; frontend and backend are healthy.
  - `GET http://localhost:3000/en` and `GET http://localhost:3000/fa` return HTTP 200.
  - PWA manifest, service worker, and PWA SVG icon are served.

## Frontend Completed / Remaining

Frontend work completed in this pass:
- Added `ar` and `zh` to locale routing.
- Added `frontend/messages/ar.json` and `frontend/messages/zh.json`.
- Updated locale switcher for English, Persian, Arabic, Chinese.
- Replaced password auth tabs with a single OTP identifier flow.
- OTP field accepts email or phone; backend detects which one it is.
- Added `/store` page.
- Added `/admin` page.
- Added landing memorial showcase with Swiper and marquee.
- Added contribution form to memorial profile pages.
- Fixed obvious Explore RTL/mobile issues: stable tab order, `dir="auto"` search, Arabic RTL map plugin, logical map control placement.
- Added Wikimedia image CSP and Next remote image support for seeded famous memorial galleries.

Relevant files touched:
- `frontend/src/i18n/routing.ts`
- `frontend/messages/en.json`
- `frontend/messages/fa.json`
- `frontend/messages/ar.json`
- `frontend/messages/zh.json`
- `frontend/src/components/legacy/AuthModal.tsx`
- `frontend/src/hooks/use-auth.ts`
- `frontend/src/lib/api-client.ts`
- `frontend/src/components/HeroSection.tsx`
- `frontend/src/components/LandingMemorialShowcase.tsx`
- `frontend/src/components/explore/ExploreHub.tsx`
- `frontend/src/components/explore/MapboxMap.tsx`
- `frontend/src/components/Header.tsx`
- `frontend/src/components/LocaleSwitcher.tsx`
- `frontend/src/styles/globals.css`
- `frontend/next.config.mjs`

Potential next frontend polish:
- Add richer admin landing-placement controls instead of the current KPI-focused console plus API note.
- Add contribution review UI to profile/admin pages; backend review API exists.
- Run browser screenshot checks for mobile Safari/Chrome dimensions if available.

## Important Existing User Changes

The repo already had uncommitted user changes before this work:
- `backend/app/api/routes/auth_zitadel.py`
- `docker-compose.prod.yml`
- `backend/.env.production`
- `docker/zitadel/`
- `scripts/provision_zitadel_local.sh`

Do not revert these.

## Notes / Risks

- Real Stripe and Zarinpal calls are not implemented yet; checkout endpoint currently creates purchase records and returns provider-specific placeholder URLs.
- OTP email delivery is server-side. The backend uses configured SMTP first; if SMTP is empty and `SMTP_DIRECT_DELIVERY=true`, it resolves MX records and attempts direct SMTP delivery from the backend container. If delivery fails, `/auth/otp/start` returns HTTP 503 instead of pretending the code was sent.
- SMS OTP uses Kavenegar when `SMS_API_KEY` is configured. Without SMS credentials, phone OTP cannot be delivered in production.
- Direct SMTP was verified from the backend container against Gmail MX on 2026-06-28. A nonexistent Gmail address correctly returned a Gmail 550 mailbox error, proving the backend can reach recipient mail servers. For reliable inbox delivery, configure proper SMTP or domain mail DNS/SPF/DKIM/DMARC/reverse DNS.
- Public CSP and map config still include `http://localhost:8081` for local map assets. On `halvaa.app`, real users cannot use localhost map tiles. Set a public `NEXT_PUBLIC_MAP_STYLE_URL` with the Mapbox style/token and rebuild frontend, or host PMTiles/assets publicly.
- `halvaa-local-map-1` is unhealthy because `map-data` is empty/missing `health.txt`.
- `halvaa-zitadel-1` is unhealthy and SSO `/auth/signin` logs an issuer metadata redirect error from `http://46.249.101.229/.well-known/openid-configuration` to HTTPS. OTP auth works independently.
- The text policy is intentionally lightweight. For production, replace or supplement it with a stronger moderation service that works within the deployment jurisdiction.
- External seeded image URLs depend on upstream availability and licensing. Consider downloading licensed assets into controlled storage for production.
- `Memorial.public_id` and `slug` currently mirror each other for routing compatibility.

## 2026-06-29 Follow-Up Checklist

Done in this pass:
- Restored `frontend/public/assets/img/tree.png` from GitHub and made the sticky story section use it as a full-viewport cover image.
- Set the landing hero desktop title to `60px`.
- Removed transform/perspective styling from the hero marquee container.
- Kept mobile hero CTA buttons inline.
- Changed language switching to a `<select>` input.
- Tightened mobile auth modal padding and safe-area margins.
- Changed Google auth UI to a disabled "coming soon" path unless `NEXT_PUBLIC_GOOGLE_AUTH_URL` is configured.
- Duplicated the landing memorial showcase row when the admin landing feed only returns one category; if admins configure multiple categories through the landing-placement API, the frontend renders all returned categories.
- Temporarily disabled the local PMTiles map by default and wired Mapbox light style with the provided public token through `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`.
- Added Mapbox hosts to Next image remote patterns and CSP `connect-src`/`img-src`.
- Kept comments in `frontend/src/lib/map-config.ts` explaining the existing local tile system and the temporary Mapbox path.
- Added RFC mail headers to OTP email and changed OTP delivery failures to log detailed server errors while returning a clean 503 message to the frontend.

Verification in this pass:
- `python3 -m compileall backend/app` passed.
- `npm run typecheck` passed.
- Locale JSON parse check for `en`, `fa`, `ar`, and `zh` passed.
- `docker compose -f docker-compose.prod.yml up -d --build --no-deps backend frontend` passed.
- `halvaa-backend-1` and `halvaa-frontend-1` are healthy.
- `GET http://localhost:8000/health` returns `{"status":"ok"}`.
- `HEAD http://localhost:3000/en` and `HEAD http://localhost:3000/fa` return HTTP 200.
- `HEAD http://localhost:3000/assets/img/tree.png` returns HTTP 200.
- CSP on `http://localhost:3000/en` includes `https://api.mapbox.com`, `https://events.mapbox.com`, and `https://tiles.mapbox.com`.
- `GET http://localhost:8000/api/v1/explore/landing?locale=en` returns admin-selected landing categories.
- `POST http://localhost:8000/api/v1/auth/otp/start` returns HTTP 503 with the clean frontend-safe message when direct Gmail delivery is rejected.

Current OTP delivery state:
- Backend OTP service is implemented and attempts server-side email delivery.
- Direct SMTP from this VPS is rejected by Gmail unless `halvaa.app` mail DNS is configured correctly. Latest Gmail errors mention SPF/DKIM failure for `halvaa.app` with IP `46.249.101.229` and missing/mismatched PTR. The known required production fixes are reverse DNS/PTR for `46.249.101.229`, SPF allowing the sending IP or relay, DKIM signing, and DMARC.
- Practical alternative: set real SMTP relay credentials in `backend/.env.production` (`SMTP_HOST`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, etc.) and set `SMTP_DIRECT_DELIVERY=false` if the relay should be mandatory.

## 2026-06-29 Landing/Memorial UI Pass

Done:
- Removed the top padding from the landing hero content area.
- Changed the sticky story section from a `next/image` element to a CSS `background-image` cover using `/assets/img/tree.png`.
- Added blurred glass paragraph panels with rounded corners, mini eyebrow text, scroll animation, and flat inline SVG icons.
- Changed memorial stat/detail blocks to use more compact inline/grid layouts on mobile.
- Replaced the memorial gallery grid with a horizontal Swiper slider.
- Added a fullscreen gallery image viewer when a gallery photo is tapped/clicked.
- Replaced direct share-copy behavior with a bottom sheet that generates a client-side QR code for the current URL and includes a copyable URL field.
- Added `qrcode` and `@types/qrcode` to the frontend dependencies.

Verification:
- `npm run typecheck` passed.
- Locale JSON parse check for `en`, `fa`, `ar`, and `zh` passed.
- `docker compose -f docker-compose.prod.yml up -d --build --no-deps backend frontend` passed after a long frontend build.
- `halvaa-backend-1` and `halvaa-frontend-1` are healthy.
- `GET http://localhost:8000/health` returns `{"status":"ok"}`.
- `HEAD http://localhost:3000/en`, `HEAD http://localhost:3000/fa`, and `HEAD http://localhost:3000/en/memorial/mahatma-gandhi` return HTTP 200.
- `HEAD http://localhost:3000/assets/img/tree.png` returns HTTP 200.
