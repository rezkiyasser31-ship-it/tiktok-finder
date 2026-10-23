/**
 * Step 5: Rank YouTube video candidates against TikTok candidate queries.
 *
 * Scoring criteria:
 * 1. Fuzzy title similarity (Token-Set Ratio) between video title and queries.
 * 2. Key query tokens containment in video title / channel.
 * 3. Duration bonus: videos >= 8 minutes (+0.10 to +0.20), penalty for <60s shorts.
 *
 * Returns top 3 videos with confidence score 0.00 - 1.00 and explainable match reasons.
 */

import { YouTubeVideo, RankedYouTubeVideo } from '../types';

/**
 * Standard Levenshtein distance calculation.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // Use two rows for memory efficiency
  let prevRow = new Array(n + 1);
  let currRow = new Array(n + 1);

  for (let j = 0; j <= n; j++) prevRow[j] = j;

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    const char1 = s1.charCodeAt(i - 1);

    for (let j = 1; j <= n; j++) {
      const char2 = s2.charCodeAt(j - 1);
      const cost = char1 === char2 ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1, // insertion
        prevRow[j] + 1, // deletion
        prevRow[j - 1] + cost // substitution
      );
    }

    // Swap rows
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[n];
}

/**
 * Levenshtein similarity ratio between 0 and 1.
 */
export function similarityRatio(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, (s1.length + s2.length - 2 * dist) / (s1.length + s2.length));
}

/**
 * Tokenizes text into lowercase word tokens, supporting multilingual Latin, Arabic, and French accents.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  return normalized.split(/\s+/).filter(Boolean);
}

/**
 * Token-Set Ratio:
 * Extracts intersection and differences between two token sets,
 * computing maximum similarity among reconstructed token strings.
 */
export function tokenSetRatio(s1: string, s2: string): number {
  const t1 = tokenize(s1);
  const t2 = tokenize(s2);

  if (t1.length === 0 || t2.length === 0) return 0.0;

  const set1 = new Set(t1);
  const set2 = new Set(t2);

  const intersection: string[] = [];
  const diff1: string[] = [];
  const diff2: string[] = [];

  for (const token of set1) {
    if (set2.has(token)) {
      intersection.push(token);
    } else {
      diff1.push(token);
    }
  }

  for (const token of set2) {
    if (!set1.has(token)) {
      diff2.push(token);
    }
  }

  intersection.sort();
  diff1.sort();
  diff2.sort();

  const strInter = intersection.join(' ');
  const strInterDiff1 = [...intersection, ...diff1].join(' ');
  const strInterDiff2 = [...intersection, ...diff2].join(' ');

  if (!strInter) {
    return similarityRatio(t1.sort().join(' '), t2.sort().join(' '));
  }

  const r1 = similarityRatio(strInter, strInterDiff1);
  const r2 = similarityRatio(strInter, strInterDiff2);
  const r3 = similarityRatio(strInterDiff1, strInterDiff2);

  return Math.max(r1, r2, r3);
}

const COMMON_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'de', 'la', 'le', 'et', 'en', 'un', 'une', 'du', 'des', 'les', 'pour',
  'في', 'من', 'على', 'عن', 'مع', 'هذا', 'هذه', 'إلى', 'ان', 'أن', 'او', 'أو'
]);

/**
 * Calculates key query tokens match ratio in candidate title.
 */
export function calculateKeyTokenMatch(title: string, query: string): { ratio: number; matchedTokens: string[] } {
  const titleTokens = new Set(tokenize(title));
  const queryTokens = tokenize(query).filter(
    (tok) => tok.length >= 2 && !COMMON_STOPWORDS.has(tok)
  );

  if (queryTokens.length === 0) {
    return { ratio: 0, matchedTokens: [] };
  }

  const matchedTokens: string[] = [];
  for (const tok of queryTokens) {
    if (titleTokens.has(tok)) {
      matchedTokens.push(tok);
    }
  }

  const ratio = matchedTokens.length / queryTokens.length;
  return { ratio, matchedTokens };
}

/**
 * Calculates duration bonus/penalty based on length.
 * TikTok parts are typically segments of full-length videos (>8 minutes).
 */
export function calculateDurationScore(durationSeconds: number): { score: number; reason?: string } {
  if (durationSeconds <= 0) {
    return { score: 0 };
  }

  // Penalty for shorts (< 60s)
  if (durationSeconds < 60) {
    return { score: -0.15, reason: 'Short clip (<1 min, unlikely original source)' };
  }

  // > 20 minutes (full show / movie / documentary)
  if (durationSeconds >= 1200) {
    return { score: 0.20, reason: 'Full-length video (>20 min)' };
  }

  // >= 8 minutes (standard YouTube video sliced into parts)
  if (durationSeconds >= 480) {
    // Scales linearly between 0.10 and 0.20
    const normalized = (durationSeconds - 480) / (1200 - 480);
    const score = 0.10 + normalized * 0.10;
    return { score, reason: 'Long video (>8 min, typical part source)' };
  }

  // 4 - 8 minutes
  if (durationSeconds >= 240) {
    return { score: 0.05, reason: 'Medium video (>4 min)' };
  }

  return { score: 0 };
}

/**
 * Ranks candidate YouTube videos against the candidate queries.
 * Returns the top 3 videos with confidence scores (0.00 to 1.00).
 */
export function rankResults(
  candidates: YouTubeVideo[],
  queries: string[],
  topCount: number = 3
): RankedYouTubeVideo[] {
  if (!candidates || candidates.length === 0) return [];
  if (!queries || queries.length === 0) {
    return candidates.slice(0, topCount).map((v) => ({
      ...v,
      confidence: 0.5,
      matchReasons: ['Candidate found without specific query'],
    }));
  }

  const ranked = candidates.map((video) => {
    let maxFuzzyScore = 0;
    let bestQuery = queries[0];
    let bestKeyTokensMatch = { ratio: 0, matchedTokens: [] as string[] };

    for (const q of queries) {
      const fuzzy = tokenSetRatio(video.title, q);
      const keyMatch = calculateKeyTokenMatch(video.title, q);

      if (fuzzy > maxFuzzyScore) {
        maxFuzzyScore = fuzzy;
        bestQuery = q;
        bestKeyTokensMatch = keyMatch;
      }
    }

    const { score: durationBonus, reason: durationReason } = calculateDurationScore(
      video.durationSeconds
    );

    // Weighted composite confidence
    // Fuzzy title score: 55%
    // Key token overlap: 25%
    // Duration bonus: up to 20%
    let confidence =
      maxFuzzyScore * 0.55 + bestKeyTokensMatch.ratio * 0.25 + durationBonus;

    // Direct channel title match bonus (if channel title matches query tokens)
    if (video.channelTitle) {
      const channelFuzzy = tokenSetRatio(video.channelTitle, bestQuery);
      if (channelFuzzy > 0.7) {
        confidence += 0.08;
      }
    }

    // Clamp between 0.05 and 1.00
    confidence = Math.max(0.05, Math.min(0.99, confidence));
    confidence = Math.round(confidence * 100) / 100;

    // Explainable match reasons
    const matchReasons: string[] = [];
    if (maxFuzzyScore >= 0.75) {
      matchReasons.push(`High title similarity (${Math.round(maxFuzzyScore * 100)}%)`);
    } else if (maxFuzzyScore >= 0.45) {
      matchReasons.push(`Moderate title similarity (${Math.round(maxFuzzyScore * 100)}%)`);
    }

    if (bestKeyTokensMatch.matchedTokens.length > 0) {
      const tokenList = bestKeyTokensMatch.matchedTokens.slice(0, 3).join(', ');
      matchReasons.push(`Matched key terms: ${tokenList}`);
    }

    if (durationReason) {
      matchReasons.push(durationReason);
    }

    return {
      ...video,
      confidence,
      matchReasons,
    };
  });

  // Sort by confidence descending, then by duration descending
  ranked.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return b.durationSeconds - a.durationSeconds;
  });

  return ranked.slice(0, topCount);
}
