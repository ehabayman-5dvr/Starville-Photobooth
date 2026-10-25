# StarVille Photobooth

Public web photobooth built with React, TypeScript and Vite, with Node API functions for Vercel. Designs, buttons, videos and generation references come from the supplied project assets.

## Run locally

Use Node 22.12+.

```sh
git submodule update --init --recursive
npm install
cp .env.example .env.local
npm run dev
```

Fill the server credentials in `.env.local` before generating. This checkout has already been provisioned with the supplied OpenAI key and authorized AHK Cloudinary configuration. It uses the StarVille folder and metrics project, not AHK's. Secrets are ignored by Git and are never read by the React client. Do not add `VITE_` prefixes to credentials.

`npm run dev` serves both the interface and `/api/generate`. Camera access requires HTTPS or localhost. A phone opening a LAN HTTP address will not have camera access; use an HTTPS deployment for phone testing. `npm run preview` previews only the built interface, without API functions.

## Participant flow

1. Start video loops; tap Start.
2. Choose The Boss or The Explorer.
3. Full-screen live selfie preview, front/back camera switch and 3–2–1 capture.
4. Retake or watch the countdown bar; automatically proceeds after five seconds.
5. Loading video loops while Flare creates the portrait.
6. Branded result with Download, native file sharing where supported and Explore Again.

There is no QR, printing, Electron packaging or kiosk idle reset. On a public website the result remains available until the visitor chooses Explore Again or closes the page. Camera tracks stop when leaving capture.

Each browser cycles independently through three variations per mode, stored in localStorage with an in-memory fallback. Only successful live results advance the sequence. Changing modes retains each mode's position. Visitors never select a variation. There is no global counter across devices.

## Generation and delivery

`gpt-image-2.5-flare` uses `/v1/images/edits` with the participant selfie as its only image input. The six supplied references guide authored text descriptions of each variation's setting, outfit, lighting, palette and composition; no scene reference is sent to OpenAI. Prompts explicitly reserve identity to the selfie, preserve every visible participant and headcover, and transform clothing and scenery. They do not depend on inferred age/gender labels or detector availability. The variation prompts live in `shared/modes.mjs`. Reference filenames remain authoring provenance and local preview samples only.

Flare produces 1008×1792 portrait output, normalized to 1080×1920. Sharp composites the supplied logo at the top center before JPEG export and Cloudinary upload. Download, native share and Cloudinary all receive the same branded bytes. No extra text is added to the photo.

Cloudinary signs uploads on the server, writes to `Starville-Photobooth` and retries up to three times with a stable public ID. If archiving fails, the branded local download/share still works. Raw selfies are sent to OpenAI but are not uploaded to Cloudinary or written to disk by this application. Finished portraits are stored in Cloudinary.

One metrics POST is scheduled after each successful live provider response with an image, independently of storage success. The configured URL is the supplied StarVille dashboard project. Metrics failures do not block delivery and are not retried. Paid generation is never automatically retried. The exact prompt/model/variation is logged server-side without credentials or selfie bytes.

## Deploy on Vercel

Import this Git repository into Vercel, select the Vite framework, Node 22, build command `npm run build` and output `dist`. Set these environment variables in Vercel for each intended environment:

| Variable | Value |
| --- | --- |
| `OPENAI_API_KEY` | Authorized OpenAI key with Flare access |
| `OPENAI_QUALITY` | `high` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `CLOUDINARY_FOLDER` | `Starville-Photobooth` |
| `METRICS_API_URL` | `https://ai-photobooth-dashboard-brown.vercel.app/api/projects/c05733da-997d-4eab-811f-be7200a9cbb1/generate` |

The model is fixed server-side to the requested Flare model. `vercel.json` includes the logo in the function bundle, a 300-second generation budget and camera permissions for this origin. Live generation does not load the scene reference files. Use a Vercel plan/runtime that supports this function duration. API requests and responses are bounded below Vercel's 4.5 MB payload limit.

The public generation endpoint has no participant login. Configure Vercel Firewall rate limits and the OpenAI project's budget for the intended campaign traffic before public promotion. Same-origin checks are present, but they do not act as a global usage quota.

This repository is prepared for Vercel; creating a production deployment and setting remote secrets are separate from local provisioning.

## Verification

```sh
npm test
npm run build
```

Tests cover provider parameters and identity directives, every scene reference, actual logo pixels in the JPEG, malformed requests, provider failures without paid retries, metrics counting/failures, Cloudinary signature/retry behavior and per-mode variation cycling with blocked or malformed browser storage.

`node scripts/smoke-live.mjs` explicitly runs one paid end-to-end generation using a supplied reference portrait as a test selfie, uploads it and increments the project metric once. Start `npm run dev` first. It saves the result under ignored `artifacts/`. This command is not part of the normal checks.

For a local design walkthrough without paid API calls, set `LOCAL_PREVIEW_MODE=true` in `.env.local`, restart the dev server and take a selfie. The result is a clearly labeled supplied sample, not an AI transformation of the selfie; no upload, metrics or variation advancement occurs. This mode is forcibly disabled on Vercel. Set it back to `false` for live use.

Photobooth skills are pinned in the `.agents` Git submodule. The web implementation applies their screen flow, identity preservation, generation lifecycle, signing/retries and metrics rules; kiosk-specific QR, printing, rotation, credential panels and packaging do not apply to this public web project.

### Verification status — 25 October 2026

- Production build and all 13 automated checks passed; dependency audit reported zero vulnerabilities.
- Running local API rejects malformed requests; videos and screen assets return successful responses.
- Configured Cloudinary credentials authenticated successfully with a read-only API request.
- The initial two-image pipeline was verified with a live Flare test in 22 seconds. The 1080×1920 JPEG was visually inspected, contained the supplied logo and was successfully uploaded to Cloudinary. The metrics endpoint confirmed one generation increment. The subsequent selfie-only pipeline is checked with mocked provider requests; it has not yet been revalidated with a paid live generation.
- The replacement OpenAI key supplied during setup is saved only in ignored `.env.local` and was used successfully. The original AHK/Chicka OpenAI keys were rejected and are not used.
- Configured credentials were absent from the built client JavaScript/CSS.
- Browser automation was unavailable, so rendered layouts, physical camera capture and native mobile sharing need device verification.
- No Vercel deployment has been created or modified.
