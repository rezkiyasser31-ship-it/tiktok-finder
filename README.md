# TikTok Finder (`tiktok-finder`) 🎬🔍

A mobile application (Android-first) built with Expo (React Native) and Google ML Kit on-device OCR that identifies and links the original, uncut YouTube source video for TikTok clips that have been sliced into parts (Part 1, Part 2, etc.).

> *Built with the help of Google Antigravity.*

---

## Overview

When browsing TikTok, users frequently encounter viral movie, show, or documentary scenes sliced into arbitrary multi-part segments. **TikTok Finder** solves this by allowing users to share TikTok links or screenshots directly from Android's system share sheet (or paste URLs manually). 

The app executes a local-first pipeline: canonical URL resolution, oEmbed metadata retrieval, on-device OCR fallback via Google ML Kit, multilingual query cleaning, quota-conscious YouTube Data API v3 querying, and token-set fuzzy similarity scoring to surface the full-length source video.

---

## 🌟 Key Features

- **Native Android Share Target:** Registers in Android's native system share sheet for both URLs (`text/plain`) and screenshots (`image/*`) via `expo-share-intent`.
- **Intelligent Multilingual Query Cleaning:** Automatically strips viral hashtags (`#fyp`, `#viral`, `#pourtoi`, `#اكسبلور`), emojis, and multi-language part indicators (`part 2`, `pt. 3`, `p4`, `2/5`, `(2)`, `الجزء 2`, `partie 2`, `parte 2`, `ج2`, `بارت 1`).
- **On-Device ML Kit OCR:** Scans TikTok thumbnails and user-shared screenshots locally for on-screen show titles, watermarks, and channel names without uploading images to cloud endpoints.
- **Quota-Conscious YouTube Search:** Enforces a hard limit of at most 2 YouTube search requests per TikTok with 24-hour persistent caching via `@react-native-async-storage/async-storage`.
- **Fuzzy Token Similarity & Duration Scoring:** Ranks search results using pure TypeScript Token-Set Ratio algorithm with weighted duration bonuses for full-length videos (>8 minutes) and penalties for YouTube Shorts (<60s).
- **Deep Linking:** Opens detected source videos directly in the official YouTube mobile app with fallback to browser, plus a one-tap manual YouTube search button.
- **Persistent Search History:** Stores previous searches locally for instant offline retrieval and re-inspection.

---

## 🛠️ Tech Stack

- **Framework:** [Expo](https://expo.dev/) (React Native 0.88 / Expo SDK 58) + [TypeScript](https://www.typescriptlang.org/)
- **Native Runtime:** Expo Development Build (`expo-dev-client`)
- **System Share Integration:** `expo-share-intent`
- **OCR Engine:** `@react-native-ml-kit/text-recognition` (Google ML Kit on-device)
- **Local Storage & Cache:** `@react-native-async-storage/async-storage`
- **Testing:** Jest + `ts-jest` (42 unit tests)

---

## 🚀 Getting Started

### Prerequisites
1. **Node.js:** Node 18+ (Node 20+ recommended).
2. **Java JDK:** OpenJDK 17 with `JAVA_HOME` configured.
3. **Android Studio:** Android SDK Platform 34 or 35 with `ANDROID_HOME` configured and `platform-tools` in `PATH`.
4. **Physical Android Device** with USB Debugging enabled, or an Android Virtual Device (AVD).

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rezkiyasser31-ship-it/tiktok-finder.git
   cd tiktok-finder
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   *(The `postinstall` script automatically applies native Scoped Storage patches from `patches/expo-share-intent+9.0.0.patch` via `patch-package`).*

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and provide your YouTube Data API v3 key:
   ```env
   EXPO_PUBLIC_YOUTUBE_API_KEY=your_youtube_api_key_here
   ```

---

## 🔑 Obtaining a YouTube Data API v3 Key

1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. In **APIs & Services** > **Library**, search for **YouTube Data API v3** and click **Enable**.
4. Go to **APIs & Services** > **Credentials** and click **Create Credentials** > **API Key**.
5. Paste the key into your local `.env` file (`EXPO_PUBLIC_YOUTUBE_API_KEY`).
6. *(Recommended)* Restrict the key to Android apps or the YouTube Data API v3 service.

---

## 📱 Running the Development Build

Because `expo-share-intent` and `@react-native-ml-kit/text-recognition` contain native Android modules, the app runs as an Expo Development Build:

### Local Android Build (Recommended)
```bash
# Start on connected Android device or emulator
npx expo run:android
```

### Start Metro Bundler
```bash
npx expo start --dev-client
```

---

## 🧪 Testing & Validation

Run unit tests covering query extraction, multilingual part stripping, OCR, and fuzzy scoring:
```bash
npm test
```

Run TypeScript static typecheck:
```bash
npx tsc --noEmit
```

---

## 📂 Project Structure

```
tiktok-finder/
├── App.tsx                               # Root component & Share Intent coordinator
├── app.json                              # Expo configuration & native plugins
├── .env.example                          # Environment variable template
├── .gitignore                            # Git ignore (.env, native caches, APKs)
├── jest.config.js                        # Jest configuration
├── tsconfig.json                         # TypeScript compiler options
├── package.json                          # Scripts & dependencies
├── patches/                              # Native patches (expo-share-intent)
├── docs/                                 # Architectural plans and documentation
│   ├── PLAN.md                           # System architecture & pipeline spec
│   └── TESTING_FOR_BEGINNERS.md          # Manual testing walkthrough
├── src/
│   ├── types/
│   │   └── index.ts                      # Shared TypeScript interfaces & error classes
│   ├── core/                             # 6 Pure, unit-testable pipeline modules
│   │   ├── index.ts                      # Core barrel export
│   │   ├── resolveTikTokUrl.ts           # Resolves short URLs to canonical links
│   │   ├── fetchTikTokMeta.ts            # Fetches metadata via public oEmbed endpoint
│   │   ├── extractCandidateQueries.ts    # Multilingual cleaning & query extraction
│   │   ├── searchYouTube.ts              # Quota-safe YouTube Data API search
│   │   ├── rankResults.ts                # Token-Set Ratio & duration-weighted ranking
│   │   └── ocrService.ts                 # Local ML Kit OCR text recognition
│   ├── services/
│   │   ├── finderPipeline.ts             # End-to-end pipeline orchestrator
│   │   └── historyStorage.ts             # AsyncStorage history cache repository
│   ├── components/
│   │   ├── Header.tsx                    # Top navigation & branding header
│   │   ├── LoadingView.tsx               # Real-time pipeline stage progress spinner
│   │   ├── ResultView.tsx                # TikTok preview, query editor & ranked matches
│   │   ├── ErrorView.tsx                 # Friendly quota, API key & 404 error handlers
│   │   └── HistoryList.tsx               # Search history with timestamps & one-tap re-run
│   └── utils/
│       └── linking.ts                    # Deep linking to YouTube app and browser
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
