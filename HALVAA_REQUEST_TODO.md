# Halvaa Request TODO

## Completed in code
- Fixed media upload/display URL handling so production users do not receive `localhost:8000` asset links when production base URLs are configured.
- Added a media storage-key cleanup script for existing DB rows with accidental `localhost:8000/uploads/...` values.
- Resolved edit-time visibility/permission paths for owner/collaborator editing and profile-sharing requirements in API/UI.
- Added owner-controlled memorial deactivation/reactivation with double confirmation before public visibility changes.
- Added package entitlement structure for limited paid memorial slots and unique ID assignments.
- Added custom ID entitlement consumption after successful custom-slug memorial creation.
- Added Stripe/Zarinpal checkout, verification/webhook, and development fallback structures.
- Added a user agreement modal before memorial creation.
- Kept create-form drafts in localStorage for 2 days and allowed starting a blank form after confirmation.
- Removed category selection from normal memorial creation; category remains available for admin/editing.
- Added translation service scaffolding with LibreTranslate-compatible support, translation endpoint, status metadata, editable saved language layers, and translation backfill script.
- Added profile completion progress and blocked sharing until the owner completes required profile info.
- Improved form input visibility with 2px borders and contextual help affordances.
- Fixed Explore Mapbox controls: removed default controls, added only compact GPS/my-location button, and always enabled RTL text support.
- Added Explore top blur overlay under the top bar.
- Made Explore progressive: backend search and pagination with 30 memorials per request, plus backend-driven near-me search.
- Fixed landing second section sticky behavior styling while keeping smooth scroll enabled.
- Fixed empty "In Loving Memory" swiper with API/fallback memorial cards.
- Added landing FAQ and video/poster section using `tree.png`, plus light animated SVG/orange gradient accents.
- Fixed Google sign-in 500 path by implementing Google OAuth callback exchange/user creation and frontend token handling.

## Later / external integration
- Configure real Stripe credentials and webhook secret in production.
- Configure real Zarinpal merchant credentials and callback URL in production.
- Choose/configure a LibreTranslate-compatible provider for production, then run `python -m scripts.backfill_memorial_translations`.
- Run `python -m scripts.cleanup_media_storage_keys` once against production if existing media rows contain absolute localhost URLs.
