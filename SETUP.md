# Run Mithaq on your own infrastructure (no Lovable)

## 1. Supabase project
1. Create a project at supabase.com. Copy the URL and the anon/publishable key into `.env` (see `.env.example`).
2. Apply the schema: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`
   (runs everything in `supabase/migrations/`). Or paste each file, in order, into the SQL editor.
3. Storage: create a private bucket named `documents`.
4. Authentication -> URL configuration: set Site URL to your app URL and add `http://localhost:3000/**` and your
   production URL (`https://your-domain/**`) to Redirect URLs.
5. Authentication -> Providers: enable Email (turn "Confirm email" off while testing) and Google (optional).

## 2. Keys
- `ANTHROPIC_API_KEY` for chat, contract audit and OCR.
- `RESEND_API_KEY` (+ `EMAIL_FROM` on a verified domain) for team invitations and email.

## 3. Run
    npm install
    npm run dev          # http://localhost:3000
    npm run build && npm start   # production Node server (.output/)
    npm test             # legal pipeline self-check

## 4. Deploy
`npm run build` produces a standalone Node server in `.output/` (Docker, Railway, Fly, a VPS, ...).
Set the same environment variables on the host.

## Lovable (optional)
The repo also works with Lovable. `vite.config.ts` is the Lovable-managed config; for your own hosting use
`npm run dev:standalone` / `npm run build:standalone` (uses `vite.standalone.config.ts`). On Lovable the AI gateway,
email connector and Google sign-in are used automatically when no own keys are set.
