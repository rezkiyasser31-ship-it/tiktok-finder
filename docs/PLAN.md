# TikTok Finder - Architectural Plan & Roadmap

## 1. System Architecture

TikTok Finder is an Android-first Expo (React Native) application built with `expo-dev-client`. It allows mobile users to share short, sliced TikTok videos (Part 1, Part 2, etc.) directly into the app from the system share sheet, automatically identifying and linking the original, uncut YouTube source video.

```
+-----------------------------------------------------------------------+
|                             USER ENTRY                                |
|  - System Share Sheet (URL text/plain or screenshot image/*)           |
|  - Manual Paste box (Home Screen)                                     |
+------------------------------------+----------------------------------+
                                     |
                                     v
+------------------------------------+----------------------------------+
|                   PIPELINE (src/core/ & src/services/)                |
|                                                                       |
|  1. resolveTikTokUrl(rawInput)                                         |
|     * Follows vm.tiktok.com / vt.tiktok.com / t.tiktok.com redirects   |
|     * Resolves to canonical tiktok.com/@username/video/{id}           |
|                                                                       |
|  2. fetchTikTokMeta(canonicalUrl)                                     |
|     * Public oEmbed API (zero API key, zero quota)                    |
|     * Extracts caption, creator username, thumbnail URL               |
|                                                                       |
|  3. OCR Fallback (recognizeThumbnailText / recognizeImageText)        |
|     * Runs on-device Google ML Kit OCR via                            |
|       @react-native-ml-kit/text-recognition                           |
|     * Analyzes video thumbnail & shared screenshots for on-screen     |
|       show titles, channel names, and watermarks                       |
|                                                                       |
|  4. extractCandidateQueries(caption, ocrText)                         |
|     * Multilingual cleaning (English, French, Arabic, Spanish)        |
|     * Strips emojis, hashtags (#fyp, #viral, #pourtoi, #اكسبلور)      |
|     * Strips part indicators ("part 2", "pt. 3", "p4", "2/5", "(2)",  |
|       "الجزء 2", "partie 2", "parte 2", "ج2", "بارت 1")               |
|     * Produces 1-3 ranked candidate YouTube queries                   |
|                                                                       |
|  5. searchYouTube & searchTikTokOnYouTube                             |
|     * YouTube Data API v3 (search.list + videos.list)                 |
|     * AsyncStorage caching by normalized query (24h TTL)              |
|     * Quota guard: maximum 2 search calls per TikTok                  |
|     * Extracts video titles, channels, and ISO 8601 durations         |
|                                                                       |
|  6. rankResults(candidates, queries)                                  |
|     * Pure TypeScript Token-Set Ratio fuzzy similarity                |
|     * Key query token match ratio                                     |
|     * Full-length duration bonus (>8 min +0.10 to +0.20,              |
|       <60s Shorts penalty -0.15)                                      |
|     * Returns top 3 videos with confidence score (0.00-1.00)          |
+------------------------------------+----------------------------------+
                                     |
                                     v
+------------------------------------+----------------------------------+
|                             USER ACTION                               |
|  - Open video in native YouTube App (fallback to browser)             |
|  - Edit search query & re-run search                                  |
|  - Alternate candidate search chips                                   |
|  - Saved to local History (AsyncStorage)                              |
+-----------------------------------------------------------------------+
```

---

## 2. Core Modules Specification (`src/core/`)

1. **`resolveTikTokUrl`** ([`resolveTikTokUrl.ts`](file:///src/core/resolveTikTokUrl.ts)):
   - Handles short links (`vm.tiktok.com`, `vt.tiktok.com`, `tiktok.com/t/`) and full URLs.
   - Extracts URLs from surrounding text (e.g. Android share intent messages).
   - Follows HTTP redirects to canonical `tiktok.com/@user/video/ID` format and strips tracking query parameters.

2. **`fetchTikTokMeta`** ([`fetchTikTokMeta.ts`](file:///src/core/fetchTikTokMeta.ts)):
   - Calls the public `https://www.tiktok.com/oembed?url=<url>` endpoint without requiring an API key.
   - Returns `{ canonicalUrl, caption, authorName, thumbnailUrl }`.

3. **`extractCandidateQueries`** ([`extractCandidateQueries.ts`](file:///src/core/extractCandidateQueries.ts)):
   - Cleans caption text across English, Arabic, and French.
   - Strips hashtags (`#...`), mentions (`@...`), emojis, and part markers.
   - Strips viral noise words (`fyp`, `foryou`, `viral`, `pourtoi`, `اكسبلور`, etc.).
   - Integrates on-device OCR text from thumbnail or screenshot.
   - Returns 1-3 ranked query strings.

4. **`searchYouTube`** ([`searchYouTube.ts`](file:///src/core/searchYouTube.ts)):
   - Queries YouTube Data API v3 (`search.list` for top 5 videos, `videos.list` for durations).
   - Normalizes queries and caches responses in `AsyncStorage` with a 24-hour TTL.
   - `searchTikTokOnYouTube` guarantees at most 2 network searches per TikTok (skipping search 2 if query 1 yields high results).
   - Surfaces `YouTubeQuotaExceededError` on HTTP 403 `quotaExceeded` with actionable advice.

5. **`rankResults`** ([`rankResults.ts`](file:///src/core/rankResults.ts)):
   - Implements a pure TypeScript Token-Set Ratio algorithm that handles word order permutations and token overlap.
   - Evaluates key query token containment.
   - Applies duration heuristic: TikTok reuploads are segments sliced from long videos, so videos > 8 minutes receive a boost, while < 60-second shorts are penalized.
   - Returns top 3 matches with confidence score (0.00 - 1.00) and explainable match reasons.

6. **`ocrService`** ([`ocrService.ts`](file:///src/core/ocrService.ts)):
   - On-device ML Kit text recognition via `@react-native-ml-kit/text-recognition`.
   - Downloads remote thumbnail to local cache via `expo-file-system`, runs OCR, and cleans up.
   - Accepts shared screenshot image URIs from the share sheet and processes them directly.

---

## 3. Known Limitations

1. **TikTok oEmbed Limitations**:
   - The oEmbed endpoint only provides the original caption text and the static thumbnail image. It does not provide intermediate video frames.
   - In many TikTok videos, creators put the actual video title on-screen around the 5–15 second mark, rather than in the caption or first thumbnail frame.
   - *Mitigation implemented*: The app supports sharing screenshots from the Android share sheet. Users can pause on the title card, screenshot it, and share it directly into the app for instant OCR.

2. **YouTube Data API v3 Quotas**:
   - The default free tier quota is 10,000 units per day.
   - A single `search.list` call costs **100 units** (allowing ~100 queries/day).
   - *Mitigation implemented*:
     - Aggressive 24-hour result caching in `AsyncStorage` by normalized query.
     - Hard limit of at most 2 search queries per TikTok.
     - "Search YouTube manually" button opens YouTube app search directly with the detected query, using 0 API quota.

---

## 4. Phase 2 Backlog

### (a) LLM-Based Title Extraction Fallback
- Integrate an ultra-lightweight LLM call (e.g. Gemini 1.5 Flash via `@google/genai`) when regex query extraction yields low confidence or ambiguous captions.
- The model receives caption + OCR text and returns the exact canonical show, movie, or creator title formatted for YouTube search.

### (b) Multi-Part Deduplication
- Build a local or remote mapping cache (`Part 1`, `Part 2`, `Part 3` of the same series/topic).
- When a user inputs "Show Title Part 2", automatically normalize to the same master record as "Show Title Part 1", bypassing repeated YouTube API calls.

### (c) Piped / Invidious Quota-Free Search Fallback
- Implement a fallback search provider using public Invidious or Piped API instances when the Google YouTube Data API quota is exceeded (`YouTubeQuotaExceededError`).
- Ensures uninterrupted service even after 100+ daily searches.

### (d) iOS Share Extension
- Configure `expo-share-intent` iOS targets with App Groups and Keychain sharing to enable the native iOS Safari / TikTok share sheet.
