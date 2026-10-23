/**
 * Step 2: Fetch TikTok metadata using TikTok's public oEmbed endpoint.
 * Does not require any API key.
 */

import { TikTokMeta } from '../types';

interface TikTokOEmbedResponse {
  title?: string;
  author_name?: string;
  author_unique_id?: string;
  thumbnail_url?: string;
  html?: string;
  status_msg?: string;
}

export async function fetchTikTokMeta(canonicalUrl: string): Promise<TikTokMeta> {
  if (!canonicalUrl) {
    throw new Error('A TikTok URL is required to fetch metadata');
  }

  const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(canonicalUrl)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.status === 404) {
      throw new Error('TikTok video not found. It may be private or removed.');
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch TikTok details (HTTP ${response.status})`);
    }

    const data: TikTokOEmbedResponse = await response.json();

    if (data.status_msg && !data.title) {
      throw new Error(`TikTok oEmbed error: ${data.status_msg}`);
    }

    const caption = (data.title || '').trim();
    const authorName = (data.author_name || data.author_unique_id || '').trim();
    const thumbnailUrl = (data.thumbnail_url || '').trim();

    return {
      canonicalUrl,
      caption,
      authorName,
      thumbnailUrl,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('TikTok metadata request timed out.');
    }
    throw new Error(err.message || 'Failed to fetch TikTok metadata');
  }
}
