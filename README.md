# SIFT BEARING STORE — homepage preview

Bilingual (English / Spanish) responsive visual prototype. Actual supplied product photographs only; no AI facility/stock imagery.

## Run

```sh
npm install
npm run dev -- --port 5173
```

Routes: `/en/` and `/es/`. `npm run build` creates a static preview build.

## Current scope
- Responsive homepage, language links, mobile navigation.
- Product photo dialogs; inquiry shortcut prefills the selected model.
- Inquiry email draft opens the visitor's email app. Selected files **must be attached manually**. No server submission, upload, storage or mail notification is implemented.
- WhatsApp and email links use the confirmed business contacts.
- All preview pages are deliberately `noindex,nofollow`.

## Before production
Choose/implement production architecture (the discussed Next.js + database/object storage is not implemented here), authenticated admin, product import, private inquiry attachments, server-side validation/spam protection and notifications. Add full bilingual product/service pages, verified business/privacy disclosures, canonical/hreflang metadata, sitemap, production SEO and analytics. Remove preview noindex only on the approved production domain. Verify content, translations, photo/model mapping and image rights. Preserve the existing main-domain website and email DNS records.

## Chinese admin UI prototype

Open `/admin/` (also linked at the bottom of the homepage preview).

- Dashboard, product search/status filtering, product editor, local image selection, cover/reorder/remove controls.
- In-memory draft/publish simulation with required fields and brand/model duplicate checks. No inventory claims.
- CSV example download and clearly marked fixed-data import walkthrough; XLSX parsing is **not** implemented.
- Fictional inquiry detail/status changes and read-only business settings.
- All data lives in current-page memory and resets on refresh. No Supabase connection, authentication, server upload, real publishing, real inquiry data, or email sending. Do not enter private customer information.
- Local preview files use blob URLs; nothing is uploaded. This UI is not a security boundary and must not be treated as an authenticated production admin.

Validation: Vite production build and JavaScript syntax checks. Browser automation could not run in this sandbox because the Chromium download host was inaccessible; manually review desktop/mobile layouts and interactions before accepting the design.

## Supabase product foundation (not applied)

Start with [中文操作说明](docs/SUPABASE_SETUP.zh-CN.md). One-time migration:
`supabase/migrations/202610270001_product_management.sql`.
Read-only inspection: `supabase/verify_product_security.sql`.
Includes products, image metadata, an explicitly enrolled private administrator allowlist, RLS, a private image bucket, and an atomic reorder RPC. No credentials are included. No remote SQL has been executed and the UI remains a prototype until integration and role-based tests are completed.

## Real admin integration (configuration required)

`/admin/` is now the real-data entry, `/admin-demo/` retains the isolated in-memory design prototype. Install dependencies, apply the second migration `202610270002_atomic_product_save.sql`, and configure public Supabase URL/key using `.env.example`. See the second-stage section in the Chinese setup guide.

Implemented: password sign-in/out, administrator check, database product list, draft/published/archived states, private image upload/signing, cover ordering, and atomic metadata save. New product uploads start with a private draft. Failed uploads can leave drafts/orphan objects; removal does not physically purge stored files. The public homepage is still a static preview and is **not** connected to the product database yet. No remote credentials have been configured or remote migrations executed by the agent.

`npm test` runs mocked unit/DOM tests, not live Supabase or full browser/RLS tests.

## Public catalog / visitor isolation update

In configured environments the homepage product grid now uses a separate non-persistent anonymous client and explicitly queries published products (up to nine), with empty/error states and real photo galleries. Static hero reference photography remains. This supersedes the earlier "homepage is not connected" note. `/admin/` now has a read-only visitor isolation check for loaded private products and signed image access, with pass/fail/inconclusive results. These checks do not replace full RLS/public bucket/write-permission acceptance tests. No remote mutations or security probes were run by the agent; they execute only when requested in the user's browser. Twenty mocked tests pass; live verification is pending user execution.
