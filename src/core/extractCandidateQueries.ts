/**
 * Step 3: Extract and clean TikTok caption (and optional OCR text)
 * into 1-3 ranked YouTube search queries.
 *
 * Handles English, French, and Arabic captions, stripping hashtags,
 * @mentions, emojis, part markers, and viral noise.
 */

// Emojis and miscellaneous symbols
const EMOJI_REGEX =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}\u{200D}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu;

// Mentions like @username
const MENTION_REGEX = /@[a-zA-Z0-9_.-]+/g;

// Hashtags in English, French, Arabic, and viral suffixes (including Japanese katakana e.g. #fypシ)
const HASHTAG_REGEX =
  /#[a-zA-Z0-9_\u00C0-\u024F\u0600-\u06FF\u0750-\u077F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]+/gu;

// Generic viral/noise hashtags that convey zero content signal
const GENERIC_HASHTAGS = new Set([
  'fyp',
  'foryou',
  'foryoupage',
  'viral',
  'trending',
  'trend',
  'tiktok',
  'repost',
  'xyzbca',
  'pov',
  'storytime',
  'capcut',
  'pourtoi',
  'prt',
  'tendance',
  'explore',
  'اكسبلور',
  'ترند',
  'تيك_توك',
  'مشاهير',
  'لايك',
  'فولو',
]);

// Part markers in English, French, Arabic, Spanish:
// e.g. "part 2", "pt.3", "p4", "partie 2", "parte 2", "الجزء 2", "جزء 3", "ج2", "بارت 1"
// Also bracketed/parenthesized fractions/numbers like [2/5], (2), (part 2), pt 2/5
const PART_PATTERNS: RegExp[] = [
  // Bracketed / parenthesized part markers or numbers: [part 2], (pt. 3), (2/5), [2/5], (2), [2]
  /[\[\(\{\<](?:part|partie|parte|pt|p|جزء|الجزء|بارت)?\.?\s*[\d٠-٩]+(?:\s*\/\s*[\d٠-٩]+)?\s*[\]\)\}\>]/gi,

  // Standalone fractions like 2/5, 3/4
  /\b[\d٠-٩]+\s*\/\s*[\d٠-٩]+\b/g,

  // English / French: part 2, pt. 2, pt2, p4, p.2, ep 2, ep. 2
  /\b(?:part|pt|p|ep)\.?\s*[\d٠-٩]+\b/gi,

  // French: partie 2
  /\b(?:partie)\.?\s*[\d٠-٩]+/gi,

  // Spanish: parte 2
  /\b(?:parte)\.?\s*[\d٠-٩]+/gi,

  // Arabic: الجزء 2, جزء 2, بارت 2
  /(?:الجزء|جزء|بارت)\s*[\d٠-٩]+/gu,

  // Arabic single-letter part abbreviation: ج2, ج 3 (using Unicode punctuation/space boundaries)
  /(?:^|[\s\p{P}])ج\s*[\d٠-٩]+(?=$|[\s\p{P}])/gu,
];

// Viral / FYP noise words (English, French, Arabic)
const VIRAL_NOISE_PATTERNS: RegExp[] = [
  // English viral tokens (including fypシ, fypツ)
  /\b(?:fyp(?:[シツy])?|for\s*you(?:page)?|foryou|viral|trending|trend|tiktok|repost|wait\s+for\s+it|watch\s+till\s+end|blow\s+this\s+up|xyzbca|pov|storytime)\b/gi,

  // French viral tokens
  /\b(?:pour\s*toi|pourtoi|prt|tendance|explore)\b/gi,

  // Arabic viral tokens
  /(?:اكسبلور_فولو|اكسبلور|ترند_تيك_توك|ترند|تيك_توك|تيك\s*توك|فولو|لايك|مشاهير)/gu,
];

/**
 * Extracts meaningful non-generic hashtags from a caption.
 * e.g. "#witcher #witcher3 #pov #storytime" -> ["witcher3", "witcher"]
 */
export function extractMeaningfulHashtags(rawCaption: string): string[] {
  if (!rawCaption) return [];
  const matches = rawCaption.match(HASHTAG_REGEX) || [];
  const results: string[] = [];

  for (const m of matches) {
    const tag = m.replace(/^#/, '').toLowerCase();
    if (!GENERIC_HASHTAGS.has(tag) && tag.length >= 3) {
      if (!results.includes(tag)) {
        results.push(tag);
      }
    }
  }

  return results;
}

/**
 * Strips noise, emojis, hashtags, mentions, part markers, and viral words from raw text.
 */
export function cleanCaptionText(rawText: string): string {
  if (!rawText) return '';

  let text = rawText;

  // 1. Remove URLs if any
  text = text.replace(/https?:\/\/\S+/gi, ' ');

  // 2. Remove emojis
  text = text.replace(EMOJI_REGEX, ' ');

  // 3. Remove hashtags
  text = text.replace(HASHTAG_REGEX, ' ');

  // 4. Remove mentions
  text = text.replace(MENTION_REGEX, ' ');

  // 5. Remove part markers
  for (const pattern of PART_PATTERNS) {
    text = text.replace(pattern, ' ');
  }

  // 6. Remove viral noise tokens
  for (const pattern of VIRAL_NOISE_PATTERNS) {
    text = text.replace(pattern, ' ');
  }

  // 7. Strip leftover stray Japanese viral characters if detached (e.g. standalone 'シ' or 'ツ')
  text = text.replace(/[\u30B7\u30C4]/g, ' ');

  // 8. Clean up exclamation marks, question marks, brackets, and quotes that were around stripped parts
  text = text
    .replace(/[!?]+/g, ' ')
    .replace(/[\[\]\(\)\{\}\<\>]+/g, ' ')
    .replace(/\s+[-–—:|~]+\s+/g, ' ')
    .replace(/^[-–—:|~,.\s]+/g, '')
    .replace(/[-–—:|~,.\s]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return text;
}

/**
 * Cleans raw OCR text extracted from thumbnails or screenshots.
 */
export function cleanOcrText(rawOcr: string): string {
  if (!rawOcr) return '';

  // Filter out typical TikTok UI overlay text
  const UI_OVERLAYS = /\b(?:tiktok|follow|share|like|comment|repost|original sound|live|audio|search|add comment)\b/gi;

  let text = cleanCaptionText(rawOcr);
  text = text.replace(UI_OVERLAYS, ' ');

  // Remove timestamp patterns (e.g. 00:15 / 1:30)
  text = text.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ');

  return text.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Extracts 1-3 ranked candidate YouTube search queries from a TikTok caption and optional OCR text.
 * NEVER returns junk or generic viral queries when caption is empty or hashtag-only.
 */
export function extractCandidateQueries(caption: string, ocrText?: string): string[] {
  const cleanedCaption = cleanCaptionText(caption);
  const cleanedOcr = ocrText ? cleanOcrText(ocrText) : '';
  const meaningfulHashtags = extractMeaningfulHashtags(caption);

  const candidates: string[] = [];

  // Helper to add unique queries
  const addCandidate = (q: string) => {
    const trimmed = q.replace(/\s+/g, ' ').trim();
    if (trimmed.length >= 2) {
      const lower = trimmed.toLowerCase();
      if (!candidates.some((c) => c.toLowerCase() === lower)) {
        candidates.push(trimmed);
      }
    }
  };

  // Case A: Strong OCR text is available
  if (cleanedOcr && cleanedOcr.length >= 3) {
    addCandidate(cleanedOcr);

    // If meaningful hashtags exist, add an augmented candidate (e.g. "Why Every Witcher School Sucks witcher3")
    if (meaningfulHashtags.length > 0) {
      for (const tag of meaningfulHashtags.slice(0, 2)) {
        if (!cleanedOcr.toLowerCase().includes(tag.toLowerCase())) {
          addCandidate(`${cleanedOcr} ${tag}`);
        }
      }
    }

    if (cleanedCaption && !cleanedCaption.toLowerCase().includes(cleanedOcr.toLowerCase())) {
      addCandidate(`${cleanedOcr} ${cleanedCaption}`);
    }
  }

  // Case B: Meaningful caption text exists
  if (cleanedCaption && cleanedCaption.length >= 3) {
    addCandidate(cleanedCaption);

    // If meaningful hashtags exist, append top tag as secondary query
    if (meaningfulHashtags.length > 0) {
      const topTag = meaningfulHashtags[0];
      if (!cleanedCaption.toLowerCase().includes(topTag.toLowerCase())) {
        addCandidate(`${cleanedCaption} ${topTag}`);
      }
    }

    // Quoted title extraction
    const quoteMatch = caption.match(/["'«“]([^"'»”]{3,60})["'»”]/);
    if (quoteMatch && quoteMatch[1]) {
      const cleanedQuote = cleanCaptionText(quoteMatch[1]);
      if (cleanedQuote && cleanedQuote.length >= 3) {
        addCandidate(cleanedQuote);
      }
    }

    // Split on separators like dash or colon
    const splitParts = cleanedCaption.split(/\s*[-–—:|]\s*/).filter((p) => p.trim().length >= 3);
    if (splitParts.length > 1) {
      addCandidate(splitParts[0]);
      addCandidate(`${splitParts[0]} ${splitParts[1]}`);
    }
  }

  // If NO meaningful title could be derived, DO NOT emit generic fallback like "TikTok viral video"!
  // Return empty array so the pipeline and UI know to prompt the user for a screenshot or title.
  return candidates.slice(0, 3);
}
