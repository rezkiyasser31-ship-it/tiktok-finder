/**
 * Step 4: Search YouTube Data API v3 with quota conservation and AsyncStorage caching.
 *
 * Rules:
 * - Uses EXPO_PUBLIC_YOUTUBE_API_KEY from environment.
 * - Caches search results by normalized query in AsyncStorage (24h TTL).
 * - Fires search.list (maxResults=5) then videos.list for durations.
 * - Surfaces YouTubeQuotaExceededError on HTTP 403 quotaExceeded.
 * - searchTikTokOnYouTube ensures at most 2 network searches are ever fired per TikTok.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  YouTubeVideo,
  YouTubeQuotaExceededError,
  MissingYouTubeApiKeyError,
} from '../types';
import { rankResults } from './rankResults';

const CACHE_PREFIX = '@yt_v2_cache_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Normalizes query string for caching and deduplication.
 */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Parses ISO 8601 duration string (e.g. "PT1H12M30S", "PT18M42S", "PT45S") into seconds.
 */
export function parseIsoDuration(durationStr: string): number {
  if (!durationStr) return 0;
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Formats seconds into MM:SS or H:MM:SS.
 */
export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds < 0) return '0:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const paddedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;
  if (hours > 0) {
    const paddedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }
  return `${minutes}:${paddedSeconds}`;
}

/**
 * Checks YouTube API response for quota or authorization errors.
 */
async function checkApiResponseErrors(response: Response): Promise<void> {
  if (response.status === 403) {
    let errorDetails = '';
    try {
      const errorJson = await response.json();
      const reasons = errorJson?.error?.errors?.map((e: any) => e.reason) || [];
      if (reasons.includes('quotaExceeded') || reasons.includes('dailyLimitExceeded')) {
        throw new YouTubeQuotaExceededError(
          'YouTube API quota exceeded (10,000 units/day limit). The quota resets at midnight Pacific Time.'
        );
      }
      errorDetails = errorJson?.error?.message || '';
    } catch (e: any) {
      if (e instanceof YouTubeQuotaExceededError) throw e;
    }
    throw new YouTubeQuotaExceededError(
      `YouTube API access forbidden (HTTP 403): ${errorDetails || 'Quota or permissions limit exceeded.'}`
    );
  }

  if (response.status === 400) {
    const text = await response.text();
    throw new Error(`YouTube API Bad Request (HTTP 400): ${text}`);
  }

  if (!response.ok) {
    throw new Error(`YouTube API error (HTTP ${response.status})`);
  }
}

/**
 * Searches YouTube for a single query, checking AsyncStorage cache first.
 */
export async function searchYouTube(
  query: string,
  options: { maxResults?: number; forceRefresh?: boolean } = {}
): Promise<YouTubeVideo[]> {
  const apiKey = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY;
  if (!apiKey || apiKey === 'YOUR_YOUTUBE_API_KEY_HERE') {
    throw new MissingYouTubeApiKeyError();
  }

  const normalized = normalizeQuery(query);
  if (!normalized) return [];

  const cacheKey = `${CACHE_PREFIX}${normalized}`;
  const targetMin = options.maxResults || 10;

  // 1. Check cache
  if (!options.forceRefresh) {
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          Date.now() - parsed.timestamp < CACHE_TTL_MS &&
          parsed.results &&
          parsed.results.length >= targetMin
        ) {
          return parsed.results;
        }
      }
    } catch {
      // Ignore cache read failures and continue with network
    }
  }

  // 2. Network search.list
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${
    options.maxResults || 10
  }&q=${encodeURIComponent(normalized)}&key=${apiKey}`;

  const searchRes = await fetch(searchUrl);
  await checkApiResponseErrors(searchRes);

  const searchData = await searchRes.json();
  const items = searchData.items || [];
  if (items.length === 0) {
    // Cache empty results as well to prevent repeated wasted queries
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), results: [] }));
    } catch {}
    return [];
  }

  const videoIds = items
    .map((item: any) => item.id?.videoId)
    .filter(Boolean) as string[];

  // 3. videos.list for durations
  const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIds.join(
    ','
  )}&key=${apiKey}`;

  const videosRes = await fetch(videosUrl);
  await checkApiResponseErrors(videosRes);

  const videosData = await videosRes.json();
  const videoDetailsMap = new Map<string, any>();
  for (const v of videosData.items || []) {
    videoDetailsMap.set(v.id, v);
  }

  // 4. Assemble video objects
  const results: YouTubeVideo[] = videoIds.map((id) => {
    const detail = videoDetailsMap.get(id);
    const snippet = detail?.snippet || items.find((i: any) => i.id?.videoId === id)?.snippet || {};
    const durationIso = detail?.contentDetails?.duration || 'PT0S';
    const durationSeconds = parseIsoDuration(durationIso);

    const thumbnails = snippet.thumbnails || {};
    const thumbnailUrl =
      thumbnails.high?.url ||
      thumbnails.medium?.url ||
      thumbnails.default?.url ||
      `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

    return {
      id,
      title: snippet.title || '',
      channelTitle: snippet.channelTitle || '',
      duration: formatDuration(durationSeconds),
      durationSeconds,
      thumbnailUrl,
      url: `https://www.youtube.com/watch?v=${id}`,
    };
  });

  // 5. Store in cache
  try {
    await AsyncStorage.setItem(
      cacheKey,
      JSON.stringify({ timestamp: Date.now(), results })
    );
  } catch {
    // Ignore cache write failure
  }

  return results;
}

/**
 * Searches YouTube for candidate queries of a TikTok, strictly enforcing:
 * - NEVER fire more than 2 network searches per TikTok.
 * - Deduplicates results across queries.
 * - If best confidence on primary query is < 0.80, fires secondary fallback query.
 */
export async function searchTikTokOnYouTube(
  queries: string[],
  fallbackQuery?: string
): Promise<YouTubeVideo[]> {
  if (!queries || queries.length === 0) return [];

  const seenIds = new Set<string>();
  const combinedResults: YouTubeVideo[] = [];

  const primaryQuery = queries[0];
  console.log(`[YouTube Search] Running primary query: "${primaryQuery}" (maxResults=10)`);
  const firstResults = await searchYouTube(primaryQuery, { maxResults: 10 });
  console.log(`[YouTube Search] Primary query returned ${firstResults.length} raw results:`);
  firstResults.forEach((v, i) => {
    console.log(`  #${i + 1}: "${v.title}" | Channel: ${v.channelTitle} | Duration: ${v.duration}`);
  });

  for (const r of firstResults) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      combinedResults.push(r);
    }
  }

  // Quick evaluation of primary results
  // If best match is strong (confidence >= 0.80), we conserve quota; if under 0.80, we fire 2nd query
  const rankedFirst = rankResults(firstResults, [primaryQuery], 1);
  const bestConfidence = rankedFirst.length > 0 ? rankedFirst[0].confidence : 0;
  console.log(`[YouTube Search] Primary query best match confidence: ${bestConfidence}`);

  const secondaryQuery = fallbackQuery || (queries.length > 1 ? queries[1] : undefined);
  const shouldFireSecondary =
    bestConfidence < 0.80 &&
    secondaryQuery &&
    secondaryQuery.trim().toLowerCase() !== primaryQuery.trim().toLowerCase();

  if (shouldFireSecondary) {
    console.log(
      `[YouTube Search] Primary confidence (${bestConfidence}) < 0.80. Firing secondary fallback query: "${secondaryQuery}" (maxResults=10)`
    );
    try {
      const secondResults = await searchYouTube(secondaryQuery, { maxResults: 10 });
      console.log(`[YouTube Search] Secondary query returned ${secondResults.length} raw results:`);
      secondResults.forEach((v, i) => {
        console.log(`  (Q2) #${i + 1}: "${v.title}" | Channel: ${v.channelTitle} | Duration: ${v.duration}`);
      });

      for (const r of secondResults) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id);
          combinedResults.push(r);
        }
      }
    } catch (err: any) {
      console.warn('[YouTube Search] Secondary query failed:', err.message || err);
    }
  } else if (bestConfidence >= 0.80) {
    console.log(`[YouTube Search] Primary match confidence is strong (${bestConfidence} >= 0.80). Conserving quota, skipping secondary query.`);
  }

  return combinedResults;
}
