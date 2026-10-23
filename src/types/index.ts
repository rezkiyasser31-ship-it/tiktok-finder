export interface TikTokMeta {
  canonicalUrl: string;
  caption: string;
  authorName: string;
  thumbnailUrl: string;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle: string;
  duration: string; // e.g. "PT18M42S" or "18:42"
  durationSeconds: number;
  thumbnailUrl: string;
  url: string;
}

export interface RankedYouTubeVideo extends YouTubeVideo {
  confidence: number; // 0 to 1
  matchReasons: string[];
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  inputUrl?: string;
  inputType: 'url' | 'image' | 'manual';
  tiktokMeta?: TikTokMeta;
  detectedQueries: string[];
  topResult?: RankedYouTubeVideo;
  allResults: RankedYouTubeVideo[];
}

export interface OcrFrame {
  width: number;
  height: number;
  top: number;
  left: number;
}

export interface OcrLine {
  text: string;
  frame?: OcrFrame;
}

export interface OcrBlock {
  text: string;
  frame?: OcrFrame;
  lines?: OcrLine[];
}

export interface OcrRecognitionResult {
  text: string;
  blocks: OcrBlock[];
}

export interface SmartTitleResult {
  chosenTitle: string;
  partMarker?: string;
  candidateTitles: string[];
  rawText: string;
  subtitleText?: string;
  fallbackQuery?: string;
}

export class YouTubeQuotaExceededError extends Error {
  constructor(message = 'YouTube API quota exceeded. Please try again later or provide a custom API key.') {
    super(message);
    this.name = 'YouTubeQuotaExceededError';
  }
}

export class MissingYouTubeApiKeyError extends Error {
  constructor(message = 'YouTube API key is missing. Set EXPO_PUBLIC_YOUTUBE_API_KEY in your .env file.') {
    super(message);
    this.name = 'MissingYouTubeApiKeyError';
  }
}
