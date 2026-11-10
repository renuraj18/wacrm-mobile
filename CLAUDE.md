# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

"Shanthi Inbox" — an Expo SDK 58 / React Native / TypeScript mobile client for the `wacrm` WhatsApp CRM (a separate Next.js + Supabase project). Staff read and reply to WhatsApp conversations, get push alerts, and send products, photos, voice notes and templates. See `README.md` for EAS build/setup walkthroughs. `AGENTS.md` requires checking versioned Expo docs (`https://docs.expo.dev/versions/v58.0.0/`) before touching Expo/RN APIs.

## Commands

```bash
npm install
npm test                          # jest (jest-expo preset); only **/__tests__/**/*.test.ts are run
npx jest src/lib/__tests__/preview.test.ts   # single test file
npx jest -t "name pattern"        # single test by name
npm run typecheck                 # tsc --noEmit
npm run lint                      # expo lint
npx expo-doctor
npx expo start --web              # quick UI check in browser (no camera/mic/push)
```

Run lint and typecheck before declaring a task done. Use `npx expo install <pkg>` (not npm add) to add dependencies.

The app uses native modules (audio, secure store, notifications) so it does **not** run in Expo Go — use a dev build (`npx expo run:ios|android` or `npx eas-cli build --profile development`). `ios/` and `android/` are not checked in (CNG); configure native behavior in `app.config.ts` plugins, never by hand.

## Architecture

- **Routing**: expo-router under `src/app/`. `_layout.tsx` uses `Stack.Protected` guards on `session` to switch between `sign-in` and the `(app)` group: a `(tabs)` bottom-tab shell (Chats `index`, `contacts`, `settings`; each tab draws its own `ScreenHeader`) plus stack screens `chat/[id]`, `contact/[id]` and `new-chat`. Theme (`lib/theme.tsx`) is a provider with a persisted System/Light/Dark mode; shared UI primitives live in `src/components/ui/`. Typed routes are enabled. Path alias `@/` → `src/`.
- **Config**: `app.config.ts` is dynamic; public Supabase URL, anon key and CRM API URL live in `extra` (read via `src/lib/config.ts`). No secrets belong here. The EAS project id comes from `EAS_PROJECT_ID` or `extra.eas.projectId` (push tokens need it).
- **Two backends, one identity**: the Supabase session (email/password, persisted via chunked `expo-secure-store` in `lib/secure-storage.ts`) is used two ways:
  1. *Reads* go straight to Supabase (`lib/supabase.ts`); RLS scopes everything to the member's account.
  2. *Writes/actions* (sending messages, products, AI drafts, push registration) go through the CRM REST API via `lib/api.ts`, sending the Supabase access token as `Authorization: Bearer`. A 401 is mapped to `SERVER_NOT_UPDATED` (the deployed CRM may not accept bearer tokens yet).
  - Photos/voice notes upload to the Supabase `chat-media` bucket at `account-<account_id>/<timestamp>-<name>.<ext>` (`lib/upload.ts`, `lib/media-path.ts`), then are sent by URL.
- **Inbox state** (`lib/inbox-store.tsx`): `InboxProvider` (keyed by user id so sign-out resets state) holds the conversation list, fed by an initial fetch plus Supabase realtime (`hooks/use-realtime.ts`, a single channel over `conversations`/`messages`). Realtime rows carry no joins, so unknown conversations are hydrated via `ensure()`. It refetches when the app returns to foreground (realtime events are lost while suspended) and zeroes `unread_count` for the conversation currently open (`setActiveId`).
- **Optimistic messages** (`lib/optimistic.ts`, ported from wacrm's web inbox): sends insert a `temp-` id message; the realtime INSERT replaces the matching temp bubble (matched by sender/conversation/content). Keep this logic in sync with the web CRM when changing it.
- **Push**: `lib/push.ts` registers on every signed-in launch; `hooks/use-notification-tap.ts` (with a `.web.ts` stub) deep-links notification taps — including cold start — to `/chat/[id]`.
- **Domain helpers** with unit tests live in `src/lib/` (`session-window.ts` for WhatsApp's 24h free-form reply window, `preview.ts`, `products.ts`, `conversations.ts`). Tests are pure-function `.ts` only (no component tests).
- Platform-specific files use the `.web.ts` suffix convention.
