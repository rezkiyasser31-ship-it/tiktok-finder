/**
 * Step 1: Follow redirects for TikTok short links (vm.tiktok.com, vt.tiktok.com, tiktok.com/t/...)
 * to obtain the canonical tiktok.com/@user/video/ID URL.
 */

const TIKTOK_URL_REGEX = /https?:\/\/(?:[a-zA-Z0-9_-]+\.)?tiktok\.com\/[^\s<>"]+/i;
const CANONICAL_URL_REGEX = /^https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.-]+)\/video\/(\d+)/i;

/**
 * Extracts a TikTok URL from any text (e.g. Android share sheet text containing extra text/hashtags).
 */
export function extractUrlFromText(text: string): string | null {
  if (!text) return null;
  const match = text.match(TIKTOK_URL_REGEX);
  return match ? match[0] : null;
}

/**
 * Cleans a canonical TikTok URL by removing trailing tracking/query params.
 */
export function cleanCanonicalTikTokUrl(url: string): string | null {
  const match = url.match(CANONICAL_URL_REGEX);
  if (match) {
    const username = match[1];
    const videoId = match[2];
    return `https://www.tiktok.com/@${username}/video/${videoId}`;
  }
  return null;
}

/**
 * Resolves any TikTok link (short or full) to its canonical format.
 */
export async function resolveTikTokUrl(rawInput: string): Promise<string> {
  if (!rawInput || typeof rawInput !== 'string') {
    throw new Error('Please provide a valid TikTok URL');
  }

  // 1. Extract URL from raw text
  const extractedUrl = extractUrlFromText(rawInput.trim());
  const targetUrl = extractedUrl || rawInput.trim();

  // 2. Check if already canonical
  const alreadyCanonical = cleanCanonicalTikTokUrl(targetUrl);
  if (alreadyCanonical) {
    return alreadyCanonical;
  }

  // 3. Resolve redirect
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Check response.url first
    const finalUrl = response.url;
    const resolvedFromUrl = cleanCanonicalTikTokUrl(finalUrl);
    if (resolvedFromUrl) {
      return resolvedFromUrl;
    }

    // If response.url was not canonical, try parsing HTML for canonical link or meta tag
    const html = await response.text();
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    if (canonicalMatch && canonicalMatch[1]) {
      const canonicalFromHtml = cleanCanonicalTikTokUrl(canonicalMatch[1]);
      if (canonicalFromHtml) {
        return canonicalFromHtml;
      }
    }

    // Check og:url
    const ogMatch = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
    if (ogMatch && ogMatch[1]) {
      const canonicalFromOg = cleanCanonicalTikTokUrl(ogMatch[1]);
      if (canonicalFromOg) {
        return canonicalFromOg;
      }
    }

    // Check any video ID match inside the HTML or URL
    const videoIdMatch = html.match(/\/video\/(\d+)/i) || finalUrl.match(/\/video\/(\d+)/i);
    if (videoIdMatch) {
      const usernameMatch = html.match(/\/@([a-zA-Z0-9_.-]+)\/video\//i) || finalUrl.match(/\/@([a-zA-Z0-9_.-]+)\/video\//i);
      const username = usernameMatch ? usernameMatch[1] : 'video';
      return `https://www.tiktok.com/@${username}/video/${videoIdMatch[1]}`;
    }

    throw new Error('Could not determine canonical TikTok video URL from response');
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('TikTok URL resolution timed out. Please check your internet connection.');
    }
    throw new Error(`Failed to resolve TikTok URL: ${err.message || err}`);
  }
}
