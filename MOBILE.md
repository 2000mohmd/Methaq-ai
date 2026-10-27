# Mithaq on phones

There are two ways to put Mithaq on a phone. Both use the same website. Nothing is rewritten.

1. **Installable web app (PWA)**: free and works today. People add it to their home screen from the browser.
2. **Store apps (Android / iOS)**: a thin native "shell" (built with Capacitor) that opens the hosted site inside an app. It is needed only if you want listings on Google Play and the App Store.

## Step 0 (required for both): host the site on a public HTTPS address

The app runs on its own server: it renders pages and runs `/api/chat`, `/api/audit` and `/api/ocr`, which hold your secret keys. So phones must load it from the internet, and the phone app cannot run offline. Before anything else:

1. Deploy the site (see `SETUP.md` / `Dockerfile`; `npm run build:standalone` then `npm start`) behind a real domain with HTTPS, e.g. `https://app.mithaqalarabia.sa`.
2. In **Supabase → Authentication → URL Configuration**:
   - set **Site URL** to that address
   - add `https://YOUR-DOMAIN/app` and `https://YOUR-DOMAIN/auth` to **Redirect URLs** (email confirmation and password reset send people back to these).
3. In Google Cloud (if you use Google sign-in), add the same domain to the OAuth client's authorized origins.

## Option 1: install as a web app (PWA)

Already set up: `public/manifest.webmanifest`, the icons in `public/icons/` and `public/apple-touch-icon.png`, and the tags in `src/routes/__root.tsx`.

**iPhone / iPad (Safari):** open the site → tap **Share** → **Add to Home Screen** → **Add**.
**Android (Chrome):** open the site → tap the **⋮** menu → **Install app** (or **Add to Home screen**). Chrome may also show an install banner by itself.

The app opens full-screen at `/app`, with the Mithaq icon and the navy theme. It still needs internet. There is no offline mode, on purpose: legal answers must come from the live server.

## Option 2: store apps with Capacitor

Files: `capacitor.config.ts` (app id `sa.mithaqalarabia.app`, name "Mithaq"), `mobile/www/index.html` (a small "can't connect" page shown if the site is unreachable), `android/` (the generated Android Studio project).

The shell loads whatever address you put in the `CAP_SERVER_URL` environment variable (`MOBILE_APP_URL` also works). **Set it every time you sync**, or the app will only show the "can't connect" page:

```bash
# macOS / Linux / Git Bash
CAP_SERVER_URL=https://app.mithaqalarabia.sa npm run cap:sync
# Windows PowerShell
$env:CAP_SERVER_URL="https://app.mithaqalarabia.sa"; npm run cap:sync
```

Website updates show up in the apps straight away, with no store resubmission. You only rebuild the app when you change the URL, the icon, or native plugins.

### Android → Google Play

1. Install **Android Studio** (free). It brings the Android SDK and Java.
2. `npm install`, then run the `cap:sync` command above with your URL, then `npm run cap:android` (this opens Android Studio).
3. Try it: press ▶ to run it on an emulator or a USB-connected phone.
4. App icon: in Android Studio, right-click `app/res` → **New → Image Asset**, and pick `public/icons/icon-maskable-512.png`.
5. **Build → Generate Signed App Bundle** → create a keystore. **Back up the keystore and its password**: losing them means you can never update the app.
6. Create a **Google Play Console** account ($25 one-time). Create the app, fill in the listing, the privacy policy URL (`/privacy`) and the data-safety form, then upload the `.aab` file. New personal accounts must run a closed test (12+ testers for 14 days) before going public.

### iOS → App Store (needs a Mac)

You cannot build iOS apps on Windows. On a Mac:

1. Install **Xcode** from the Mac App Store, and CocoaPods if Xcode asks for it.
2. Clone the repo, `npm install`, then `npx cap add ios` (one time; this creates the `ios/` folder; commit it).
3. Run the `cap:sync` command above with your URL, then `npm run cap:ios` (this opens Xcode).
4. In Xcode: choose your team under **Signing & Capabilities**, set the app icon (`public/icons/icon-512.png`; Xcode wants 1024×1024, so export a larger one from `public/brand/mark-white.svg` on navy `#013041`), and run it on a simulator or iPhone.
5. Join the **Apple Developer Program** ($99/year). **Product → Archive → Distribute App**, then finish the listing in App Store Connect (privacy policy, privacy "nutrition labels", screenshots, and a **demo login for the reviewer**).

### Apple rejection risk (guideline 4.2, "minimum functionality")

Apple often rejects apps that are only a website in a frame. Google Play is much more lenient. To improve the odds on iOS, add a few real native features before submitting. Each is a small Capacitor plugin:

- **Share sheet** (`@capacitor/share`): share an answer or a generated document to WhatsApp or Mail.
- **File / camera picker** (`@capacitor/camera`, `@capacitor/filesystem`): scan a contract for OCR and save the `.docx` to Files.
- **Push notifications** (`@capacitor/push-notifications`): later, for case or deadline reminders.
- **Native sign-in flow** (see below), plus no visible browser-like UI.

Even with these, approval is not guaranteed. If iOS is rejected, the PWA (Option 1) still works on iPhone today.

### Sign-in inside the app

- **Email + password** works inside the app as it is. This is the recommended login for the store apps.
- **Google sign-in will not work inside the app's embedded browser.** Google blocks embedded web views (error `disallowed_useragent`). Choose one:
  - hide or turn off the Google button in the app and use email login there, or
  - open Google sign-in with `@capacitor/browser` (the system browser) and come back through a deep link (`sa.mithaqalarabia.app://...` or a verified `https://` App Link / Universal Link). Add that return address to the Supabase Redirect URLs. This needs a little code. Do it only if Google login in the app matters.
- Email confirmation and password-reset links open in the phone's normal browser, not the app. That is fine: the user signs in there or goes back to the app and signs in. Opening those links directly in the app also needs App Links / Universal Links.

### Before a public launch

The store apps are a new way for the public to reach the product. The same rules apply as for the website: the regulatory/licensing confirmation, the PDPL assessment, and the data-residency decision in the project notes must be done before real users sign up through any channel.
