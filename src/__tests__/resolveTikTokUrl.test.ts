import {
  extractUrlFromText,
  cleanCanonicalTikTokUrl,
} from '../core/resolveTikTokUrl';
import { parseIsoDuration, formatDuration, normalizeQuery } from '../core/searchYouTube';

describe('resolveTikTokUrl and searchYouTube utilities', () => {
  describe('extractUrlFromText', () => {
    test('extracts TikTok URL from raw shared Android intent text', () => {
      const sharedText = 'Check out this funny video! https://vm.tiktok.com/ZM8N69V5X/ #funny';
      expect(extractUrlFromText(sharedText)).toBe('https://vm.tiktok.com/ZM8N69V5X/');
    });

    test('extracts vt.tiktok.com URL', () => {
      const shared = 'Watch this: https://vt.tiktok.com/ZS2xY9AbC/';
      expect(extractUrlFromText(shared)).toBe('https://vt.tiktok.com/ZS2xY9AbC/');
    });

    test('extracts standard desktop URL', () => {
      const shared = 'https://www.tiktok.com/@creator/video/7123456789012345678';
      expect(extractUrlFromText(shared)).toBe('https://www.tiktok.com/@creator/video/7123456789012345678');
    });

    test('returns null for text without TikTok URL', () => {
      expect(extractUrlFromText('hello world no link')).toBeNull();
    });
  });

  describe('cleanCanonicalTikTokUrl', () => {
    test('strips tracking query parameters from canonical URL', () => {
      const dirty = 'https://www.tiktok.com/@mrbeast/video/7123456789012345678?is_from_webapp=1&sender_device=pc';
      expect(cleanCanonicalTikTokUrl(dirty)).toBe('https://www.tiktok.com/@mrbeast/video/7123456789012345678');
    });

    test('returns null for non-canonical format', () => {
      expect(cleanCanonicalTikTokUrl('https://vm.tiktok.com/ZM8N69V5X/')).toBeNull();
    });
  });

  describe('YouTube duration parsing and formatting', () => {
    test('parses ISO 8601 durations to seconds', () => {
      expect(parseIsoDuration('PT1H2M30S')).toBe(3750);
      expect(parseIsoDuration('PT18M42S')).toBe(1122);
      expect(parseIsoDuration('PT45S')).toBe(45);
      expect(parseIsoDuration('PT5M')).toBe(300);
      expect(parseIsoDuration('PT1H')).toBe(3600);
      expect(parseIsoDuration('')).toBe(0);
    });

    test('formats seconds to human-readable strings', () => {
      expect(formatDuration(3750)).toBe('1:02:30');
      expect(formatDuration(1122)).toBe('18:42');
      expect(formatDuration(45)).toBe('0:45');
      expect(formatDuration(0)).toBe('0:00');
    });

    test('normalizes query string', () => {
      expect(normalizeQuery('  Family   Guy  funniest   moments  ')).toBe('family guy funniest moments');
    });
  });
});
