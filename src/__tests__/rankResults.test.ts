import {
  rankResults,
  tokenSetRatio,
  calculateDurationScore,
  calculateKeyTokenMatch,
  levenshteinDistance,
  similarityRatio,
} from '../core/rankResults';
import { YouTubeVideo } from '../types';

describe('rankResults (Step 5)', () => {
  describe('Levenshtein and Token-Set Ratio', () => {
    test('calculates correct Levenshtein distance', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('same', 'same')).toBe(0);
      expect(levenshteinDistance('', 'abc')).toBe(3);
    });

    test('tokenSetRatio handles word permutations smoothly', () => {
      const s1 = 'Family Guy Funniest Moments';
      const s2 = 'Funniest Moments - Family Guy (Best Clips)';
      const ratio = tokenSetRatio(s1, s2);
      expect(ratio).toBeGreaterThan(0.8);
    });

    test('tokenSetRatio handles multilingual Arabic and French strings', () => {
      const ar1 = 'وثائقي الحرب العالمية الثانية';
      const ar2 = 'الحرب العالمية الثانية - وثائقي كامل';
      expect(tokenSetRatio(ar1, ar2)).toBeGreaterThan(0.85);

      const fr1 = 'Histoire incroyable Minecraft';
      const fr2 = 'Minecraft histoire incroyable docu';
      expect(tokenSetRatio(fr1, fr2)).toBeGreaterThan(0.8);
    });
  });

  describe('Duration scoring', () => {
    test('rewards videos over 8 minutes (480s)', () => {
      const result8m = calculateDurationScore(540); // 9 min
      expect(result8m.score).toBeGreaterThanOrEqual(0.10);
      expect(result8m.reason).toContain('>8 min');

      const result25m = calculateDurationScore(1500); // 25 min
      expect(result25m.score).toBe(0.20);
      expect(result25m.reason).toContain('>20 min');
    });

    test('penalizes short clips / YouTube Shorts (<60s)', () => {
      const resultShort = calculateDurationScore(45);
      expect(resultShort.score).toBeLessThan(0);
      expect(resultShort.reason).toContain('unlikely original source');
    });

    test('gives modest bonus for medium videos (4-8 min)', () => {
      const resultMedium = calculateDurationScore(300); // 5 min
      expect(resultMedium.score).toBe(0.05);
    });
  });

  describe('Key query token matching', () => {
    test('identifies matching key tokens while ignoring stop words', () => {
      const title = 'The Dark Knight Joker Interrogation Scene 4K';
      const query = 'Dark Knight interrogation scene';
      const match = calculateKeyTokenMatch(title, query);

      expect(match.ratio).toBe(1.0);
      expect(match.matchedTokens).toContain('dark');
      expect(match.matchedTokens).toContain('knight');
      expect(match.matchedTokens).toContain('interrogation');
      expect(match.matchedTokens).toContain('scene');
    });
  });

  describe('Full rankResults pipeline', () => {
    const candidates: YouTubeVideo[] = [
      {
        id: 'vid-short',
        title: 'Family Guy funniest moments #shorts',
        channelTitle: 'ClipsHub',
        duration: '0:45',
        durationSeconds: 45,
        thumbnailUrl: 'https://img.youtube.com/vi/vid-short/hqdefault.jpg',
        url: 'https://www.youtube.com/watch?v=vid-short',
      },
      {
        id: 'vid-full',
        title: 'Family Guy - Best & Funniest Moments (Season 4 Compilation)',
        channelTitle: 'Animation Classics',
        duration: '22:15',
        durationSeconds: 1335,
        thumbnailUrl: 'https://img.youtube.com/vi/vid-full/hqdefault.jpg',
        url: 'https://www.youtube.com/watch?v=vid-full',
      },
      {
        id: 'vid-medium',
        title: 'Top 10 Family Guy Moments',
        channelTitle: 'WatchMojo',
        duration: '11:20',
        durationSeconds: 680,
        thumbnailUrl: 'https://img.youtube.com/vi/vid-medium/hqdefault.jpg',
        url: 'https://www.youtube.com/watch?v=vid-medium',
      },
      {
        id: 'vid-unrelated',
        title: 'South Park Funniest Cartman Scenes',
        channelTitle: 'Comedy Central',
        duration: '15:00',
        durationSeconds: 900,
        thumbnailUrl: 'https://img.youtube.com/vi/vid-unrelated/hqdefault.jpg',
        url: 'https://www.youtube.com/watch?v=vid-unrelated',
      },
    ];

    test('prefers long video compilation over shorts for TikTok parts', () => {
      const queries = ['Family Guy funniest moments'];
      const ranked = rankResults(candidates, queries);

      expect(ranked.length).toBe(3); // top 3 returned
      expect(ranked[0].id).toBe('vid-full'); // 22 min compilation ranked #1
      expect(ranked[0].confidence).toBeGreaterThan(0.75);
      expect(ranked[0].matchReasons.some((r) => r.includes('>20 min'))).toBe(true);

      // Verify vid-short is ranked below long videos due to duration penalty
      const shortIndex = ranked.findIndex((v) => v.id === 'vid-short');
      const mediumIndex = ranked.findIndex((v) => v.id === 'vid-medium');
      expect(mediumIndex).toBeLessThan(shortIndex !== -1 ? shortIndex : 999);
    });

    test('confidence scores are strictly bounded between 0.00 and 1.00', () => {
      const queries = ['Family Guy funniest moments'];
      const ranked = rankResults(candidates, queries);

      for (const item of ranked) {
        expect(item.confidence).toBeGreaterThanOrEqual(0.0);
        expect(item.confidence).toBeLessThanOrEqual(1.0);
      }
    });

    test('ranks Arabic documentary accurately', () => {
      const arabicCandidates: YouTubeVideo[] = [
        {
          id: 'ar-full',
          title: 'وثائقي كامل: أسرار اختفاء طائرة برمودا الغامضة',
          channelTitle: 'وثائقيات الجزيرة',
          duration: '45:10',
          durationSeconds: 2710,
          thumbnailUrl: 'https://img.youtube.com/vi/ar-full/hqdefault.jpg',
          url: 'https://www.youtube.com/watch?v=ar-full',
        },
        {
          id: 'ar-short',
          title: 'اختفاء طائرة برمودا #شورتس',
          channelTitle: 'معلومات سريعة',
          duration: '0:50',
          durationSeconds: 50,
          thumbnailUrl: 'https://img.youtube.com/vi/ar-short/hqdefault.jpg',
          url: 'https://www.youtube.com/watch?v=ar-short',
        },
      ];

      const queries = ['قصة اختفاء طائرة برمودا الغامضة'];
      const ranked = rankResults(arabicCandidates, queries);

      expect(ranked[0].id).toBe('ar-full');
      expect(ranked[0].confidence).toBeGreaterThan(0.7);
    });

    test('handles empty candidate list gracefully', () => {
      const ranked = rankResults([], ['query']);
      expect(ranked).toEqual([]);
    });
  });
});
