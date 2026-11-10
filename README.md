# Shanthi Inbox (wacrm-mobile)

Android + iPhone app for the Shanthi Boutique WhatsApp CRM (`wacrm`). The team can read and
reply to WhatsApp conversations, get push alerts, and send Shopify products, photos, voice
notes, templates and AI drafts.

Expo SDK 58 · React Native · TypeScript · expo-router · Supabase.

## How it talks to the CRM

| What | How |
| --- | --- |
| Sign in | Supabase email + password (`@supabase/supabase-js`); session kept in the keychain/keystore via `expo-secure-store` (chunked, see `src/lib/secure-storage.ts`) |
| Inbox, chat, contact, templates | Read directly from Supabase with the user's session. RLS scopes everything to the member's account, same as the web |
| Live updates | Supabase realtime on `conversations` and `messages` |
| Sending, products, AI draft, push registration | CRM API at `https://wacrm-rosy-alpha.vercel.app` with `Authorization: Bearer <supabase access token>` |
| Photos and voice notes | Uploaded to the `chat-media` bucket at `account-<account_id>/<timestamp>-<name>.<ext>` (same as the web), then sent by URL |

Public config (Supabase URL, **anon** key, API URL) lives in `app.config.ts` → `extra`. No secrets
belong in this repo.

> If the app says *"The CRM server didn't accept the app's sign-in (401)"*, the deployed CRM
> doesn't accept bearer tokens yet. Deploy the wacrm version that does.

## Develop

```bash
npm install
npm test            # unit tests (preview text, 24h window, upload path, product caption, filters)
npx tsc --noEmit    # typecheck
npx expo lint
npx expo-doctor
```

Quick UI check in a browser (no camera, mic or push on web):

```bash
npx expo start --web
```

This app uses native modules (audio recording, secure store, notifications), so it does **not**
run in Expo Go. Use a development build (below) or a preview build.

### iOS Simulator (needs a full Xcode install)

1. Install Xcode from the Mac App Store, open it once, then run:
   `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
2. Then either build locally with `npx expo run:ios`, or download an EAS simulator build (see below) and drag the `.app` onto the Simulator.

## Build with EAS (in the cloud, no Mac build tools needed)

One-time setup (you do these steps yourself, because they need your password):

```bash
npx eas-cli@latest login      # create a free account at expo.dev first
npx eas-cli@latest init       # links this folder to an Expo project and prints a project id
```

`app.config.ts` is dynamic, so `eas init` can't write the id for you. Put it in
`extra.eas.projectId` in `app.config.ts` (or export `EAS_PROJECT_ID` before building). Push
notifications don't work without it.

| Profile | Command | Result |
| --- | --- | --- |
| development | `npx eas-cli build -p android --profile development` | Dev-client APK (pairs with `npx expo start`) |
| preview | `npx eas-cli build -p android --profile preview` | **Installable APK.** Open the link on each Android phone and install it |
| preview | `npx eas-cli build -p ios --profile preview` | iOS **Simulator** build (no Apple account needed) |
| production | `npx eas-cli build -p all --profile production` | Store builds (AAB / IPA) |

### Android phones (easiest)

Run the `preview` Android build and send the download link or QR code to the team. Each phone
needs "Install unknown apps" allowed for the browser.

### Real iPhones

You need an Apple Developer account ($99/year). Then either:

- **Ad-hoc / internal:** run `npx eas-cli device:create` once per iPhone, then
  `npx eas-cli build -p ios --profile preview` with `"ios": { "simulator": false }` added to the preview profile.
- **TestFlight:** `npx eas-cli build -p ios --profile production && npx eas-cli submit -p ios`.

### Push notifications

- Android: works on preview and production builds once the EAS project id is set. For FCM,
  upload a Firebase `google-services.json` and run `npx eas-cli credentials` (Expo's push service
  needs FCM V1 credentials for Android).
- iOS: needs the Apple Developer account. EAS creates the APNs key when you build.
- The app registers its token with `POST /api/push/devices` on every launch and removes it with
  `DELETE /api/push/devices` when you sign out. Tapping an alert opens that chat
  (`data.conversation_id`).

## Features (v1)

- Inbox: All / Mine / Unread / Pending, search (name, phone, last message), unread badges, pull to refresh, realtime
- Chat: text, image (tap to zoom), video and document attachments, voice note player, product captions, templates and interactive messages (read only), delivery ticks, retry failed text/media sends, load earlier, marks read when opened
- Composer: text, camera or gallery photo/video and document attachments, hold the mic to record a voice note (AAC/M4A, release to send), device-local quick replies, Shopify product picker (photo + caption, same format as the web), AI draft
- 24-hour window: once it closes, the composer switches to approved templates only (same rule as the web)
- Contact: name, phone, email, company, tags, assign to any account teammate; set open / pending / closed status
- Templates: search approved templates and keep device-local favorites
- Viewers (`account_role = viewer`) get a read-only composer
- Settings: notifications on/off, sign out

Mobile quick replies and template favorites are stored on the current device and are not shared with teammates.
Document attachments are limited to 25 MB because the current storage upload buffers files in memory.

Not available without additional CRM backend support: shared quick replies, reply-to quoting when sending,
internal notes and mentions, interactive-message responses, template URL-button variables, and WhatsApp
phone-number/quality/limit health dashboards.
