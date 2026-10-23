import * as Linking from 'expo-linking';

/**
 * Opens a YouTube video, attempting to use the native YouTube app first,
 * falling back to browser if not installed.
 */
export async function openYouTubeVideo(videoId: string): Promise<void> {
  if (!videoId) return;

  const appSchemeUrl = `vnd.youtube://${videoId}`;
  const webUrl = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const canOpen = await Linking.canOpenURL(appSchemeUrl);
    if (canOpen) {
      await Linking.openURL(appSchemeUrl);
      return;
    }
  } catch {
    // ignore app scheme failure and fall back to web
  }

  await Linking.openURL(webUrl);
}

/**
 * Opens YouTube search page for a query.
 */
export async function openYouTubeSearch(query: string): Promise<void> {
  if (!query) return;
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  await Linking.openURL(searchUrl);
}
