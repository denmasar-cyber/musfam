import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This route populates the verse_cache table with all 6236 verses.
// Call once: GET /api/quran/seed-cache?secret=YOUR_SECRET
// It fetches from alquran.cloud in batches (one surah at a time).
// Progress is shown in the response stream.

const SEED_SECRET = process.env.SEED_SECRET || 'musfam-seed-2024';

export async function GET(request: NextRequest) {
  const secret = new URL(request.url).searchParams.get('secret');
  if (secret !== SEED_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Check how many rows already in cache
  const { count: existing } = await supabase
    .from('verse_cache')
    .select('*', { count: 'exact', head: true });

  if ((existing ?? 0) >= 6236) {
    return NextResponse.json({ message: 'verse_cache already populated', count: existing });
  }

  const SURAH_NAMES: Record<number, string> = {
    1:'Al-Fatihah',2:'Al-Baqarah',3:'Ali \'Imran',4:'An-Nisa',5:'Al-Ma\'idah',
    6:'Al-An\'am',7:'Al-A\'raf',8:'Al-Anfal',9:'At-Tawbah',10:'Yunus',
    11:'Hud',12:'Yusuf',13:'Ar-Ra\'d',14:'Ibrahim',15:'Al-Hijr',
    16:'An-Nahl',17:'Al-Isra',18:'Al-Kahf',19:'Maryam',20:'Ta-Ha',
    21:'Al-Anbiya',22:'Al-Hajj',23:'Al-Mu\'minun',24:'An-Nur',25:'Al-Furqan',
    26:'Ash-Shu\'ara',27:'An-Naml',28:'Al-Qasas',29:'Al-\'Ankabut',30:'Ar-Rum',
    31:'Luqman',32:'As-Sajdah',33:'Al-Ahzab',34:'Saba',35:'Fatir',
    36:'Ya-Sin',37:'As-Saffat',38:'Sad',39:'Az-Zumar',40:'Ghafir',
    41:'Fussilat',42:'Ash-Shura',43:'Az-Zukhruf',44:'Ad-Dukhan',45:'Al-Jathiyah',
    46:'Al-Ahqaf',47:'Muhammad',48:'Al-Fath',49:'Al-Hujurat',50:'Qaf',
    51:'Adh-Dhariyat',52:'At-Tur',53:'An-Najm',54:'Al-Qamar',55:'Ar-Rahman',
    56:'Al-Waqi\'ah',57:'Al-Hadid',58:'Al-Mujadila',59:'Al-Hashr',60:'Al-Mumtahanah',
    61:'As-Saf',62:'Al-Jumu\'ah',63:'Al-Munafiqun',64:'At-Taghabun',65:'At-Talaq',
    66:'At-Tahrim',67:'Al-Mulk',68:'Al-Qalam',69:'Al-Haqqah',70:'Al-Ma\'arij',
    71:'Nuh',72:'Al-Jinn',73:'Al-Muzzammil',74:'Al-Muddaththir',75:'Al-Qiyamah',
    76:'Al-Insan',77:'Al-Mursalat',78:'An-Naba',79:'An-Nazi\'at',80:'\'Abasa',
    81:'At-Takwir',82:'Al-Infitar',83:'Al-Mutaffifin',84:'Al-Inshiqaq',85:'Al-Buruj',
    86:'At-Tariq',87:'Al-A\'la',88:'Al-Ghashiyah',89:'Al-Fajr',90:'Al-Balad',
    91:'Ash-Shams',92:'Al-Layl',93:'Ad-Duha',94:'Ash-Sharh',95:'At-Tin',
    96:'Al-\'Alaq',97:'Al-Qadr',98:'Al-Bayyinah',99:'Az-Zalzalah',100:'Al-\'Adiyat',
    101:'Al-Qari\'ah',102:'At-Takathur',103:'Al-\'Asr',104:'Al-Humazah',105:'Al-Fil',
    106:'Quraysh',107:'Al-Ma\'un',108:'Al-Kawthar',109:'Al-Kafirun',110:'An-Nasr',
    111:'Al-Masad',112:'Al-Ikhlas',113:'Al-Falaq',114:'An-Nas',
  };

  let totalInserted = 0;
  const errors: string[] = [];

  for (let surah = 1; surah <= 114; surah++) {
    try {
      // Fetch Arabic (uthmani) and English (Pickthall) in parallel
      const [arRes, enRes] = await Promise.all([
        fetch(`https://api.alquran.cloud/v1/surah/${surah}/quran-uthmani`, { cache: 'no-store' }),
        fetch(`https://api.alquran.cloud/v1/surah/${surah}/en.pickthall`, { cache: 'no-store' }),
      ]);

      if (!arRes.ok || !enRes.ok) {
        errors.push(`Surah ${surah}: fetch failed`);
        continue;
      }

      const [arData, enData] = await Promise.all([arRes.json(), enRes.json()]);
      const arAyahs: Array<{ numberInSurah: number; text: string }> = arData?.data?.ayahs || [];
      const enAyahs: Array<{ numberInSurah: number; text: string }> = enData?.data?.ayahs || [];

      const enMap = new Map<number, string>();
      for (const a of enAyahs) enMap.set(a.numberInSurah, a.text);

      const rows = arAyahs.map(a => ({
        verse_key: `${surah}:${a.numberInSurah}`,
        chapter_number: surah,
        verse_number: a.numberInSurah,
        surah_name: SURAH_NAMES[surah] || `Surah ${surah}`,
        text_arabic: a.text,
        text_uthmani: a.text,
        translation_en: enMap.get(a.numberInSurah) || '',
      }));

      // Upsert in batches of 100
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error } = await supabase
          .from('verse_cache')
          .upsert(batch, { onConflict: 'verse_key' });
        if (error) errors.push(`Surah ${surah} batch ${i}: ${error.message}`);
        else totalInserted += batch.length;
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      errors.push(`Surah ${surah}: ${String(e)}`);
    }
  }

  return NextResponse.json({
    message: 'Seeding complete',
    totalInserted,
    errors: errors.length > 0 ? errors : undefined,
  });
}
