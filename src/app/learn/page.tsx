'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Star, X, CheckCircle, Trophy, BookOpen, Zap, RotateCcw, ChevronRight, Sparkles, GraduationCap, ScrollText, Layers } from 'lucide-react';

interface Question {
  q: string;
  opts: string[];
  answer: number;
  explanation: string;
  verse?: string;
}

interface Category {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  bg: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  questions: Question[];
}

// ── Ulumul Quran curriculum ──────────────────────────────────────────────────
// Each category = one branch of Quran sciences toward Ulil Albab & Iqro Generation
const CATEGORIES: Category[] = [
  // ── Tajweed ────────────────────────────────────────────────────────────────
  {
    id: 'tajweed',
    title: 'Tajweed',
    subtitle: 'Rules of Quranic Recitation',
    icon: '🎙️',
    color: '#2d3a10',
    bg: 'linear-gradient(135deg, #2d3a10 0%, #3d4e18 100%)',
    level: 'Beginner',
    questions: [
      {
        q: 'What does "Ikhfa" mean in Tajweed?',
        opts: ['Complete stop', 'Hiding the Noon sound between Izhar & Idgham', 'Lengthening the vowel', 'Merging two letters'],
        answer: 1,
        explanation: 'Ikhfa (إخفاء) = concealment. Noon Saakin or Tanween before 15 specific letters produces a nasal sound between clear (Izhar) and merged (Idgham). Practise with: مِن قَبۡلِ (min qabli).',
        verse: '96:1',
      },
      {
        q: 'Idgham with Ghunnah applies before which letters?',
        opts: ['ل ر', 'ي ن م و', 'ء ه ع ح', 'ق ط ب ج د'],
        answer: 1,
        explanation: 'Idgham bi-Ghunnah letters: ي ن م و (remembered as يَنمو "Yanmu"). Noon Saakin or Tanween followed by these letters merges WITH a nasal sound of 2 counts.',
      },
      {
        q: 'How many counts (harakaat) does Mad Tabii last?',
        opts: ['1', '2', '4', '6'],
        answer: 1,
        explanation: 'Mad Tabii (natural prolongation) = 2 harakaat. It is the base for all other mad types. It occurs when a long vowel letter (ا و ي) follows its matching short vowel with no hamza or sukun after it.',
      },
      {
        q: 'Qalqalah (echoing) letters are:',
        opts: ['ي ن م و', 'ء ه ع ح غ خ', 'ق ط ب ج د', 'ل ر'],
        answer: 2,
        explanation: 'Qalqalah letters: قُطۡبُ جَدٍّ (Qutb Jadd) = ق ط ب ج د. When these appear with sukun (at rest), a distinct echoing bounce is produced. Strongest on ق and ط.',
      },
      {
        q: 'What is Mad Munfasil and how long is it recited?',
        opts: ['2 counts — a vowel followed by hamza in same word', '4–5 counts — long vowel at end of word, hamza starts next word', '6 counts — long vowel before shadda', '2 counts — a natural prolongation'],
        answer: 1,
        explanation: 'Mad Munfasil = "separated" mad. Long vowel ends one word and hamza begins the next: e.g. إِنَّا أَعۡطَيۡنَٰكَ. Reciters lengthen it 4–5 counts (Warsh route: 4; Hafs: 4–5).',
        verse: '108:1',
      },
      {
        q: 'Lam in Allah (لفظ الجلالة) is pronounced heavy (tafkhim) when preceded by:',
        opts: ['Kasra (ِ)', 'Fatha (َ) or Damma (ُ)', 'Sukun', 'Shadda'],
        answer: 1,
        explanation: 'The majestic Lam of "Allah" is heavy (مُفَخَّم) when the preceding vowel is fatha or damma: e.g. قَالَ اللَّهُ، رَسُولُ اللَّهِ. It is light (مُرَقَّق) after kasra: بِسۡمِ اللَّهِ.',
        verse: '1:1',
      },
      {
        q: 'What is "Waqf Lazim" (obligatory stop)?',
        opts: ['A stop that breaks the meaning if continued', 'A recommended place to stop for a breath', 'Stopping at every ayah ending', 'Stopping before a new juz'],
        answer: 0,
        explanation: 'Waqf Lazim (م) = must stop here; continuing would produce incorrect or opposite meaning. E.g., 2:8 — stopping after "yu\'minun" is obligatory because continuing changes the statement to its opposite.',
      },
      {
        q: 'Izhar Halqi (clear pronunciation) applies to which 6 throat letters?',
        opts: ['ب ت ث ج', 'ء ه ع ح غ خ', 'ق ط ب ج د', 'ي ن م و'],
        answer: 1,
        explanation: 'Izhar Halqi = 6 throat (halq) letters: ء ه ع ح غ خ. When Noon Saakin or Tanween is followed by any of these, pronounce the noon clearly with NO merging or nasal sound.',
        verse: '1:7',
      },
    ],
  },

  // ── Asbab al-Nuzul ─────────────────────────────────────────────────────────
  {
    id: 'asbab',
    title: 'Asbab al-Nuzul',
    subtitle: 'Occasions of Revelation',
    icon: '📜',
    color: '#5a6b28',
    bg: 'linear-gradient(135deg, #3d4e18 0%, #5a6b28 100%)',
    level: 'Intermediate',
    questions: [
      {
        q: 'What is "Asbab al-Nuzul" (أسباب النزول)?',
        opts: ['The science of Quran memorisation', 'Historical events/questions that prompted specific revelation', 'Rules of Arabic grammar in the Quran', 'Science of Quranic manuscripts'],
        answer: 1,
        explanation: 'Asbab al-Nuzul = causes/occasions of revelation. Knowing WHY a verse was revealed deepens understanding of its meaning, limits, and applicability — a core tool of Tafsir.',
      },
      {
        q: 'Surah Al-Masad (111) was revealed in response to:',
        opts: ['The migration to Abyssinia', 'Abu Lahab cursing the Prophet at Jabal Safa', 'The Battle of Badr', 'A question about the afterlife'],
        answer: 1,
        explanation: 'After the Prophet (ﷺ) called people at Safa saying "I warn you of a severe punishment", Abu Lahab said "Perish you!" — so Allah revealed: "May the hands of Abu Lahab be ruined." (111:1)',
        verse: '111:1',
      },
      {
        q: 'The verse of Hijab (24:31) was revealed partly because of:',
        opts: ['A dispute about inheritance', 'Women being harassed; need to distinguish free believing women', 'A question about fasting', 'The conquest of Makkah'],
        answer: 1,
        explanation: 'Multiple reports indicate harassment of women in Madinah. When Umar asked the Prophet to order women to cover, and incidents of confusion occurred, Allah revealed the hijab/modesty verses to protect believing women.',
        verse: '24:31',
      },
      {
        q: 'Ayat al-Kursiy (2:255) — what is remarkable about its occasion?',
        opts: ['It has a specific single occasion of revelation', 'It was revealed gradually over years', 'No specific occasion — it was revealed as part of a long continuous passage', 'It was revealed during the Night Journey'],
        answer: 2,
        explanation: 'Many great verses (like Ayat al-Kursiy) were revealed without a specific recorded occasion (ibtidā\'ī). Understanding that not every verse requires an "occasion" is itself important Ulumul Quran knowledge.',
        verse: '2:255',
      },
      {
        q: 'The verse "There is no compulsion in religion" (2:256) was revealed regarding:',
        opts: ['Non-Muslim traders in Madinah', 'Ansari parents who had Jewish/Christian children wanting to keep their religion', 'Prisoners of war after Badr', 'The treaty with Banu Nadir'],
        answer: 1,
        explanation: 'Reported by Ibn Abbas: some Ansari children had been raised Jewish or Christian before Islam. Their parents wanted to force them into Islam. Allah revealed: "No compulsion in religion" — faith must be chosen freely.',
        verse: '2:256',
      },
      {
        q: 'A verse with multiple occasions of revelation (ta\'addud al-asbab) means:',
        opts: ['The verse was revealed more than once', 'Several events each independently prompted or supported the same revelation', 'The verse was abrogated and re-revealed', 'Different reciters have different versions'],
        answer: 1,
        explanation: 'Ta\'addud al-asbab: when scholars record multiple events linked to one verse, this means each event reinforced or gave context to the same revelation — not that it was revealed multiple times.',
      },
    ],
  },

  // ── Nasikh & Mansukh ───────────────────────────────────────────────────────
  {
    id: 'nasikh',
    title: 'Nasikh & Mansukh',
    subtitle: 'Abrogation in the Quran',
    icon: '⚖️',
    color: '#b8860b',
    bg: 'linear-gradient(135deg, #8a6008 0%, #d4a017 100%)',
    level: 'Intermediate',
    questions: [
      {
        q: 'What does "Naskh" (النسخ) mean in Ulumul Quran?',
        opts: ['Copying the Quran by hand', 'Lifting/replacing an earlier ruling with a later one', 'Memorising the Quran', 'Explaining difficult Quranic words'],
        answer: 1,
        explanation: 'Naskh = abrogation: a later revelation lifts the obligation of an earlier ruling. The Nasikh = abrogating verse; Mansukh = abrogated verse. This reflects the gradual legislation (tadarruj) of Islamic law.',
        verse: '2:106',
      },
      {
        q: 'Which verse explicitly mentions the principle of Naskh?',
        opts: ['2:255', '2:106', '16:44', '4:82'],
        answer: 1,
        explanation: '"Whatever verse We abrogate or cause to be forgotten, We bring one better than it or similar to it." (2:106) — This is the foundational Quranic statement authorising abrogation.',
        verse: '2:106',
      },
      {
        q: 'The prohibition of alcohol came in how many stages?',
        opts: ['1 direct prohibition', '2 stages', '3 stages', '4 stages'],
        answer: 2,
        explanation: 'Gradual prohibition (tadarruj): Stage 1 — fruit and wholesome provision contrasted (16:67). Stage 2 — great sin alongside benefit (2:219). Stage 3 — do not pray while drunk (4:43). Stage 4 — final prohibition (5:90–91).',
        verse: '5:90',
      },
      {
        q: 'What is "Naskh al-Sunnah bil-Quran" (Sunnah abrogated by Quran)?',
        opts: ['Quran verses that explain Sunnah', 'A Sunnah ruling being lifted/replaced by a later Quranic verse', 'Quranic verses that abrogate each other', 'Hadith that abrogate other hadith'],
        answer: 1,
        explanation: 'E.g., the early Sunnah of facing Jerusalem in prayer was abrogated when Quran 2:144 directed Muslims to face the Kaaba. This is one of the most famous examples of Sunnah abrogated by Quran.',
        verse: '2:144',
      },
      {
        q: 'Scholars disagree on how many actual naskh cases exist. The most careful estimate is:',
        opts: ['Over 500 cases', 'About 200 cases', 'Around 20 cases', '5 or fewer clear cases'],
        answer: 2,
        explanation: 'Early scholars listed 500+; later scholars like Ibn al-Jawzi reduced this to ~20; Shah Waliullah narrowed it to ~5. Most apparent contradictions are resolved by specification (takhsis) or conditions, not true abrogation.',
      },
      {
        q: 'The qibla change (facing Madinah direction) was abrogated by:',
        opts: ['Surah Al-Fatiha', 'Surah Al-Baqarah verse 144', 'Surah Al-Imran', 'No Quran verse — only a Sunnah ruling'],
        answer: 1,
        explanation: '"Turn your face toward al-Masjid al-Haram." (2:144) abrogated the earlier direction toward Jerusalem. This occurred 16–17 months after the Prophet\'s migration to Madinah.',
        verse: '2:144',
      },
    ],
  },

  // ── Tafsir Methodology ─────────────────────────────────────────────────────
  {
    id: 'tafsir',
    title: 'Tafsir Methodology',
    subtitle: 'Science of Quranic Interpretation',
    icon: '🔍',
    color: '#2d3a10',
    bg: 'linear-gradient(135deg, #1a2508 0%, #2d3a10 100%)',
    level: 'Intermediate',
    questions: [
      {
        q: 'What is the most authoritative type of Tafsir?',
        opts: ['Tafsir by personal opinion (ra\'y)', 'Tafsir bil-Ma\'thur (by transmission: Quran, Sunnah, Sahaba)', 'Tafsir based purely on linguistics', 'Tafsir based on Isra\'iliyyat (Jewish/Christian tradition)'],
        answer: 1,
        explanation: 'Tafsir bil-Ma\'thur is highest in authority: (1) Quran explains Quran — best method, (2) Sunnah explains Quran, (3) Companion narrations (Sahaba), (4) Successor opinions (Tabi\'in). This chain preserves intended meanings.',
      },
      {
        q: 'Who wrote "Jami\' al-Bayan" — the most comprehensive classical tafsir by transmission?',
        opts: ['Ibn Kathir', 'Al-Tabari', 'Al-Qurtubi', 'Al-Zamakhshari'],
        answer: 1,
        explanation: 'Imam Al-Tabari (d. 310H) wrote "Jami\' al-Bayan \'an Ta\'wil Ay al-Quran" — the earliest and most exhaustive isnad-based tafsir, covering almost every verse with multiple chains of transmission.',
      },
      {
        q: 'Tafsir al-Ishari (mystical/spiritual interpretation) is considered valid when:',
        opts: ['It contradicts the obvious meaning', 'It aligns with Arabic language and does not contradict the Shar\'iah', 'It comes from any Sufi scholar', 'It is more beautiful than the literal meaning'],
        answer: 1,
        explanation: 'Valid Ishari tafsir must: (1) not contradict the outward/obvious meaning, (2) align with Arabic language, (3) not conflict with Shariah or Sunnah. When these conditions are met, a deeper spiritual meaning may be accepted alongside the obvious one.',
      },
      {
        q: 'What is the danger of "Tafsir bil-Ra\'y al-Madhmum" (blameworthy opinion)?',
        opts: ['It uses too many hadith', 'Interpreting Quran by personal desire/whim without proper knowledge of the sciences', 'It focuses too much on grammar', 'Using multiple opinions simultaneously'],
        answer: 1,
        explanation: 'The Prophet (ﷺ) warned: "Whoever speaks about the Quran with his opinion and is correct has still erred." Blameworthy ra\'y = forcing one\'s preconceived views onto the text without linguistic, shar\'i, and historical grounding.',
      },
      {
        q: 'Why is knowledge of Arabic grammar (Nahw/Sarf) essential for Tafsir?',
        opts: ['Just for beauty of recitation', 'Because a single vowel change can completely alter meaning', 'It\'s optional — translation is sufficient', 'Only needed for poets'],
        answer: 1,
        explanation: 'Example: "لَا يَمَسُّهُ إِلَّا الْمُطَهَّرُونَ" (56:79) — does "mutahharun" = ritually pure people (descriptive) or those who have purified themselves (prescriptive)? The i\'rab (grammatical analysis) determines the ruling. Grammar is not optional in Tafsir.',
        verse: '56:79',
      },
      {
        q: 'The Tafsir principle "al-\'ibra bi-\'umum al-lafz, la bi-khusus al-sabab" means:',
        opts: ['Specific occasion > general wording', 'General wording of a verse applies broadly, not only to the specific occasion of revelation', 'The occasion always limits the verse\'s application', 'Only the companion who witnessed the occasion can interpret it'],
        answer: 1,
        explanation: 'The majority of scholars hold that a verse\'s ruling follows its GENERAL wording, not the specific occasion. E.g., the verse of Zihar (58:3) addresses a specific person\'s case but its ruling applies to all Muslims universally.',
        verse: '58:3',
      },
    ],
  },

  // ── I'jaz al-Quran ─────────────────────────────────────────────────────────
  {
    id: 'ijaz',
    title: "I'jaz al-Quran",
    subtitle: 'The Miraculous Nature of the Quran',
    icon: '✨',
    color: '#3d4e18',
    bg: 'linear-gradient(135deg, #2d3a10 0%, #5a6b28 100%)',
    level: 'Advanced',
    questions: [
      {
        q: "What does \"I'jaz al-Quran\" (إعجاز القرآن) mean?",
        opts: ['The translation of the Quran', 'The incapacity of humans to produce anything matching the Quran', 'Memorising the Quran is a miracle', 'The revelation came without warning'],
        answer: 1,
        explanation: "I'jaz = making others incapable. The Quran challenged (tahaddi) all Arabs and jinn to produce even one surah like it (2:23) — they failed despite being unrivalled masters of Arabic eloquence. This is the primary proof of the Quran's divine origin.",
        verse: '2:23',
      },
      {
        q: "The Quran's literary challenge (Tahaddi) progressed in how many stages?",
        opts: ['1 stage', '2 stages', '3 stages', '4 stages'],
        answer: 2,
        explanation: '3 escalating challenges: (1) Produce 10 surahs like it (11:13), (2) Produce 1 surah like it (2:23, 10:38), (3) Any speech or composition comparable (17:88 — humans + jinn together cannot). Each challenge was met with silence.',
        verse: '17:88',
      },
      {
        q: "Which aspect of I'jaz relates to accurate historical and future information?",
        opts: ["I'jaz bayani (linguistic)", "I'jaz ilmi (scientific/informational)", "I'jaz tashri'i (legislative)", "I'jaz adadi (numerical)"],
        answer: 1,
        explanation: "I'jaz Ilmi includes: historical accuracy (e.g., Pharaoh's preserved body — 10:92), future prophecies (Rome will be victorious — 30:2-4, fulfilled within a decade), and facts unknown to 7th-century Arabs (embryology, cosmic expansion).",
        verse: '30:2',
      },
      {
        q: "The Quran says \"We have certainly made the Quran easy for remembrance\" (54:17). What is the miraculous implication?",
        opts: ['It means only scholars can memorise it', 'Millions have memorised all 6,236 verses verbatim — no other book in human history has this scale', 'It means reciting slowly makes it easy', 'It only applies to Arabic speakers'],
        answer: 1,
        explanation: "Hifz (memorisation) is itself a living miracle: over 10 million huffaz today, including children as young as 5, across every language and ethnicity — all preserving the identical text. This fulfils 15:9: 'Indeed, it is We who sent down the Dhikr, and indeed, We will be its guardian.'",
        verse: '54:17',
      },
      {
        q: "I'jaz Tashri'i (legislative miracle) refers to:",
        opts: ['The beauty of Quranic Arabic', 'Complete and balanced legal system covering all human needs, unmatched by any human law code', 'Scientific information in the Quran', 'The numerical patterns in the Quran'],
        answer: 1,
        explanation: "The Quran established a complete legislative system — worship, family, economics, criminal justice, international relations — in 23 years, without contradiction. Human legal codes developed over centuries with revisions. The Quran's internal consistency is part of its miracle (4:82).",
        verse: '4:82',
      },
      {
        q: "What is the scholarly position on 'scientific miracles' (I'jaz Ilmi) in the Quran?",
        opts: ['All Quranic verses are primarily scientific texts', 'Scientific allusions are valid as supporting evidence but should not become the primary lens of Tafsir', 'Scientific interpretation is never valid', 'Only modern scientists can interpret the Quran'],
        answer: 1,
        explanation: "Scholars like Sheikh Yusuf al-Qaradawi warn against over-stretching: the Quran is a book of guidance, not a science textbook. Valid I'jaz Ilmi = verses whose Arabic wording aligns remarkably with established science. Forcing unconfirmed theories onto the Quran is not valid I'jaz.",
      },
    ],
  },

  // ── Qira'at ────────────────────────────────────────────────────────────────
  {
    id: 'qiraat',
    title: "Qira'at",
    subtitle: 'Seven Recitation Traditions',
    icon: '📖',
    color: '#b8860b',
    bg: 'linear-gradient(135deg, #8a6008 0%, #b8860b 100%)',
    level: 'Advanced',
    questions: [
      {
        q: "What are the Qira'at Sab'ah (Seven Recitations)?",
        opts: ['7 completely different Qurans', '7 authentic chains of recitation, all traced to the Prophet, with minor phonetic and word-level variations', '7 translations of the Quran', '7 memorisation techniques'],
        answer: 1,
        explanation: "The Seven Recitations (Nafi', Ibn Kathir, Abu Amr, Ibn Amir, Asim, Hamza, Al-Kisa'i) are all authentic — traced to the Prophet (ﷺ) via unbroken chains (mutawatir). They represent the Ahruf (dialects/modes) in which Quran was revealed. All are the Quran; none is superior.",
      },
      {
        q: "Most of the world reads Quran according to which riwayah (transmission)?",
        opts: ["Warsh (from Nafi')", "Hafs (from Asim)", "Qalun (from Nafi')", "Al-Duri (from Abu Amr)"],
        answer: 1,
        explanation: "Hafs 'an Asim is the most widespread globally — used across Asia, Turkey, most of the Muslim world. Warsh 'an Nafi' is used in North/West Africa. Both are fully authentic mutawatir recitations.",
      },
      {
        q: "The Hadith 'the Quran was revealed in seven Ahruf' means:",
        opts: ['There are 7 different Qurans', '7 linguistic/dialectal modes of recitation, all divinely authorised', 'The Quran has 7 layers of meaning only', '7 volumes of the Quran'],
        answer: 1,
        explanation: "Ahruf = linguistic modes/dialects. The Prophet said: 'This Quran was revealed in seven Ahruf, so recite whichever is easy.' (Bukhari/Muslim). This facilitated memorisation across Arab tribes. The Uthman standardisation fixed one rasm (script) preserving most Ahruf within the qira'at traditions.",
      },
      {
        q: "A Qira'at is considered authentic (maqbula) when it meets how many conditions?",
        opts: ['1 condition — strong chain', '2 conditions — chain + Arabic grammar', '3 conditions — sahih chain + Arabic grammar + compatible with Uthmani script', '4 conditions'],
        answer: 2,
        explanation: "Ibn al-Jazari's 3 conditions: (1) Sound isnad to the Prophet, (2) Conforms to Arabic grammar rules, (3) Compatible with the Uthmani rasm (script) even broadly. If all 3 met → Quran. If only 2 → Shadh (irregular, not Quran).",
      },
      {
        q: "In Hafs vs Warsh recitation, 'maliki yawm id-din' (1:4) has a difference. What is it?",
        opts: ['Different Arabic word entirely', 'Hafs reads مَٰلِكِ (Maliki — Owner), Warsh reads مَلِكِ (Maliki — King) — both are authentic', 'They disagree on the meaning completely', 'Only Hafs is correct'],
        answer: 1,
        explanation: "Hafs: مَٰلِكِ yawm id-din (Owner/Master of the Day). Warsh (and Asim route): مَلِكِ (King of the Day). Both meanings are Quranically correct and reinforce each other — Allah is both Owner AND King of the Day of Judgment. This illustrates how Qira'at variations enrich meaning.",
        verse: '1:4',
      },
    ],
  },

  // ── Makki & Madani ─────────────────────────────────────────────────────────
  {
    id: 'makkimadani',
    title: 'Makki & Madani',
    subtitle: 'Chronology & Character of Revelation',
    icon: '🕌',
    color: '#2d3a10',
    bg: 'linear-gradient(135deg, #1a2508 0%, #3d4e18 100%)',
    level: 'Beginner',
    questions: [
      {
        q: 'How do scholars primarily define "Makki" and "Madani" surahs?',
        opts: ['By where they were physically recited', 'By whether they were revealed BEFORE or AFTER the Hijra (migration) to Madinah', 'By whether they mention Makkah or Madinah', 'By the length of the surah'],
        answer: 1,
        explanation: 'The most correct scholarly definition: Makki = revealed before Hijra (even if in Madinah); Madani = revealed after Hijra (even if in Makkah). This is a temporal, not geographical, classification.',
      },
      {
        q: 'Makki surahs are generally characterised by:',
        opts: ['Long verses, detailed legal rulings, political treaties', 'Short powerful verses, Tawhid (oneness of Allah), Day of Judgment, stories of prophets, addressing "Ya ayyuha\'l-nas"', 'Mainly addressing the hypocrites', 'Focusing on economic legislation'],
        answer: 1,
        explanation: 'Makki themes: establishing Aqeedah (belief), stories of prophets to comfort believers, vivid descriptions of Jannah/Jahannam, address "يَا أَيُّهَا النَّاسُ" (O Mankind). They built the spiritual foundation before legislation.',
      },
      {
        q: 'Madani surahs are generally characterised by:',
        opts: ['Short surahs about the afterlife', 'Detailed legislation, hudud (punishments), family law, community rules, addressing "Ya ayyuha\'l-ladhina amanu"', 'Only stories of earlier prophets', 'Only about Tawhid'],
        answer: 1,
        explanation: 'Madani themes: detailed Shariah (prayer, zakat, fasting, hajj rules), political/social legislation, addressing hypocrites (munafiqun), interfaith relations, "يَا أَيُّهَا الَّذِينَ آمَنُوا" (O you who believe!).',
      },
      {
        q: 'Which surah is Madani but appears early in the Quran\'s arrangement?',
        opts: ['Al-Fatiha', 'Al-Baqarah', 'Al-Ikhlas', 'Al-Falaq'],
        answer: 1,
        explanation: "Al-Baqarah (The Cow) is the first and longest Madani surah, revealed after Hijra. It appears second in the Quran but is Madani. The Quran's arrangement (tartib) is thematic/wisdom-based, not strictly chronological.",
        verse: '2:1',
      },
      {
        q: 'Why is knowing Makki/Madani classification important for Tafsir?',
        opts: ['Only for knowing surah length', 'It helps identify the developmental context — Aqeedah-building phase vs. legislation phase — giving correct application of verses', 'Only scholars with Arabic need it', 'Just for competition and memorisation'],
        answer: 1,
        explanation: "Knowing the classification helps determine: (1) whether a verse carries legal weight or is primarily creedal, (2) which verses are Makki (earlier) and potentially abrogated by Madani ones, (3) the gradual development of Islamic teaching.",
      },
      {
        q: 'How many surahs are considered Makki vs. Madani?',
        opts: ['50 Makki, 64 Madani', '86 Makki, 28 Madani', '70 Makki, 44 Madani', '60 Makki, 54 Madani'],
        answer: 1,
        explanation: 'By the most accepted count: 86 Makki surahs, 28 Madani surahs (total 114). Some surahs are disputed. Some contain both Makki and Madani verses (mixed surahs), like Al-Baqarah which contains Makki verses too.',
      },
    ],
  },

  // ── Tadabbur al-Quran ──────────────────────────────────────────────────────
  {
    id: 'tadabbur',
    title: 'Tadabbur al-Quran',
    subtitle: 'Deep Reflection — Path to Ulil Albab',
    icon: '💎',
    color: '#d4a017',
    bg: 'linear-gradient(135deg, #a07010 0%, #d4a017 100%)',
    level: 'Advanced',
    questions: [
      {
        q: 'What does "Tadabbur" (تَدَبُّر) mean?',
        opts: ['Speed-reading the Quran', 'Pondering deeply the meanings, implications, and lessons of verses', 'Translating the Quran', 'Reciting with beautiful voice'],
        answer: 1,
        explanation: "Tadabbur = pondering/reflecting deeply. Allah commands: 'Do they not reflect upon the Quran? If it had been from other than Allah, they would have found in it much contradiction.' (4:82). The Ulil Albab (people of deep understanding) are those who practice Tadabbur.",
        verse: '4:82',
      },
      {
        q: 'Who are the "Ulil Albab" (أُولُو الۡأَلۡبَٰبِ) in the Quran?',
        opts: ['Only Islamic scholars', 'Those who remember Allah standing, sitting, lying down AND reflect on creation', 'Only prophets and messengers', 'Those who memorise the entire Quran'],
        answer: 1,
        explanation: '3:190-191 describes Ulil Albab as those who: (1) see signs in creation, (2) remember Allah in ALL positions, (3) reflect deeply and say "Our Lord, You did not create this in vain." Ulil Albab are marked by integrated dhikr AND fikr (remembrance AND reflection).',
        verse: '3:190',
      },
      {
        q: 'What is the connection between Iqra (reading/learning) and becoming Ulil Albab?',
        opts: ['None — they are separate', 'Iqra (96:1) begins the path — reading/learning activates the mind; Tadabbur deepens it into wisdom; both are needed for Ulil Albab', 'Only Arabic speakers can reach this level', 'It only applies to scholars who study 20+ years'],
        answer: 1,
        explanation: "'Iqra bismi rabbik' (96:1) — Read/Learn in the name of your Lord — is the starting command. But Iqra without Tadabbur stays surface-level. The path: Iqra (acquire knowledge) → Tadabbur (reflect deeply) → Dhikr (remember Allah) = Ulil Albab.",
        verse: '96:1',
      },
      {
        q: 'The Quran says certain people have a "lock on their hearts" (47:24). What is the cure?',
        opts: ['Simply reading more pages per day', 'Active Tadabbur — engaging the heart and mind, not just eyes and tongue', 'Memorising more surahs', 'Listening to more recitations'],
        answer: 1,
        explanation: '"Do they not Tadabbur the Quran, or are there locks on their hearts?" (47:24). The Quran identifies absence of Tadabbur as the disease. The cure is active engagement: pause, reflect, ask what this verse means for my life today.',
        verse: '47:24',
      },
      {
        q: 'Why do scholars say Surah Al-Kahf (18) is key for Tadabbur practice?',
        opts: ['It is the shortest surah', 'It contains 4 deep stories (Ashabul Kahf, Two Gardens, Musa & Khidr, Dhul-Qarnayn) each with layered wisdom about trials, wealth, knowledge, and power', 'It is recommended only for Fridays', 'It has the most abrogated verses'],
        answer: 1,
        explanation: "Surah Al-Kahf's four parables are rich Tadabbur material: (1) Cave youth — trial of belief, (2) Two gardens — trial of wealth, (3) Musa & Khidr — trial of knowledge (you don't know everything), (4) Dhul-Qarnayn — trial of power. Each is a mirror for the believer.",
        verse: '18:1',
      },
      {
        q: 'Imam Ibn al-Qayyim said the heart reaches Allah through three things. Which trio is correct?',
        opts: ['Fasting, Hajj, Zakat', 'Tadabbur of the Quran, night prayer (Tahajjud), abandoning sins', 'Memorisation, recitation speed, correct makhraj', 'Duaa, sadaqah, fasting Mondays'],
        answer: 1,
        explanation: "Ibn al-Qayyim in 'Miftah Dar al-Sa'adah': the fastest route to Allah is (1) Tadabbur of the Quran with heart-presence, (2) Tahajjud (night prayer), (3) leaving sins. Tadabbur tops the list — it is the engine of the spiritual journey.",
      },
    ],
  },
];

// ── Points (unified with family Aura Points) ──────────────────────────────────
function useLearnPoints(userId: string | undefined, familyId: string | undefined) {
  const [totalEarned, setTotalEarned] = useState(0);
  const [familyPoints, setFamilyPoints] = useState(0);

  useEffect(() => {
    if (!userId) return;
    setTotalEarned(parseInt(localStorage.getItem(`learn_pts_${userId}`) || '0', 10));
  }, [userId]);

  useEffect(() => {
    if (!familyId) return;
    supabase.rpc('get_family_points', { p_family_id: familyId })
      .then(({ data }) => { if (typeof data === 'number') setFamilyPoints(data); });
  }, [familyId]);

  const addPoints = useCallback(async (amount: number) => {
    if (!userId || !familyId || amount <= 0) return;
    const key = `learn_pts_${userId}`;
    const newTotal = parseInt(localStorage.getItem(key) || '0', 10) + amount;
    localStorage.setItem(key, String(newTotal));
    setTotalEarned(newTotal);
    await supabase.rpc('add_points', {
      p_user_id: userId,
      p_family_id: familyId,
      p_points: amount,
      p_description: 'Learn: Ulumul Quran quiz completed',
    });
    setFamilyPoints(p => p + amount);
  }, [userId, familyId]);

  return { totalEarned, familyPoints, addPoints };
}

function getLearnLevel(pts: number) {
  const thresholds = [0, 50, 150, 300, 500, 750, 1000];
  const names = ['Mubtadi', 'Ahlul Tilawah', 'Ahlul Tadabbur', 'Ahlul Amal', 'Ahlul Khair', 'Ulil Albab'];
  let level = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (pts >= thresholds[i]) level = i;
  }
  const next = thresholds[level + 1] ?? thresholds[thresholds.length - 1];
  const curr = thresholds[level];
  const progress = next > curr ? Math.round(((pts - curr) / (next - curr)) * 100) : 100;
  return { level: level + 1, progress, name: names[Math.min(level, names.length - 1)], nextPts: next };
}

const LEVEL_COLORS = ['#2d3a10', '#3d4e18', '#5a6b28', '#7a8f40', '#d4a017', '#b8860b'];

// ── Quiz component ────────────────────────────────────────────────────────────
function Quiz({ category, onClose }: { category: Category; onClose: (earned: number) => void }) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showExpl, setShowExpl] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  const [questions] = useState(() => {
    const q = [...category.questions];
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    return q.slice(0, Math.min(q.length, 6));
  });

  const current = questions[idx];
  const totalQ = questions.length;
  const ptsEarned = correct * 5 + (correct === totalQ ? 10 : 0);

  function handleSelect(i: number) {
    if (selected !== null) return;
    setSelected(i);
    setShowExpl(true);
    if (i === current.answer) setCorrect(c => c + 1);
  }

  function handleNext() {
    if (idx + 1 >= totalQ) { setDone(true); return; }
    setIdx(i => i + 1);
    setSelected(null);
    setShowExpl(false);
  }

  if (done) {
    const pct = Math.round((correct / totalQ) * 100);
    const isPerfect = correct === totalQ;
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-8 text-center">
        <div className="text-6xl mb-4">{isPerfect ? '🏆' : correct >= totalQ / 2 ? '⭐' : '📖'}</div>
        <h2 className="text-2xl font-extrabold text-gray-800 mb-1">
          {isPerfect ? 'Mashaa Allah!' : correct >= totalQ / 2 ? 'Well done!' : 'Keep learning!'}
        </h2>
        <p className="text-gray-500 text-sm mb-6">{correct}/{totalQ} correct · {pct}%</p>
        <div className="bg-[#2d3a10]/10 rounded-2xl px-6 py-4 mb-6 w-full">
          <p className="text-3xl font-extrabold text-[#2d3a10]">+{ptsEarned} AP</p>
          <p className="text-xs text-gray-400 mt-1">{correct} × 5 AP{isPerfect ? ' + 10 perfect bonus' : ''}</p>
          <p className="text-[10px] text-[#2d3a10]/60 mt-0.5 font-semibold">Added to Family Aura Points</p>
        </div>
        <div className="flex gap-3 w-full">
          <button type="button" onClick={() => onClose(ptsEarned)}
            className="flex-1 bg-white border border-gray-200 rounded-2xl py-3 text-sm font-bold text-gray-700">
            Back
          </button>
          <button type="button"
            onClick={() => { setIdx(0); setSelected(null); setShowExpl(false); setCorrect(0); setDone(false); }}
            className="flex-1 rounded-2xl py-3 text-sm font-bold text-white flex items-center justify-center gap-2 batik-sm"
            style={{ background: category.bg }}>
            <RotateCcw size={14} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button type="button" onClick={() => onClose(0)}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <X size={16} className="text-gray-500" />
        </button>
        <div className="flex-1">
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(idx / totalQ) * 100}%`, background: category.bg }} />
          </div>
        </div>
        <span className="text-xs font-bold text-gray-400 flex-shrink-0">{idx + 1}/{totalQ}</span>
      </div>

      <div className="px-4 py-3 flex-1 overflow-y-auto">
        {/* Question card */}
        <div className="rounded-3xl p-5 mb-5 shadow-md batik-overlay" style={{ background: category.bg, minHeight: 100 }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-white/60 uppercase tracking-wider">{category.title}</span>
            <span className="text-[9px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">{category.level}</span>
          </div>
          <p className="text-white font-bold text-base leading-snug">{current.q}</p>
          {current.verse && (
            <span className="inline-block mt-2 text-[9px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">
              Ref: {current.verse}
            </span>
          )}
        </div>

        {/* Options */}
        <div className="space-y-2.5">
          {current.opts.map((opt, i) => {
            const isSelected = selected === i;
            const isCorrect = i === current.answer;
            let bg = 'bg-white border-gray-200';
            let textCol = 'text-gray-800';
            if (selected !== null) {
              if (isCorrect) { bg = 'bg-green-50 border-green-400'; textCol = 'text-green-800'; }
              else if (isSelected) { bg = 'bg-red-50 border-red-400'; textCol = 'text-red-800'; }
              else { bg = 'bg-gray-50 border-gray-200'; textCol = 'text-gray-400'; }
            }
            return (
              <button key={i} type="button" onClick={() => handleSelect(i)}
                className={`w-full border-2 ${bg} rounded-2xl px-4 py-3.5 text-left flex items-center gap-3 transition-all active:scale-[0.98]`}>
                <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold
                  ${selected !== null && isCorrect ? 'border-green-400 bg-green-100' :
                    selected !== null && isSelected ? 'border-red-400 bg-red-100' : 'border-gray-200 bg-gray-50'}`}>
                  {selected !== null && isCorrect ? <CheckCircle size={14} className="text-green-600" /> :
                   selected !== null && isSelected ? <X size={12} className="text-red-500" /> :
                   <span className={textCol}>{String.fromCharCode(65 + i)}</span>}
                </div>
                <span className={`text-sm font-semibold ${textCol} leading-snug`}>{opt}</span>
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {showExpl && (
          <div className={`mt-4 rounded-2xl p-4 border ${selected === current.answer ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <p className="text-xs font-bold mb-1.5 flex items-center gap-1.5">
              {selected === current.answer
                ? <><CheckCircle size={12} className="text-green-600" /><span className="text-green-700">Correct! Alhamdulillah</span></>
                : <><Star size={12} className="text-amber-600" /><span className="text-amber-700">Answer: {current.opts[current.answer]}</span></>}
            </p>
            <p className="text-xs text-gray-700 leading-relaxed">{current.explanation}</p>
          </div>
        )}
      </div>

      {selected !== null && (
        <div className="px-4 pb-6 pt-2">
          <button type="button" onClick={handleNext}
            className="w-full rounded-2xl py-3.5 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md batik-sm"
            style={{ background: category.bg }}>
            {idx + 1 >= totalQ ? 'See Results' : 'Next Question'}
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function LearnPage() {
  const { user, profile } = useAuth();
  const { totalEarned, familyPoints, addPoints } = useLearnPoints(user?.id, profile?.family_id);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [completedCategories, setCompletedCategories] = useState<Set<string>>(new Set());
  const [totalAnswered, setTotalAnswered] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    const cc = localStorage.getItem(`learn_completed_${user.id}`);
    if (cc) setCompletedCategories(new Set(JSON.parse(cc)));
    const ta = localStorage.getItem(`learn_answered_${user.id}`);
    if (ta) setTotalAnswered(parseInt(ta, 10));
  }, [user?.id]);

  async function handleQuizDone(ptsEarned: number, categoryId: string) {
    if (ptsEarned > 0) await addPoints(ptsEarned);
    const newCompleted = new Set(completedCategories).add(categoryId);
    setCompletedCategories(newCompleted);
    if (user?.id) localStorage.setItem(`learn_completed_${user.id}`, JSON.stringify([...newCompleted]));
    const newAnswered = totalAnswered + 6;
    setTotalAnswered(newAnswered);
    if (user?.id) localStorage.setItem(`learn_answered_${user.id}`, String(newAnswered));
    setActiveCategory(null);
  }

  const { level, progress: xpProgress, name: levelName, nextPts } = getLearnLevel(totalEarned);
  const levelColor = LEVEL_COLORS[Math.min(level - 1, LEVEL_COLORS.length - 1)];

  const beginnerCats = CATEGORIES.filter(c => c.level === 'Beginner');
  const intermediateCats = CATEGORIES.filter(c => c.level === 'Intermediate');
  const advancedCats = CATEGORIES.filter(c => c.level === 'Advanced');

  if (activeCategory) {
    return (
      <div className="fixed inset-0 bg-white z-[200] flex flex-col max-w-md mx-auto">
        <Quiz
          category={activeCategory}
          onClose={(earned) => handleQuizDone(earned, activeCategory.id)}
        />
      </div>
    );
  }

  function CategoryCard({ cat }: { cat: Category }) {
    const done = completedCategories.has(cat.id);
    return (
      <button type="button" onClick={() => setActiveCategory(cat)}
        className="w-full bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 text-left active:scale-[0.98] transition-transform shadow-sm">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-inner batik-sm"
          style={{ background: cat.bg }}>
          {cat.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-extrabold text-gray-800 text-base leading-tight">{cat.title}</p>
            {done && <CheckCircle size={14} className="text-green-500 flex-shrink-0" />}
          </div>
          <p className="text-xs text-gray-400 mb-2 leading-tight">{cat.subtitle}</p>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border
              ${cat.level === 'Beginner' ? 'bg-green-50 text-green-700 border-green-200' :
                cat.level === 'Intermediate' ? 'bg-gold/10 text-[#8b6914] border-gold/30' :
                'bg-forest/10 text-forest border-forest/20'}`}>
              {cat.level}
            </span>
            <span className="text-[10px] font-bold text-[#2d3a10]">
              +{Math.min(cat.questions.length, 6) * 5 + 10} AP max
            </span>
          </div>
        </div>
        <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
      </button>
    );
  }

  return (
    <>
      <main className="flex-1 overflow-y-auto hide-scrollbar px-4 py-4 space-y-5 pb-24 page-enter">

        {/* ── Level compact card ── */}
        <div className="rounded-2xl overflow-hidden shadow-sm border border-black/[0.06]"
          style={{ background: `linear-gradient(135deg, ${levelColor} 0%, #1a5c2e 100%)` }}>
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Learn Path</p>
              <p className="text-white font-extrabold text-xl mt-0.5 flex items-center gap-1.5">
                {levelName}
                {levelName === 'Ulil Albab' && <Sparkles size={15} className="text-yellow-300" />}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white/60 text-[9px] font-bold uppercase tracking-wider">Family Aura</p>
              <p className="text-yellow-300 font-extrabold text-lg tabular-nums">{familyPoints.toLocaleString()} AP</p>
            </div>
          </div>
          {/* XP progress bar */}
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-white/50 text-[9px] font-bold">{totalEarned} AP from Learn</p>
              <p className="text-white/50 text-[9px] font-bold">Next: {nextPts} AP</p>
            </div>
            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-yellow-300 transition-all duration-700"
                style={{ width: `${xpProgress}%` }} />
            </div>
          </div>
          {/* Stats row */}
          <div className="flex divide-x divide-white/10 border-t border-white/10">
            <div className="flex-1 text-center px-3 py-2.5">
              <p className="text-white font-extrabold text-base">{totalAnswered}</p>
              <p className="text-white/50 text-[8px] font-bold uppercase">Questions</p>
            </div>
            <div className="flex-1 text-center px-3 py-2.5">
              <p className="text-white font-extrabold text-base">{completedCategories.size}/{CATEGORIES.length}</p>
              <p className="text-white/50 text-[8px] font-bold uppercase">Modules</p>
            </div>
            <div className="flex-1 text-center px-3 py-2.5">
              <p className="text-white font-extrabold text-base">Lv.{level}</p>
              <p className="text-white/50 text-[8px] font-bold uppercase">Level</p>
            </div>
          </div>
        </div>

        {/* ── Path description ── */}
        {(() => {
          const LEVEL_DESCS = [
            { name: 'Mubtadi',        desc: "The Beginner. You are just opening the door to Quran knowledge. Complete daily missions and start your streak to move forward." },
            { name: 'Ahlul Tilawah',  desc: "People of Recitation. You read consistently and write reflections after missions. Keep a 3-day streak + 2 reflections to reach this." },
            { name: 'Ahlul Tadabbur', desc: "People of Reflection. You pause and think about what verses mean — Allah asks: 'Do they not reflect upon the Quran?' (47:24). Reach with 5-day streak + 4 reflections." },
            { name: 'Ahlul Amal',     desc: "People of Action. You turn knowledge into real deeds every day. Reach with a 7-day streak and 6 completed family missions." },
            { name: 'Ahlul Khair',    desc: "People of Goodness. Your consistency and care make you a light in your family. Reach with a 10-day streak + active in family chat." },
            { name: 'Ulil Albab',     desc: "People of Deep Understanding — praised by Allah in Surah Al-Imran 3:190-191. They see His signs everywhere. Reach with a 14-day streak and all levels above." },
          ];
          const current = LEVEL_DESCS[Math.min(level - 1, LEVEL_DESCS.length - 1)];
          return (
            <div className="bg-[#2d3a10]/8 rounded-2xl border border-[#2d3a10]/15 p-4">
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap size={15} className="text-[#2d3a10]" />
                <p className="text-xs font-bold text-[#2d3a10] uppercase tracking-wide">Ulumul Quran Path</p>
              </div>
              {/* Level steps */}
              <div className="flex gap-1.5 mb-3">
                {LEVEL_DESCS.map((l, i) => (
                  <div key={l.name} className={`flex-1 rounded-lg py-1.5 text-center ${i + 1 <= level ? 'bg-[#2d3a10]' : 'bg-gray-100'}`}>
                    <p className={`text-[7px] font-bold truncate px-0.5 ${i + 1 <= level ? 'text-white' : 'text-gray-400'}`}>{l.name}</p>
                  </div>
                ))}
              </div>
              {/* Current level description */}
              <div className="bg-white/70 rounded-xl px-3 py-2.5 border border-[#2d3a10]/10">
                <p className="text-[10px] font-extrabold text-[#2d3a10] mb-0.5">{current.name}</p>
                <p className="text-[11px] text-gray-600 leading-relaxed">{current.desc}</p>
              </div>
            </div>
          );
        })()}

        {/* ── Beginner modules ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={13} className="text-green-600" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Beginner</p>
          </div>
          <div className="space-y-3">
            {beginnerCats.map(cat => <CategoryCard key={cat.id} cat={cat} />)}
          </div>
        </div>

        {/* ── Intermediate modules ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Layers size={13} className="text-amber-600" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Intermediate</p>
          </div>
          <div className="space-y-3">
            {intermediateCats.map(cat => <CategoryCard key={cat.id} cat={cat} />)}
          </div>
        </div>

        {/* ── Advanced modules ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ScrollText size={13} className="text-forest" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Advanced</p>
          </div>
          <div className="space-y-3">
            {advancedCats.map(cat => <CategoryCard key={cat.id} cat={cat} />)}
          </div>
        </div>

        {/* ── Tips ── */}
        <div className="bg-amber-50 rounded-2xl border border-amber-200/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-amber-600" />
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Earn Aura Points</p>
          </div>
          <ul className="space-y-1.5">
            {[
              'Each correct answer = 5 AP (Aura Points)',
              'Perfect score = 10 bonus AP',
              'AP feeds directly into Family Aura Board ranking',
              'Complete all 8 modules to reach Ulil Albab level',
              'Retry anytime — mastery through repetition',
            ].map((tip, i) => (
              <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                <Trophy size={10} className="mt-0.5 flex-shrink-0 text-amber-500" />
                {tip}
              </li>
            ))}
          </ul>
        </div>

      </main>
    </>
  );
}
