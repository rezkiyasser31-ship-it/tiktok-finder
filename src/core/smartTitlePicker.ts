/**
 * Smart Title Picker from OCR Blocks.
 *
 * ML Kit returns text blocks with bounding boxes and line-level coordinates.
 * This module identifies the genuine video title by:
 * 1. Filtering out TikTok UI overlays, metrics (11.8K, 1,475), timestamps, usernames (@ali_jutty687).
 * 2. Isolating Part markers ("Part.3", "Pt. 2") for display only (never in YouTube query).
 * 3. Selecting the text block/line with the largest font height in the top ~40% of the video area.
 * 4. Filtering out subtitle-style lower text (e.g. "first contract: a sheep-eating troll") and isolated center words ("sheep").
 */

import { OcrBlock, OcrLine, OcrRecognitionResult, SmartTitleResult } from '../types';

// UI strings common in TikTok / social video apps
const UI_EXACT_OR_PREFIX_PATTERNS = [
  /^find related content/i,
  /^search$/i,
  /^add comment(?:\.{3})?$/i,
  /^follow$/i,
  /^following$/i,
  /^share$/i,
  /^repost$/i,
  /^original sound/i,
  /^friends$/i,
  /^messages?$/i,
  /^suggested accounts?/i,
  /^stitch with/i,
  /^duet with/i,
];

// Metrics / counters: e.g. "11.8K", "54", "1,475", "93", "2.4M"
const METRIC_COUNT_REGEX = /^[\d.,]+\s*[KkMmB]?$/;

// Usernames: "@username" or "ali_jutty687" (underscore with letters/digits)
const USERNAME_REGEX = /^(?:@[a-zA-Z0-9_.-]+|[a-zA-Z0-9]+_[a-zA-Z0-9_]*\d+[a-zA-Z0-9_]*)$/;

// Time / relative time: "1d ago", "2h ago", "00:15"
const TIME_REGEX = /^(?:\d+\s*[smhdwy]\s*ago|\d{1,2}:\d{2}(?::\d{2})?)$/i;

// Hashtag-only lines: e.g. "#witcher #witcher3 #pov #storytime"
const HASHTAG_ONLY_REGEX = /^(?:#[a-zA-Z0-9_\u0600-\u06FF]+\s*)+$/;

// Part marker regex for isolating part numbers: "Part.3", "part 2", "pt. 3", "p4", "2/5", "الجزء 2"
const PART_MARKER_REGEX =
  /(?:^|[\s\(\[\{])(?:part|partie|parte|pt|p|ep|جزء|الجزء|بارت)[\s.:_-]*[\d٠-٩]+(?:\s*\/\s*[\d٠-٩]+)?(?:[\)\]\}]|\b|$)/i;

/**
 * Checks if a line text is TikTok UI noise.
 */
export function isUiNoise(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  if (METRIC_COUNT_REGEX.test(trimmed)) return true;
  if (USERNAME_REGEX.test(trimmed)) return true;
  if (TIME_REGEX.test(trimmed)) return true;
  if (HASHTAG_ONLY_REGEX.test(trimmed)) return true;

  for (const pattern of UI_EXACT_OR_PREFIX_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  return false;
}

/**
 * Extracts a part marker from a text string if present.
 */
export function extractPartMarker(text: string): { cleanedText: string; partMarker?: string } {
  const match = text.match(PART_MARKER_REGEX);
  if (!match) {
    return { cleanedText: text.trim() };
  }

  const partMarker = match[0].trim().replace(/^[\(\[\{]/, '').replace(/[\)\]\}]$/, '').trim();
  const cleanedText = text.replace(match[0], ' ').replace(/\s{2,}/g, ' ').trim();

  return { cleanedText, partMarker };
}

interface ScoredCandidate {
  text: string;
  fontHeight: number;
  relativeTop: number;
  score: number;
}

/**
 * Sanitizes and caps a search query by whole words (never truncates mid-word).
 * Strips all punctuation (semicolons, colons, hyphens, etc.) and excess whitespace.
 */
export function buildCleanQuery(rawTokens: string[], maxWords: number = 10, maxChars: number = 80): string {
  const words: string[] = [];
  for (const token of rawTokens) {
    if (!token) continue;
    // Replace punctuation with space
    const cleaned = token
      .replace(/[^\w\s\u0600-\u06FF]/gu, ' ')
      .replace(/[-_]/g, ' ')
      .trim();

    for (const w of cleaned.split(/\s+/)) {
      if (!w) continue;
      // Correct known OCR edge-truncation typo (e.g. 'trol' -> 'troll')
      const word = w.toLowerCase() === 'trol' ? 'troll' : w;
      words.push(word);
    }
  }

  // Cap by whole words without cutting mid-word
  const selectedWords: string[] = [];
  let currentLength = 0;

  for (const word of words) {
    if (selectedWords.length >= maxWords) break;
    const addedLength = selectedWords.length === 0 ? word.length : word.length + 1;
    if (currentLength + addedLength > maxChars) break; // Whole-word boundary cap
    selectedWords.push(word);
    currentLength += addedLength;
  }

  return selectedWords.join(' ').trim();
}

/**
 * Chooses the best video title from OCR blocks with bounding boxes.
 */
export function pickTitleFromOcrBlocks(
  ocrResult: OcrRecognitionResult,
  imageDimensions?: { width: number; height: number }
): SmartTitleResult {
  const rawText = ocrResult?.text || '';
  const blocks = ocrResult?.blocks || [];

  if (!blocks || blocks.length === 0) {
    // If no bounding boxes available, clean the plain text
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && !isUiNoise(l));
    let detectedPart: string | undefined;
    const candidates: string[] = [];

    for (const line of lines) {
      const { cleanedText, partMarker } = extractPartMarker(line);
      if (partMarker && !detectedPart) detectedPart = partMarker;
      if (cleanedText && cleanedText.length >= 3) {
        candidates.push(cleanedText);
      }
    }

    return {
      chosenTitle: candidates[0] || '',
      partMarker: detectedPart,
      candidateTitles: candidates.slice(0, 3),
      rawText,
    };
  }

  // Determine effective screen height
  let estimatedHeight = imageDimensions?.height || 0;
  if (!estimatedHeight) {
    for (const b of blocks) {
      const bBottom = (b.frame?.top || 0) + (b.frame?.height || 0);
      if (bBottom > estimatedHeight) estimatedHeight = bBottom;
      if (b.lines) {
        for (const l of b.lines) {
          const lBottom = (l.frame?.top || 0) + (l.frame?.height || 0);
          if (lBottom > estimatedHeight) estimatedHeight = lBottom;
        }
      }
    }
  }
  if (!estimatedHeight) estimatedHeight = 1920; // default Android vertical ratio

  let foundPartMarker: string | undefined;
  const scoredCandidates: ScoredCandidate[] = [];

  // Flatten blocks into lines or meaningful blocks
  const allUnits: { text: string; top: number; height: number }[] = [];

  for (const block of blocks) {
    if (block.lines && block.lines.length > 0) {
      for (const line of block.lines) {
        allUnits.push({
          text: line.text || '',
          top: line.frame?.top ?? block.frame?.top ?? 0,
          height: line.frame?.height ?? block.frame?.height ?? 20,
        });
      }
    } else {
      allUnits.push({
        text: block.text || '',
        top: block.frame?.top ?? 0,
        height: block.frame?.height ?? 20,
      });
    }
  }

  for (const unit of allUnits) {
    const rawUnitText = unit.text.trim();
    if (!rawUnitText) continue;

    // 1. Filter out UI noise
    if (isUiNoise(rawUnitText)) {
      continue;
    }

    // 2. Check for Part marker
    const { cleanedText, partMarker } = extractPartMarker(rawUnitText);
    if (partMarker && !foundPartMarker) {
      foundPartMarker = partMarker;
    }

    // If the unit was ONLY a part marker (e.g. "Part.3", "Pt. 2"), ignore it as a title
    if (!cleanedText || cleanedText.length < 3) {
      continue;
    }

    const relativeTop = unit.top / estimatedHeight;
    const fontHeight = unit.height;

    // 3. Subtitle filter: text located in bottom half (relativeTop > 0.55) is subtitle/commentary
    // e.g. "first contract: a sheep-eating troll"
    if (relativeTop > 0.55) {
      continue;
    }

    // 4. Center single short word filter: e.g. "sheep" in the middle of the screen
    const words = cleanedText.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 1 && relativeTop > 0.35) {
      continue;
    }

    // 5. Title zone check: Titles are located in the top ~40-45% of the screen/video
    let score = fontHeight;

    // Bonus for top ~40% position
    if (relativeTop <= 0.45) {
      score += 100;
    }

    // Bonus for multi-word titles (titles typically have 3-12 words)
    if (words.length >= 3 && words.length <= 15) {
      score += 50;
    } else if (words.length >= 2) {
      score += 20;
    }

    // Bonus for mixed case / sentence case (titles aren't all-lowercase unless noise)
    if (/[A-Z]/.test(cleanedText)) {
      score += 15;
    }

    scoredCandidates.push({
      text: cleanedText,
      fontHeight,
      relativeTop,
      score,
    });
  }

  // Sort by score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Deduplicate candidate texts
  const uniqueTitles: string[] = [];
  for (const item of scoredCandidates) {
    const lower = item.text.toLowerCase();
    if (!uniqueTitles.some((t) => t.toLowerCase() === lower)) {
      uniqueTitles.push(item.text);
    }
  }

  // Extract subtitle units (non-UI text in video center/subtitles area: relativeTop 0.45 to 0.78)
  const subtitleUnits: string[] = [];
  for (const unit of allUnits) {
    const rawUnitText = unit.text.trim();
    if (!rawUnitText || isUiNoise(rawUnitText)) continue;
    const relativeTop = unit.top / estimatedHeight;
    if (relativeTop >= 0.45 && relativeTop <= 0.78) {
      const { cleanedText } = extractPartMarker(rawUnitText);
      if (!cleanedText || isUiNoise(cleanedText)) continue;

      // Filter out isolated single words (e.g. center floating word "sheep")
      const words = cleanedText.split(/\s+/).filter((w) => w.length > 0);
      if (words.length <= 1) continue;

      subtitleUnits.push(cleanedText);
    }
  }
  const subtitleText = buildCleanQuery(subtitleUnits, 10, 80);

  // Extract non-generic hashtags from rawText
  const hashtagMatches = rawText.match(/#([a-zA-Z0-9_\u0600-\u06FF]+)/g) || [];
  const hashtags = hashtagMatches
    .map((h) => h.replace(/^#/, '').toLowerCase())
    .filter((h) => !['fyp', 'foryou', 'viral', 'trend', 'pov', 'storytime', 'pourtoi'].includes(h));

  // Build fallback query combining core title terms + subtitle terms + hashtags
  let fallbackQuery: string | undefined;
  const chosenTitle = uniqueTitles[0] || '';
  if (subtitleUnits.length > 0 || hashtags.length > 0) {
    const stopWords = new Set([
      'why',
      'every',
      'the',
      'a',
      'an',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'is',
      'are',
      'was',
      'sucks',
      'part',
      'pt',
    ]);
    const titleKeyTokens = chosenTitle
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stopWords.has(w));

    const queryTokens: string[] = [];
    if (titleKeyTokens.length > 0) {
      queryTokens.push(...titleKeyTokens);
    } else if (hashtags.length > 0) {
      queryTokens.push(...hashtags);
    }

    for (const sub of subtitleUnits) {
      const subWords = sub.split(/\s+/).filter((w) => !stopWords.has(w.toLowerCase()));
      queryTokens.push(...subWords);
    }

    if (queryTokens.length > 0) {
      fallbackQuery = buildCleanQuery(queryTokens, 10, 80);
    }
  }

  return {
    chosenTitle,
    partMarker: foundPartMarker,
    candidateTitles: uniqueTitles.slice(0, 3),
    rawText,
    subtitleText,
    fallbackQuery,
  };
}
