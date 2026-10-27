# Mithaq — native mobile app (Expo / React Native)

A real native app for Android and iPhone. It shares the website's Supabase project
(same accounts, data and security rules) and calls the website's server for the AI
features (`/api/chat`, `/api/audit`), so the website must be running somewhere the
phone can reach.

## Try it on your phone today (no store, no Mac needed)

1. Install **Expo Go** from the Play Store or App Store.
2. On the laptop, start the website: `npm run dev:standalone` (in the main folder).
3. Phone and laptop on the **same Wi-Fi**. In `mobile/app.json`, `extra.apiUrl` must be
   the laptop's address (now `http://192.168.10.81:3000`; check with `ipconfig` → IPv4).
4. In this folder: `npm install` (first time only), then `npx expo start`.
5. Scan the QR code with the phone camera (iPhone) or with Expo Go (Android).

## Publish to the stores (later)

Uses Expo's cloud build service (EAS), so **no Mac is needed even for iPhone**:

1. `npm i -g eas-cli`, then `eas login` (free Expo account).
2. Set `extra.apiUrl` in `app.json` to the real hosted website (https://…).
3. `eas build --platform android` → upload the `.aab` to Google Play (one-time $25).
4. `eas build --platform ios` → `eas submit -p ios` (Apple Developer, $99/year).

App id: `sa.mithaqalarabia.app` (Android package and iOS bundle id).

## Notes

- The app is Arabic and right-to-left (forced in `app.json` → `expo-localization`).
- `metro.config.js` stops Metro from picking up the website's `node_modules`.
- `.npmrc` has `legacy-peer-deps=true` because a web-only peer (react-dom) conflicts;
  install packages with `npx expo install <name>`.
