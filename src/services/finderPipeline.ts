/**
 * Orchestrator for TikTok Finder pipeline.
 * Connects all 6 core pipeline steps and exposes step-by-step progress callbacks.
 */

import {
  resolveTikTokUrl,
  fetchTikTokMeta,
  extractCandidateQueries,
  searchTikTokOnYouTube,
  searchYouTube,
  rankResults,
  recognizeThumbnailText,
  recognizeImageText,
  pickTitleFromOcrBlocks,
} from '../core';
import { TikTokMeta, RankedYouTubeVideo, OcrBlock } from '../types';

export type PipelineStage =
  | 'idle'
  | 'resolving_url'
  | 'fetching_meta'
  | 'running_ocr'
  | 'extracting_queries'
  | 'searching_youtube'
  | 'ranking_results'
  | 'completed'
  | 'error';

export interface PipelineProgress {
  stage: PipelineStage;
  message: string;
}

export interface PipelineResult {
  tiktokMeta?: TikTokMeta;
  ocrText?: string;
  ocrBlocks?: OcrBlock[];
  rawOcrText?: string;
  partMarker?: string;
  detectedQueries: string[];
  activeQuery: string;
  rankedVideos: RankedYouTubeVideo[];
  needsManualTitle?: boolean;
  manualTitleReason?: string;
}

/**
 * Runs the full end-to-end pipeline from a TikTok URL or shared text.
 */
export async function runTikTokFinderPipeline(
  rawInput: string,
  onProgress?: (progress: PipelineProgress) => void
): Promise<PipelineResult> {
  const update = (stage: PipelineStage, message: string) => {
    onProgress?.({ stage, message });
  };

  // Step 1: Resolve short link
  update('resolving_url', 'Resolving TikTok link...');
  const canonicalUrl = await resolveTikTokUrl(rawInput);

  // Step 2: Fetch oEmbed metadata
  update('fetching_meta', 'Fetching TikTok details...');
  const meta = await fetchTikTokMeta(canonicalUrl);

  // Step 3: OCR on thumbnail fallback
  update('running_ocr', 'Scanning thumbnail for on-screen text...');
  let ocrTitle = '';
  let partMarker: string | undefined;
  let rawOcrText = '';
  let ocrBlocks: OcrBlock[] = [];

  if (meta.thumbnailUrl) {
    try {
      const ocrResult = await recognizeThumbnailText(meta.thumbnailUrl);
      if (ocrResult && ocrResult.blocks && ocrResult.blocks.length > 0) {
        const smart = pickTitleFromOcrBlocks(ocrResult);
        ocrTitle = smart.chosenTitle;
        partMarker = smart.partMarker;
        rawOcrText = smart.rawText;
        ocrBlocks = ocrResult.blocks;
      }
    } catch {
      // Thumbnail OCR is an optional fallback
    }
  }

  // Step 4: Extract candidate queries
  update('extracting_queries', 'Analyzing caption and titles...');
  const queries = extractCandidateQueries(meta.caption, ocrTitle);

  // EMPTY-CAPTION HANDLING:
  // If no meaningful title was in the caption and thumbnail had no title,
  // do NOT search YouTube with junk! Prompt the user for screenshot / manual input.
  if (queries.length === 0) {
    update('completed', 'No title in caption');
    return {
      tiktokMeta: meta,
      ocrText: ocrTitle,
      ocrBlocks,
      rawOcrText,
      partMarker,
      detectedQueries: [],
      activeQuery: '',
      rankedVideos: [],
      needsManualTitle: true,
      manualTitleReason: 'No title in the caption. Share a screenshot of the video, or type the title.',
    };
  }

  const activeQuery = queries[0];

  // Step 5: Search YouTube (max 2 searches per TikTok)
  update('searching_youtube', `Searching YouTube for "${activeQuery}"...`);
  const candidates = await searchTikTokOnYouTube(queries);

  // Step 6: Rank matches
  update('ranking_results', 'Ranking best matching YouTube videos...');
  const rankedVideos = rankResults(candidates, queries, 6);

  update('completed', 'Done!');

  return {
    tiktokMeta: meta,
    ocrText: ocrTitle,
    ocrBlocks,
    rawOcrText,
    partMarker,
    detectedQueries: queries,
    activeQuery,
    rankedVideos,
  };
}

/**
 * Runs the pipeline for a shared screenshot or image from the share sheet / gallery.
 */
export async function runImageFinderPipeline(
  imageUri: string,
  onProgress?: (progress: PipelineProgress) => void
): Promise<PipelineResult> {
  const update = (stage: PipelineStage, message: string) => {
    onProgress?.({ stage, message });
  };

  // Step 1: Run OCR on the shared image
  update('running_ocr', 'Scanning screenshot with on-device ML Kit OCR...');
  const ocrResult = await recognizeImageText(imageUri);

  if (!ocrResult || (!ocrResult.text && ocrResult.blocks.length === 0)) {
    throw new Error('No readable text recognized in image. Please ensure the video title is clearly visible.');
  }

  // Step 2: Smart title picking from OCR blocks
  update('extracting_queries', 'Extracting video title from on-screen text...');
  const smart = pickTitleFromOcrBlocks(ocrResult);
  console.log(
    '[OCR] Smart picker result:',
    JSON.stringify({
      chosenTitle: smart.chosenTitle,
      partMarker: smart.partMarker,
      subtitleText: smart.subtitleText,
      fallbackQuery: smart.fallbackQuery,
    })
  );

  if (!smart.chosenTitle && smart.candidateTitles.length === 0) {
    return {
      rawOcrText: smart.rawText,
      ocrBlocks: ocrResult.blocks,
      partMarker: smart.partMarker,
      detectedQueries: [],
      activeQuery: '',
      rankedVideos: [],
      needsManualTitle: true,
      manualTitleReason:
        'Found on-screen text but could not detect a title. Please type the title or pick a clearer screenshot.',
    };
  }

  const queries = smart.candidateTitles.length > 0 ? smart.candidateTitles : [smart.chosenTitle];
  const activeQuery = queries[0];

  // Step 3: Search YouTube
  update('searching_youtube', `Searching YouTube for "${activeQuery}"...`);
  const candidates = await searchTikTokOnYouTube(queries, smart.fallbackQuery);

  // Step 4: Rank matches
  update('ranking_results', 'Ranking best matching YouTube videos...');
  const allEvaluationQueries = [...queries];
  if (smart.fallbackQuery && !allEvaluationQueries.includes(smart.fallbackQuery)) {
    allEvaluationQueries.push(smart.fallbackQuery);
  }
  const rankedVideos = rankResults(candidates, allEvaluationQueries, 6);

  update('completed', 'Done!');

  return {
    ocrText: smart.chosenTitle,
    ocrBlocks: ocrResult.blocks,
    rawOcrText: smart.rawText,
    partMarker: smart.partMarker,
    detectedQueries: smart.fallbackQuery ? [...queries, smart.fallbackQuery] : queries,
    activeQuery,
    rankedVideos,
  };
}

/**
 * Re-runs search when the user edits the active query in the result view.
 */
export async function rerunQuerySearch(
  customQuery: string,
  originalQueries: string[] = []
): Promise<RankedYouTubeVideo[]> {
  const cleaned = customQuery.trim();
  if (!cleaned) {
    throw new Error('Search query cannot be empty.');
  }

  const searchResults = await searchYouTube(cleaned, { maxResults: 10 });
  const evaluationQueries = [cleaned, ...originalQueries.filter((q) => q !== cleaned)];
  return rankResults(searchResults, evaluationQueries, 6);
}
