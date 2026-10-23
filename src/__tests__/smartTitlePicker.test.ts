/**
 * Unit tests for smartTitlePicker.ts
 */

import {
  pickTitleFromOcrBlocks,
  isUiNoise,
  extractPartMarker,
  buildCleanQuery,
} from '../core/smartTitlePicker';
import { OcrRecognitionResult } from '../types';

describe('smartTitlePicker', () => {
  describe('isUiNoise', () => {
    it('detects metric and count strings as noise', () => {
      expect(isUiNoise('11.8K')).toBe(true);
      expect(isUiNoise('54')).toBe(true);
      expect(isUiNoise('1,475')).toBe(true);
      expect(isUiNoise('93')).toBe(true);
      expect(isUiNoise('2.4M')).toBe(true);
    });

    it('detects username strings as noise', () => {
      expect(isUiNoise('@ali_jutty687')).toBe(true);
      expect(isUiNoise('ali_jutty687')).toBe(true);
    });

    it('detects common TikTok UI strings as noise', () => {
      expect(isUiNoise('Find related content')).toBe(true);
      expect(isUiNoise('Search')).toBe(true);
      expect(isUiNoise('Add comment...')).toBe(true);
      expect(isUiNoise('Follow')).toBe(true);
      expect(isUiNoise('Share')).toBe(true);
      expect(isUiNoise('1d ago')).toBe(true);
    });

    it('detects hashtag-only strings as noise', () => {
      expect(isUiNoise('#witcher #witcher3 #pov #storytime')).toBe(true);
    });

    it('does not classify genuine video titles as noise', () => {
      expect(isUiNoise('Why Every Witcher School Sucks')).toBe(false);
      expect(isUiNoise('The History of Rome Episode 1')).toBe(false);
    });
  });

  describe('extractPartMarker', () => {
    it('isolates Part.3 and returns cleaned text', () => {
      const res = extractPartMarker('Part.3');
      expect(res.partMarker).toBe('Part.3');
      expect(res.cleanedText).toBe('');
    });

    it('isolates part marker attached to title', () => {
      const res = extractPartMarker('Why Every Witcher School Sucks Part 3');
      expect(res.partMarker).toBe('Part 3');
      expect(res.cleanedText).toBe('Why Every Witcher School Sucks');
    });

    it('handles Arabic part marker', () => {
      const res = extractPartMarker('قصة تاريخية الجزء 2');
      expect(res.partMarker).toBe('الجزء 2');
      expect(res.cleanedText).toBe('قصة تاريخية');
    });
  });

  describe('Real-World Test Case: Witcher Screenshot OCR', () => {
    it('correctly picks "Why Every Witcher School Sucks" and excludes Part.3, sheep, subtitles, and UI noise', () => {
      const screenHeight = 2340;
      const screenWidth = 1080;

      const mockOcrResult: OcrRecognitionResult = {
        text: `Find related content
Search
Why Every Witcher School Sucks
Part.3
sheep
first contract: a sheep-eating troll
ali_jutty687
11.8K
54
1,475
93
Add comment...`,
        blocks: [
          {
            text: 'Find related content',
            frame: { left: 40, top: 80, width: 350, height: 35 },
          },
          {
            text: 'Search',
            frame: { left: 950, top: 80, width: 80, height: 35 },
          },
          {
            text: 'Why Every Witcher School Sucks',
            frame: { left: 100, top: 320, width: 880, height: 95 },
            lines: [
              {
                text: 'Why Every Witcher School Sucks',
                frame: { left: 100, top: 320, width: 880, height: 95 },
              },
            ],
          },
          {
            text: 'Part.3',
            frame: { left: 440, top: 480, width: 200, height: 50 },
            lines: [
              {
                text: 'Part.3',
                frame: { left: 440, top: 480, width: 200, height: 50 },
              },
            ],
          },
          {
            text: 'sheep',
            frame: { left: 480, top: 1100, width: 120, height: 45 },
            lines: [
              {
                text: 'sheep',
                frame: { left: 480, top: 1100, width: 120, height: 45 },
              },
            ],
          },
          {
            text: 'first contract: a sheep-eating troll',
            frame: { left: 150, top: 1650, width: 780, height: 40 },
            lines: [
              {
                text: 'first contract: a sheep-eating troll',
                frame: { left: 150, top: 1650, width: 780, height: 40 },
              },
            ],
          },
          {
            text: 'ali_jutty687',
            frame: { left: 50, top: 1950, width: 250, height: 30 },
          },
          {
            text: '11.8K',
            frame: { left: 980, top: 1200, width: 60, height: 30 },
          },
          {
            text: '54',
            frame: { left: 980, top: 1320, width: 30, height: 25 },
          },
          {
            text: '1,475',
            frame: { left: 980, top: 1440, width: 55, height: 28 },
          },
          {
            text: '93',
            frame: { left: 980, top: 1560, width: 30, height: 25 },
          },
          {
            text: 'Add comment...',
            frame: { left: 50, top: 2200, width: 400, height: 40 },
          },
        ],
      };

      const result = pickTitleFromOcrBlocks(mockOcrResult, {
        width: screenWidth,
        height: screenHeight,
      });

      expect(result.chosenTitle).toBe('Why Every Witcher School Sucks');
      expect(result.partMarker).toBe('Part.3');
      expect(result.candidateTitles).toContain('Why Every Witcher School Sucks');
      expect(result.candidateTitles).not.toContain('Part.3');
      expect(result.candidateTitles).not.toContain('sheep');
      expect(result.candidateTitles).not.toContain('first contract: a sheep-eating troll');
      expect(result.candidateTitles).not.toContain('Find related content');
      expect(result.candidateTitles).not.toContain('11.8K');

      // Verify secondary fallback query has no stray semicolons, no mid-word truncation, and excludes noise
      expect(result.fallbackQuery).toBe('witcher school first contract sheep eating troll');
      expect(result.fallbackQuery).not.toContain(';');
      expect(result.fallbackQuery).not.toContain(':');
      expect(result.fallbackQuery).not.toMatch(/\btrol\b/);
      expect(result.fallbackQuery).not.toMatch(/\bsheep\s+first\b/);
    });

    it('falls back cleanly when blocks are missing', () => {
      const mockResult: OcrRecognitionResult = {
        text: 'Why Every Witcher School Sucks Part.3\n11.8K\nSearch',
        blocks: [],
      };

      const result = pickTitleFromOcrBlocks(mockResult);
      expect(result.chosenTitle).toBe('Why Every Witcher School Sucks');
      expect(result.partMarker).toBe('Part.3');
    });
  });

  describe('buildCleanQuery', () => {
    it('strips stray semicolons, colons, hyphens and other punctuation', () => {
      const tokens = ['witcher; school:', 'first contract;', 'a sheep-eating', 'troll!'];
      const query = buildCleanQuery(tokens, 10, 80);
      expect(query).toBe('witcher school first contract a sheep eating troll');
      expect(query).not.toContain(';');
      expect(query).not.toContain(':');
      expect(query).not.toContain('!');
    });

    it('caps by whole words and never truncates mid-word', () => {
      // 5 whole words: "alpha beta gamma delta epsilon" = 30 chars
      // If char cap is 20, "alpha beta gamma" (16 chars) fits, but "delta" (22 chars) exceeds 20.
      // Must NOT truncate "delta" to "del" or "d".
      const tokens = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
      const query = buildCleanQuery(tokens, 10, 20);
      expect(query).toBe('alpha beta gamma');
      expect(query).not.toContain('del');
    });

    it('caps by maxWords whole words', () => {
      const tokens = ['one', 'two', 'three', 'four', 'five', 'six'];
      const query = buildCleanQuery(tokens, 3, 100);
      expect(query).toBe('one two three');
    });

    it('corrects edge-truncated words like "trol" to "troll"', () => {
      const tokens = ['first contract; a sheep-eating trol'];
      const query = buildCleanQuery(tokens, 10, 80);
      expect(query).toBe('first contract a sheep eating troll');
    });
  });
});
