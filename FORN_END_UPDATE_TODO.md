# FORN END UPDATE TODO

Date: 2026-06-30

This tracker is intentionally detailed because another agent already completed most of the front-end work. Before editing a file, verify the current behavior first and avoid broad rewrites.

## Ground Rules

- Do not refactor landing, Explore, memorial, auth, Docker, or Nginx code unless a specific verification step shows it is still broken.
- Prefer one-file or two-file patches with clear verification after each patch.
- Preserve existing Docker image, Nginx, and compose setup unless a health check proves a config is wrong.
- Use the final override section in `frontend/src/styles/globals.css` for CSS fixes; earlier rules are often superseded later in the file.
- Treat `backend/.env.production` as the active backend env template for production compose unless deployment uses another env file.

## Frontend UI Checklist

- [x] Mobile home top bar at scroll position 0: header background animates to transparent when not scrolled.
- [x] Mobile home top bar visible white circle: changed only the mobile menu button from `bg-white` to transparent so the top area does not look white over the hero.
- [x] Mobile hero text alignment: final CSS already centers `.landing-hero-copy`, headline, subtitle, eyebrow, and actions under `@media (max-width: 640px)`.
- [x] Mobile `.landing-hero-marquee-wrap`: final CSS already applies the requested `height: 24rem`, `min-height: 22rem`, and `rotate3d(... ) translate(-15px, -60px)`.
- [x] Memorial page mobile top tabbar: final CSS hides `.mobile-hide-on-memorial` and `.memorial-theme-root nav[aria-label]` on mobile.
- [x] Auth modal mobile padding: final CSS sets modal padding, max height, overflow, and inner padding for `.modal-content.auth-modal`.
- [x] Explore default tab: `ExploreHub` now initializes `activeFilter` to `"latest"`.
- [x] Explore CSS requested block: final override section includes the requested fixed search, fixed stage, `main:has(.explore-shell)`, and bottom bar rules.
- [x] Explore shadows: final override removes shadows from search/filter elements, grid canvas, view switch, and watch bubbles.
- [x] Explore faces in circles: `ExploreWatchGrid` uses `MemorialImage` from API `imageUrl`; backend Explore API returns avatar/gallery image URLs.
- [x] Landing featured swipers: `LandingMemorialShowcase` renders two category rows when data exists or creates a second fallback row.
- [x] Landing swiper card size: current breakpoints show more cards per row (`1.35`, `2.75`, `4.15`), making cards smaller than a single-large-card layout.
- [x] Second section background movement: `LandingScrollStory` transforms the backdrop using scroll progress.
- [x] Second section scroll duration: reduced final pinned section from `250vh / 150rem` to `180vh / 72rem` and mobile from `130rem` to `82rem`.
- [x] Global `main { padding: 0 }` was scoped to home/explore only with `main:has(.landing-hero), main:has(.explore-shell)`.
- [x] Create memorial form no longer asks for/sends a custom slug by default; backend generates random public IDs unless a paid custom ID entitlement exists.
- [x] Create memorial form no longer submits new memorials for admin approval.
- [x] Footer link groups render as two columns on mobile.
- [ ] Visual verify mobile home at scroll 0 in browser or Playwright screenshot.
- [ ] Visual verify desktop second section is not broken after the scroll-height reduction.
- [ ] Visual verify Explore mobile and desktop after final CSS overrides.
- [ ] Visual verify auth modal at small viewport with both OTP start and verify steps.

## Backend And Data Checklist

- [x] Memorial schema supports multilingual `translations`.
- [x] Memorial schema supports `category`, `metadata`, and `filter_tags`.
- [x] Alembic migration `010_add_memorial_metadata_tags.py` adds `category`, `metadata`, and `filter_tags`.
- [x] Explore and landing APIs return `category`, `metadata`, and `filter_tags`.
- [x] Public import script infers and fills category, gender, nationality, country, city, places lived, family history, childhood, and tags.
- [x] Public import script creates multilingual timeline translation shells for `en`, `fa`, `ar`, and `zh`.
- [x] Ran `alembic upgrade head` in the active backend container/database through revision `011_verified_locations`.
- [ ] Run or confirm `python -m scripts.import_public_memorials` if production DB still lacks enriched public memorials.
- [x] Added and ran `scripts.backfill_memorial_metadata`; 18 existing memorials received missing locale layers plus metadata/filter tags without deleting records.
- [x] Checked a real API response from `/api/v1/explore/discover?kind=latest&locale=en`; it includes image URLs and metadata/filter tags.
- [x] Checked a real API response from `/api/v1/explore/landing?locale=ar`; it works with backfilled metadata/filter tags.
- [x] Added backend fields/migration foundation for `is_verified`, `verified_at`, and structured `locations`.
- [ ] Build admin UI/API for assigning/removing verified badges.
- [ ] Build Mapbox location picker bottom sheet for multiple memorial locations.
- [x] Display structured memorial locations as "open map" / "find this location on the map" on memorial profiles.
- [ ] Build public owner profile pages and richer owner/contributor contact cards.
- [ ] Add owner profile workflow for accepting/denying profile contributions from the profile area.

## SMTP, OTP, And Auth Checklist

- [x] Production compose includes an `smtp` service using `boky/postfix`.
- [x] Production compose includes Postfix rate-limit settings:
  `POSTFIX_smtpd_client_connection_rate_limit`,
  `POSTFIX_smtpd_client_message_rate_limit`,
  and `POSTFIX_smtpd_recipient_limit`.
- [x] Backend service depends on the SMTP service in `docker-compose.prod.yml`.
- [x] `backend/.env.production` points backend OTP email to `SMTP_HOST=smtp`, `SMTP_PORT=587`, `SMTP_USE_TLS=false`, and `SMTP_DIRECT_DELIVERY=false`.
- [x] OTP code path sends email via configured SMTP relay for email identifiers.
- [x] OTP direct-recipient SMTP delivery is no longer the code default, avoiding accidental 503s when outbound port 25 or DNS/MX lookup fails.
- [ ] Rebuild/restart backend container so the OTP code change is active.
- [ ] Verify backend container has the expected SMTP env values with `docker compose -f docker-compose.prod.yml exec backend env`.
- [ ] Verify SMTP container is running and reachable from backend on port 587.
- [ ] Test `POST /api/v1/auth/otp/start` with a real email and confirm it returns `201` instead of `503`.
- [ ] Inspect backend logs after OTP test for `OTP delivery failed`.
- [ ] Inspect SMTP logs for rejected sender/domain/rate-limit errors.
- [ ] Confirm DNS records for the sender domain are configured outside the repo: SPF, DKIM if available, DMARC, reverse DNS/PTR for the mail server IP.
- [ ] Decide whether incoming mail receiving is truly required; the current compose relay is configured for app outbound email, not a full mailbox/IMAP product.

## Docker, Nginx, And Runtime Verification

- [ ] Run `docker compose -f docker-compose.prod.yml ps` and confirm `db`, `redis`, `smtp`, `backend`, `frontend`, `zitadel-db`, and `zitadel` are running/healthy as expected.
- [ ] Confirm Nginx container/service is running if Nginx is managed outside this compose file.
- [ ] Check backend health: `curl http://localhost:8000/health`.
- [ ] Check frontend health: `curl http://localhost:3000/en`.
- [ ] Check public routes through Nginx domain/IP, not only localhost.
- [ ] Check Nginx logs for 502/503 after backend restart.
- [ ] If images are rebuilt, avoid changing image names/tags unless deployment already expects new tags.

## Verification Commands To Run

- [x] Backend compile: `python3 -m compileall backend/app backend/scripts`
- [ ] Backend tests: `pytest backend/tests`
- [x] Frontend typecheck: `npm run typecheck` from `frontend/`
- [x] Frontend build: Docker frontend build completed successfully.
- [ ] Compose config validation: `docker compose -f docker-compose.prod.yml config`
- [x] Container health: `docker compose -f docker-compose.prod.yml ps`

## Known Environment Issue In This Session

- `git` commands currently fail with `fatal: could not open '/dev/null' for reading and writing: Permission denied`, even though `/dev/null` exists. Do not rely on `git diff` or `git status` until that host issue is fixed.

## 2026-06-30 Memorial Data, Auth, Mapbox, Media TODO

### Product Rules

- [ ] Confirm the final monetization policy for memorial creation after launch.
- [x] Enforce free creation for the first memorial owned by each user.
- [x] Block creation of a second owned memorial unless the user has a paid extra-slot entitlement or admin override.
- [x] Return a clear payment-required API error when the free memorial limit is reached.
- [ ] Show the free-first-memorial rule in the create flow before submission.
- [x] Keep custom public IDs paid separately from the free-first-memorial rule.
- [ ] Decide whether collaborator-owned memorials count toward the creator's free memorial allowance; current intended behavior is owned/created memorials only.

### Memorial Database Coverage

- [x] Memorial rows support multilingual `translations` through JSON.
- [x] Memorial rows support `category`, `metadata`, `filter_tags`, and structured `locations`.
- [x] Creation API should accept every user-editable memorial table field.
- [x] Update API should preserve and expose every user-editable memorial table field.
- [ ] Validate `category` and normalize blank strings to null.
- [ ] Fill metadata automatically when form inputs imply values.
- [x] Fill `filter_tags.gender` during creation.
- [x] Fill `filter_tags.countries` during creation.
- [x] Fill `filter_tags.cities` during creation.
- [x] Fill `filter_tags.tags` during creation.
- [x] Fill `metadata.birth_place`, `metadata.death_place`, `metadata.occupation`, `metadata.religion`, `metadata.nationality`, and `metadata.languages`.
- [x] Ensure public profile and explore payloads return metadata/filter tags consistently.
- [ ] Backfill existing memorials that still have empty category, metadata, or filter_tags.
- [ ] Add tests for metadata/filter_tags creation and update.

### Memorial Create/Edit Forms

- [x] Create form captures name, dates, biography, epitaph, announcement, burial address, burial site, burial plot, QR URL, category, gender, occupation, nationality, religion, languages, countries, cities, places lived, and tags.
- [x] Create form captures structured locations for birth, death, burial, residence, and custom lived-in places.
- [x] Create form can create initial family tree rows.
- [x] Create form writes all supported fields to the backend payload.
- [x] Create form autosave includes every new field.
- [x] Edit form exposes the same metadata, category, tags, and structured location fields.
- [x] Edit form can update all user-editable DB fields.
- [ ] Shared field components should be reused where possible instead of duplicating create/edit logic.
- [x] Public memorial page should display category, key metadata, countries, cities, tags, and structured locations where appropriate.

### Reusable Mapbox Location Picker

- [x] Add a reusable Mapbox bottom-sheet picker component.
- [x] Open the picker whenever a coordinate input/select-location button is clicked.
- [x] Allow multiple independent location fields on the same page.
- [x] Let users tap/click the map to set a marker.
- [x] Write selected latitude/longitude back into the correct inputs.
- [x] Close the bottom sheet after confirming the picked location.
- [x] Support RTL labels and Mapbox RTL text plugin.
- [x] Use localized Mapbox label language for `fa`, `ar`, `zh`, and English fallback.
- [x] Handle missing Mapbox token with a useful UI error.
- [x] Add mobile-safe bottom sheet sizing and scrolling.

### Auth And Account Profile

- [x] OTP start response should tell the client when the identifier is a new user.
- [x] After OTP verification for a new user, show a registration/profile-completion form instead of silently creating a minimal account.
- [ ] Registration completion form should collect basic info: full name, locale, optional avatar URL, and optional phone/email not used as the OTP identifier.
- [x] Backend should mark OTP-created users as needing profile completion when basic info is missing.
- [x] Add account profile update API.
- [x] Allow editing full name, locale, avatar URL, and secondary contact fields.
- [x] Lock the email or phone used to sign in with OTP.
- [x] Profile dashboard should include editable account information.
- [ ] Add tests for locked email/phone update attempts.

### Explore Mapbox Switch

- [x] Replace explore map runtime with `mapbox-gl`.
- [x] Keep local MapLibre/PMTiles solution temporarily commented or parked for future restoration.
- [x] Use a Mapbox style URL with token handling.
- [x] Apply language locale to Mapbox labels where supported.
- [x] Enable Mapbox RTL text plugin for Persian and Arabic.
- [x] Update map CSS selectors from MapLibre to Mapbox control classes.
- [ ] Verify explore map renders at desktop and mobile sizes.

### Icons, Logo, Layout, Landing

- [x] Download/use `/assets/img/icon.png` locally for app icon metadata and manifest.
- [x] Include `/assets/img/icon512.png` in manifest.
- [x] Ensure logo has 4px visual padding where it appears as an image.
- [x] Use logo in the footer with grayscale, zero contrast, and slight opacity so it reads gray.
- [x] Add default `main` top padding of 60px.
- [x] Exclude the explore tab/page from the 60px `main` top padding.
- [ ] Confirm the second landing section works on desktop the same way it works on mobile.

### Media Uploading And File Manager

- [x] Fix uploaded media URLs that currently produce 404s from the frontend origin.
- [x] Return absolute upload URLs or route upload URLs through frontend proxy.
- [x] Replace bare file inputs with a clearer uploader surface.
- [x] Support drag/drop and multi-file selection.
- [x] Show upload progress/status per file where possible.
- [x] Show media thumbnails, category, title, description, type, size, and processing status.
- [x] Allow inline title/description/category editing without browser prompts.
- [x] Allow deleting media with clear disabled/loading states.
- [x] Keep gallery, documents, will, artifacts, timeline media, and portrait categories manageable from one file manager.
- [ ] Add tests for generated media URLs.
