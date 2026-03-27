export interface QuranVerse {
  verse_key: string;
  text_uthmani: string;
  translation: string;
  surah_name: string;
}

const FALLBACK_VERSES: QuranVerse[] = [
  {
    verse_key: '112:1',
    text_uthmani: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
    translation: 'Say, "He is Allah, [who is] One."',
    surah_name: 'Al-Ikhlas',
  },
  {
    verse_key: '112:2',
    text_uthmani: 'ٱللَّهُ ٱلصَّمَدُ',
    translation: 'Allah, the Eternal Refuge.',
    surah_name: 'Al-Ikhlas',
  },
  {
    verse_key: '1:1',
    text_uthmani: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
    translation: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.',
    surah_name: 'Al-Fatiha',
  },
  {
    verse_key: '1:2',
    text_uthmani: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ',
    translation: 'All praise is due to Allah, Lord of the worlds.',
    surah_name: 'Al-Fatiha',
  },
  {
    verse_key: '2:152',
    text_uthmani: 'فَٱذْكُرُونِىٓ أَذْكُرْكُمْ وَٱشْكُرُوا۟ لِى وَلَا تَكْفُرُونِ',
    translation: 'So remember Me; I will remember you. And be grateful to Me and do not deny Me.',
    surah_name: 'Al-Baqarah',
  },
  {
    verse_key: '2:153',
    text_uthmani: 'يَـٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱسْتَعِينُوا۟ بِٱلصَّبْرِ وَٱلصَّلَوٰةِ ۚ إِنَّ ٱللَّهَ مَعَ ٱلصَّـٰبِرِينَ',
    translation: 'O you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.',
    surah_name: 'Al-Baqarah',
  },
  {
    verse_key: '2:186',
    text_uthmani: 'وَإِذَا سَأَلَكَ عِبَادِى عَنِّى فَإِنِّى قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ ٱلدَّاعِ إِذَا دَعَانِ',
    translation: 'And when My servants ask you concerning Me - indeed I am near. I respond to the invocation of the supplicant when he calls upon Me.',
    surah_name: 'Al-Baqarah',
  },
  {
    verse_key: '3:139',
    text_uthmani: 'وَلَا تَهِنُوا۟ وَلَا تَحْزَنُوا۟ وَأَنتُمُ ٱلْأَعْلَوْنَ إِن كُنتُم مُّؤْمِنِينَ',
    translation: 'So do not weaken and do not grieve, and you will be superior if you are true believers.',
    surah_name: 'Ali Imran',
  },
  {
    verse_key: '13:28',
    text_uthmani: 'أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ',
    translation: 'Verily, in the remembrance of Allah do hearts find rest.',
    surah_name: "Ar-Ra'd",
  },
  {
    verse_key: '94:5',
    text_uthmani: 'فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا',
    translation: 'For indeed, with hardship will be ease.',
    surah_name: 'Ash-Sharh',
  },
  {
    verse_key: '94:6',
    text_uthmani: 'إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا',
    translation: 'Indeed, with hardship will be ease.',
    surah_name: 'Ash-Sharh',
  },
  {
    verse_key: '55:13',
    text_uthmani: 'فَبِأَىِّ ءَالَآءِ رَبِّكُمَا تُكَذِّبَانِ',
    translation: 'So which of the favors of your Lord would you deny?',
    surah_name: 'Ar-Rahman',
  },
  {
    verse_key: '93:5',
    text_uthmani: 'وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰٓ',
    translation: 'And your Lord is going to give you, and you will be satisfied.',
    surah_name: 'Ad-Duha',
  },
  {
    verse_key: '65:3',
    text_uthmani: 'وَمَن يَتَوَكَّلْ عَلَى ٱللَّهِ فَهُوَ حَسْبُهُۥٓ',
    translation: 'And whoever relies upon Allah - then He is sufficient for him.',
    surah_name: 'At-Talaq',
  },
  {
    verse_key: '29:69',
    text_uthmani: 'وَٱلَّذِينَ جَـٰهَدُوا۟ فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا',
    translation: 'And those who strive for Us - We will surely guide them to Our ways.',
    surah_name: 'Al-Ankabut',
  },
  {
    verse_key: '16:97',
    text_uthmani: 'مَنْ عَمِلَ صَـٰلِحًا مِّن ذَكَرٍ أَوْ أُنثَىٰ وَهُوَ مُؤْمِنٌ فَلَنُحْيِيَنَّهُۥ حَيَوٰةً طَيِّبَةً',
    translation: 'Whoever does righteousness, whether male or female, while being a believer - We will surely cause them to live a good life.',
    surah_name: 'An-Nahl',
  },
  {
    verse_key: '39:53',
    text_uthmani: 'قُلْ يَـٰعِبَادِىَ ٱلَّذِينَ أَسْرَفُوا۟ عَلَىٰٓ أَنفُسِهِمْ لَا تَقْنَطُوا۟ مِن رَّحْمَةِ ٱللَّهِ',
    translation: 'Say, "O My servants who have transgressed against themselves, do not despair of the mercy of Allah."',
    surah_name: 'Az-Zumar',
  },
  {
    verse_key: '49:13',
    text_uthmani: 'إِنَّ أَكْرَمَكُمْ عِندَ ٱللَّهِ أَتْقَىٰكُمْ',
    translation: 'Indeed, the most noble of you in the sight of Allah is the most righteous of you.',
    surah_name: 'Al-Hujurat',
  },
  {
    verse_key: '31:17',
    text_uthmani: 'يَـٰبُنَىَّ أَقِمِ ٱلصَّلَوٰةَ وَأْمُرْ بِٱلْمَعْرُوفِ وَٱنْهَ عَنِ ٱلْمُنكَرِ وَٱصْبِرْ عَلَىٰ مَآ أَصَابَكَ',
    translation: 'O my son, establish prayer, enjoin what is right, forbid what is wrong, and be patient over what befalls you.',
    surah_name: 'Luqman',
  },
  {
    verse_key: '17:23',
    text_uthmani: 'وَقَضَىٰ رَبُّكَ أَلَّا تَعْبُدُوٓا۟ إِلَّآ إِيَّاهُ وَبِٱلْوَٰلِدَيْنِ إِحْسَـٰنًا',
    translation: 'And your Lord has decreed that you not worship except Him, and to parents, good treatment.',
    surah_name: 'Al-Isra',
  },
];

const REFLECTION_REFS = [
  { chapter: 112, verse: 1 }, { chapter: 112, verse: 2 },
  { chapter: 1, verse: 1 }, { chapter: 1, verse: 2 },
  { chapter: 2, verse: 152 }, { chapter: 2, verse: 153 }, { chapter: 2, verse: 186 },
  { chapter: 3, verse: 139 }, { chapter: 13, verse: 28 },
  { chapter: 94, verse: 5 }, { chapter: 94, verse: 6 },
  { chapter: 55, verse: 13 }, { chapter: 93, verse: 5 },
  { chapter: 65, verse: 3 }, { chapter: 29, verse: 69 },
  { chapter: 16, verse: 97 }, { chapter: 39, verse: 53 },
  { chapter: 49, verse: 13 }, { chapter: 31, verse: 17 }, { chapter: 17, verse: 23 },
];

export function getRandomVerseRef() {
  return REFLECTION_REFS[Math.floor(Math.random() * REFLECTION_REFS.length)];
}

export async function fetchVerse(chapter: number, verse: number): Promise<QuranVerse | null> {
  try {
    const res = await fetch(`/api/quran?chapter=${chapter}&verse=${verse}`);
    if (res.ok) {
      const data = await res.json();
      if (data.text_uthmani && data.translation) {
        const fallback = FALLBACK_VERSES.find(v => v.verse_key === `${chapter}:${verse}`);
        return {
          verse_key: data.verse_key,
          text_uthmani: data.text_uthmani,
          translation: data.translation,
          surah_name: fallback?.surah_name || `Surah ${chapter}`,
        };
      }
    }
  } catch {
    // API gagal, pakai fallback
  }

  // Fallback ke data lokal
  const match = FALLBACK_VERSES.find(v => v.verse_key === `${chapter}:${verse}`);
  return match || FALLBACK_VERSES[Math.floor(Math.random() * FALLBACK_VERSES.length)];
}
