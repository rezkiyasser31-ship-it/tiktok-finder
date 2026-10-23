import {
  extractCandidateQueries,
  cleanCaptionText,
  cleanOcrText,
} from '../core/extractCandidateQueries';

describe('extractCandidateQueries (Step 3)', () => {
  describe('17+ Realistic captions across English, French, and Arabic', () => {
    // 1. English - Standard Part 3 with hashtags and emojis
    test('1. English: Family Guy Part 3 with emojis and viral tags', () => {
      const caption = 'Family Guy funniest moments Part 3 😂💀 #familyguy #funny #fyp #viral #foryou';
      const queries = extractCandidateQueries(caption);
      expect(queries[0]).toBe('Family Guy funniest moments');
      expect(queries[0]).not.toMatch(/part\s*3/i);
      expect(queries[0]).not.toMatch(/#|😂|💀|fyp|viral|foryou/i);
    });

    // 2. English - pt. 2 abbreviation with punctuation and question marks
    test('2. English: MrBeast challenge pt. 2 with question mark and hashtag', () => {
      const caption = 'MrBeast $1,000,000 challenge pt. 2! Who will win?? #mrbeast #challenge #fyp';
      const queries = extractCandidateQueries(caption);
      expect(queries[0]).toBe('MrBeast $1,000,000 challenge Who will win');
      expect(queries[0]).not.toMatch(/pt\.?\s*2/i);
    });

    // 3. English - Parenthesized (Part 4)
    test('3. English: Gordon Ramsay Kitchen Nightmares (Part 4) with emojis', () => {
      const caption = 'Gordon Ramsay Loses His Mind in Kitchen Nightmares (Part 4) 🔥🔥 #gordonramsay #kitchennightmares';
      const queries = extractCandidateQueries(caption);
      expect(queries[0]).toBe('Gordon Ramsay Loses His Mind in Kitchen Nightmares');
      expect(queries[0]).not.toMatch(/part\s*4|\(|\)/i);
    });

    // 4. English - Fraction format [2/5]
    test('4. English: Dark knight scene analysis [2/5] fraction marker', () => {
      const caption = 'The Dark Knight interrogation scene analysis [2/5] #batman #joker #movieclips';
      const queries = extractCandidateQueries(caption);
      expect(queries[0]).toBe('The Dark Knight interrogation scene analysis');
      expect(queries[0]).not.toMatch(/2\/5|\[|\]/);
    });

    // 5. English - P1 shorthand with podcast episode number
    test('5. English: Joe Rogan podcast with P1 shorthand', () => {
      const caption = 'Joe Rogan Experience #1368 - Edward Snowden P1 🤯 #jre #podcast #joerogan';
      const queries = extractCandidateQueries(caption);
      expect(queries[0]).toContain('Joe Rogan Experience');
      expect(queries[0]).toContain('Edward Snowden');
      expect(queries[0]).not.toMatch(/\bP1\b/i);
    });

    // 6. English - p.2 dot notation with "watch till end" noise
    test('6. English: satisfying slime p.2 with watch till end noise', () => {
      const caption = 'satisfying slime mixing p.2 ✨✨ watch till end #slime #satisfying #fypシ';
      const queries = extractCandidateQueries(caption);
      expect(queries[0]).toBe('satisfying slime mixing');
      expect(queries[0]).not.toMatch(/p\.2|watch till end|fyp/i);
    });

    // 7. French - Partie 2 with trending hashtags
    test('7. French: Minecraft story (Partie 2) with French viral hashtags', () => {
      const caption = "L'histoire incroyable de la création de Minecraft (Partie 2) ⛏️🤯 #minecraft #storytime #pourtoi #prt #tendance";
      const queries = extractCandidateQueries(caption);
      expect(queries[0]).toContain("L'histoire incroyable de la création de Minecraft");
      expect(queries[0]).not.toMatch(/partie\s*2|pourtoi|prt|tendance/i);
    });

    // 8. French - pt 3 abbreviation
    test('8. French: Squeezie voyage pt 3 with laugh emojis', () => {
      const caption = 'Squeezie raconte son pire voyage pt 3 😂😭 #squeezie #story #pourtoi #viral';
      const queries = extractCandidateQueries(caption);
      expect(queries[0]).toBe('Squeezie raconte son pire voyage');
      expect(queries[0]).not.toMatch(/pt\s*3|pourtoi|viral/i);
    });

    // 9. French - partie 1 lowercase without parentheses
    test('9. French: Espace mystères partie 1 with space emojis', () => {
      const caption = "Top 10 mystères inexpliqués de l'espace partie 1 🌌🚀 #espace #science #pourtoi";
      const queries = extractCandidateQueries(caption);
      expect(queries[0]).toContain("Top 10 mystères inexpliqués de l'espace");
      expect(queries[0]).not.toMatch(/partie\s*1/i);
    });

    // 10. French - ep 2 marker and dash separation
    test('10. French: Mcfly et Carlito ep 2 with dash separator', () => {
      const caption = 'Mcfly et Carlito - Les pires anecdotes de tournage ep 2 🔥 #mcflyetcarlito #humour #foryou';
      const queries = extractCandidateQueries(caption);
      expect(queries[0]).toContain('Mcfly et Carlito');
      expect(queries[0]).toContain('Les pires anecdotes de tournage');
      expect(queries[0]).not.toMatch(/ep\s*2/i);
    });

    // 11. French - [Partie 3/4] composite fraction marker
    test('11. French: Napoléon docu [Partie 3/4] composite fraction', () => {
      const caption = "Comment Napoléon a conquis l'Europe [Partie 3/4] 👑⚔️ #histoire #napoleon #culture";
      const queries = extractCandidateQueries(caption);
      expect(queries[0]).toContain("Comment Napoléon a conquis l'Europe");
      expect(queries[0]).not.toMatch(/partie\s*3\/4/i);
    });

    // 12. Arabic - الجزء 2 with Arabic hashtags
    test('12. Arabic: Bermuda triangle mystery الجزء 2 with Arabic viral tags', () => {
      const caption = 'قصة اختفاء طائرة برمودا الغامضة الجزء 2 😱✈️ #قصص #غموض #اكسبلور #ترند #fyp';
      const queries = extractCandidateQueries(caption);
      expect(queries[0]).toBe('قصة اختفاء طائرة برمودا الغامضة');
      expect(queries[0]).not.toContain('الجزء 2');
      expect(queries[0]).not.toContain('اكسبلور');
    });

    // 13. Arabic - جزء 3 without definite article
    test('13. Arabic: Daheeh science episode جزء 3', () => {
      const caption = 'الدحيح - أسرار الثقوب السوداء جزء 3 🌌🤯 #الدحيح #علوم #اكسبلور_فولو';
      const queries = extractCandidateQueries(caption);
      expect(queries[0]).toContain('الدحيح');
      expect(queries[0]).toContain('أسرار الثقوب السوداء');
      expect(queries[0]).not.toContain('جزء 3');
      expect(queries[0]).not.toContain('اكسبلور_فولو');
    });

    // 14. Arabic - ج2 single-letter abbreviation
    test('14. Arabic: WW2 documentary with ج2 abbreviation', () => {
      const caption = 'أقوى وثائقي عن الحرب العالمية الثانية ج2 ⚔️💣 #تاريخ #وثائقي #ترند_تيك_توك';
      const queries = extractCandidateQueries(caption);
      expect(queries[0]).toBe('أقوى وثائقي عن الحرب العالمية الثانية');
      expect(queries[0]).not.toContain('ج2');
    });

    // 15. Arabic - بارت 1 transliterated English "part"
    test('15. Arabic: 24-hour challenge with بارت 1', () => {
      const caption = 'تحدي ال 24 ساعة في الصحراء مع أنس وأصالة بارت 1 🔥⛺ #انس_واصالة #تحديات #اكسبلور';
      const queries = extractCandidateQueries(caption);
      expect(queries[0]).toContain('تحدي ال 24 ساعة في الصحراء مع أنس وأصالة');
      expect(queries[0]).not.toContain('بارت 1');
      expect(queries[0]).not.toContain('اكسبلور');
    });

    // 16. Arabic - مسلسل with الحلقة 120 and الجزء 2
    test('16. Arabic: Historical TV series with الحلقة and الجزء', () => {
      const caption = 'مسلسل قيامة عثمان الحلقة 120 الجزء 2 🐎⚔️ #قيامة_عثمان #عثمان #مسلسلات';
      const queries = extractCandidateQueries(caption);
      expect(queries[0]).toContain('مسلسل قيامة عثمان');
      expect(queries[0]).not.toContain('الجزء 2');
    });

    // 17. Arabic - Isolated parenthesized number (2)
    test('17. Arabic: Scientific experiments with parenthesized number (2)', () => {
      const caption = 'أغرب التجارب العلمية في التاريخ (2) 🧪🔬 #غرائب #معلومات #fyp';
      const queries = extractCandidateQueries(caption);
      expect(queries[0]).toBe('أغرب التجارب العلمية في التاريخ');
      expect(queries[0]).not.toMatch(/\(2\)/);
    });
  });

  describe('OCR text integration', () => {
    test('combines strong OCR title with caption context', () => {
      const caption = 'he really did it again pt. 2 😂 #challenge #fyp';
      const ocrText = 'MRBEAST $1,000,000 CHALLENGE';
      const queries = extractCandidateQueries(caption, ocrText);

      expect(queries.length).toBeGreaterThanOrEqual(2);
      expect(queries.some((q) => q.includes('MRBEAST'))).toBe(true);
      expect(queries.some((q) => q.includes('$1,000,000'))).toBe(true);
    });

    test('handles OCR text alone when caption is purely hashtags', () => {
      const caption = '#fyp #foryou #viral #explore';
      const ocrText = 'Interstellar Docking Scene Hans Zimmer';
      const queries = extractCandidateQueries(caption, ocrText);

      expect(queries[0]).toContain('Interstellar Docking Scene Hans Zimmer');
    });

    test('cleans UI noise and timestamps from OCR text', () => {
      const dirtyOcr = '00:15 TikTok Follow for more Family Guy Season 4 Episode 12';
      const cleaned = cleanOcrText(dirtyOcr);
      expect(cleaned).not.toMatch(/00:15|tiktok|follow/i);
      expect(cleaned).toContain('Family Guy Season 4 Episode 12');
    });
  });

  describe('Ranked queries limit and structure', () => {
    test('returns at most 3 queries', () => {
      const caption = 'Breaking Bad - Season 5 Episode 14 "Ozymandias" breakdown pt. 2 #breakingbad';
      const queries = extractCandidateQueries(caption);
      expect(queries.length).toBeGreaterThanOrEqual(1);
      expect(queries.length).toBeLessThanOrEqual(3);
    });

    test('handles empty or blank caption gracefully by returning empty array', () => {
      const queries = extractCandidateQueries('');
      expect(queries.length).toBe(0);
    });

    test('handles hashtag-only caption (#witcher #witcher3 #pov #storytime) without junk queries', () => {
      const queries = extractCandidateQueries('#witcher #witcher3 #pov #storytime');
      // Must NOT return junk like 'TikTok viral video'
      expect(queries.length).toBe(0);
    });

    test('augments OCR title with meaningful hashtags if available', () => {
      const queries = extractCandidateQueries('#witcher #witcher3 #pov #storytime', 'Why Every Witcher School Sucks');
      expect(queries).toContain('Why Every Witcher School Sucks');
      expect(queries).toContain('Why Every Witcher School Sucks witcher3');
    });
  });
});
