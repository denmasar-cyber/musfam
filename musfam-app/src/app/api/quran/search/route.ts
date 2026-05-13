import { NextRequest, NextResponse } from 'next/server';
// Single source of truth: QuranCDN (api.qurancdn.com) — same index as quran.com
// Covers: surah names in Arabic/Latin/English, verse text (Arabic), translations, word-by-word
// When query matches a surah name → return { surah: number } so client shows ayah picker
// When query is a topic/phrase → return verse-level results with translations

// Quran search strategy:
// 1. Surah-name match — check query against known surah names (Latin, English, Arabic, transliteration).
//    If matched, return the first verses of that surah. This covers "baqarah", "Al-Fatiha", "البقرة", etc.
// 2. Topic/verse search — for queries that aren't surah names, use alquran.cloud full-text search
//    (en.sahih for English/topic queries, quran-uthmani for Arabic text queries).
// 3. Fallback — equran.id semantic vector search (covers meaning/Indonesian).

// Static surah name map — all 114 surahs with multiple name forms
// Format: [surah_number, arabic_name, transliteration, english_name]
const SURAH_NAMES: [number, string, string, string][] = [
  [1,'الفاتحة','al-fatihah','the opening'],[2,'البقرة','al-baqarah','the cow'],
  [3,'آل عمران','al-imran','family of imran'],[4,'النساء','an-nisa','the women'],
  [5,'المائدة','al-maidah','the table spread'],[6,'الأنعام','al-anam','the cattle'],
  [7,'الأعراف','al-araf','the heights'],[8,'الأنفال','al-anfal','the spoils of war'],
  [9,'التوبة','at-tawbah','the repentance'],[10,'يونس','yunus','jonah'],
  [11,'هود','hud','hud'],[12,'يوسف','yusuf','joseph'],
  [13,'الرعد','ar-rad','the thunder'],[14,'إبراهيم','ibrahim','abraham'],
  [15,'الحجر','al-hijr','the rocky tract'],[16,'النحل','an-nahl','the bee'],
  [17,'الإسراء','al-isra','the night journey'],[18,'الكهف','al-kahf','the cave'],
  [19,'مريم','maryam','mary'],[20,'طه','taha','ta-ha'],
  [21,'الأنبياء','al-anbiya','the prophets'],[22,'الحج','al-hajj','the pilgrimage'],
  [23,'المؤمنون','al-muminun','the believers'],[24,'النور','an-nur','the light'],
  [25,'الفرقان','al-furqan','the criterion'],[26,'الشعراء','ash-shuara','the poets'],
  [27,'النمل','an-naml','the ant'],[28,'القصص','al-qasas','the stories'],
  [29,'العنكبوت','al-ankabut','the spider'],[30,'الروم','ar-rum','the romans'],
  [31,'لقمان','luqman','luqman'],[32,'السجدة','as-sajdah','the prostration'],
  [33,'الأحزاب','al-ahzab','the combined forces'],[34,'سبأ','saba','sheba'],
  [35,'فاطر','fatir','originator'],[36,'يس','ya-sin','ya sin'],
  [37,'الصافات','as-saffat','those ranged in rows'],[38,'ص','sad','the letter sad'],
  [39,'الزمر','az-zumar','the groups'],[40,'غافر','ghafir','the forgiver'],
  [41,'فصلت','fussilat','explained in detail'],[42,'الشورى','ash-shura','the consultation'],
  [43,'الزخرف','az-zukhruf','the ornaments of gold'],[44,'الدخان','ad-dukhan','the smoke'],
  [45,'الجاثية','al-jathiyah','the crouching'],[46,'الأحقاف','al-ahqaf','the wind-curved sandhills'],
  [47,'محمد','muhammad','muhammad'],[48,'الفتح','al-fath','the victory'],
  [49,'الحجرات','al-hujurat','the rooms'],[50,'ق','qaf','the letter qaf'],
  [51,'الذاريات','adh-dhariyat','the winnowing winds'],[52,'الطور','at-tur','the mount'],
  [53,'النجم','an-najm','the star'],[54,'القمر','al-qamar','the moon'],
  [55,'الرحمن','ar-rahman','the beneficent'],[56,'الواقعة','al-waqiah','the inevitable'],
  [57,'الحديد','al-hadid','the iron'],[58,'المجادلة','al-mujadila','the pleading woman'],
  [59,'الحشر','al-hashr','the exile'],[60,'الممتحنة','al-mumtahanah','she that is to be examined'],
  [61,'الصف','as-saf','the ranks'],[62,'الجمعة','al-jumuah','the congregation'],
  [63,'المنافقون','al-munafiqun','the hypocrites'],[64,'التغابن','at-taghabun','the mutual disillusion'],
  [65,'الطلاق','at-talaq','the divorce'],[66,'التحريم','at-tahrim','the prohibition'],
  [67,'الملك','al-mulk','the sovereignty'],[68,'القلم','al-qalam','the pen'],
  [69,'الحاقة','al-haqqah','the reality'],[70,'المعارج','al-maarij','the ascending stairways'],
  [71,'نوح','nuh','noah'],[72,'الجن','al-jinn','the jinn'],
  [73,'المزمل','al-muzzammil','the enshrouded one'],[74,'المدثر','al-muddaththir','the cloaked one'],
  [75,'القيامة','al-qiyamah','the resurrection'],[76,'الإنسان','al-insan','man'],
  [77,'المرسلات','al-mursalat','the emissaries'],[78,'النبأ','an-naba','the tidings'],
  [79,'النازعات','an-naziat','those who drag forth'],[80,'عبس','abasa','he frowned'],
  [81,'التكوير','at-takwir','the overthrowing'],[82,'الانفطار','al-infitar','the cleaving'],
  [83,'المطففين','al-mutaffifin','the defrauding'],[84,'الانشقاق','al-inshiqaq','the sundering'],
  [85,'البروج','al-buruj','the mansions of the stars'],[86,'الطارق','at-tariq','the morning star'],
  [87,'الأعلى','al-ala','the most high'],[88,'الغاشية','al-ghashiyah','the overwhelming'],
  [89,'الفجر','al-fajr','the dawn'],[90,'البلد','al-balad','the city'],
  [91,'الشمس','ash-shams','the sun'],[92,'الليل','al-layl','the night'],
  [93,'الضحى','ad-duhaa','the morning hours'],[94,'الشرح','ash-sharh','the relief'],
  [95,'التين','at-tin','the fig'],[96,'العلق','al-alaq','the clot'],
  [97,'القدر','al-qadr','the power'],[98,'البينة','al-bayyinah','the clear proof'],
  [99,'الزلزلة','az-zalzalah','the earthquake'],[100,'العاديات','al-adiyat','the courser'],
  [101,'القارعة','al-qariah','the calamity'],[102,'التكاثر','at-takathur','the rivalry in world increase'],
  [103,'العصر','al-asr','the declining day'],[104,'الهمزة','al-humazah','the traducer'],
  [105,'الفيل','al-fil','the elephant'],[106,'قريش','quraysh','quraysh'],
  [107,'الماعون','al-maun','the small kindnesses'],[108,'الكوثر','al-kawthar','the abundance'],
  [109,'الكافرون','al-kafirun','the disbelievers'],[110,'النصر','an-nasr','the divine support'],
  [111,'المسد','al-masad','the palm fiber'],[112,'الإخلاص','al-ikhlas','the sincerity'],
  [113,'الفلق','al-falaq','the daybreak'],[114,'الناس','an-nas','mankind'],
];

function matchSurah(q: string): number | null {
  const norm = q.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF\s-]/g, '').trim();
  for (const [num, arabic, translit, english] of SURAH_NAMES) {
    // Exact or partial match on transliteration (e.g. "baqarah" → "al-baqarah")
    if (translit.includes(norm) || norm.includes(translit.replace('al-','').replace('an-','').replace('ar-','').replace('as-','').replace('at-','').replace('ad-','').replace('az-','').replace('ash-','').replace('adh-',''))) {
      return num;
    }
    // English name match
    if (english.includes(norm) || norm.includes(english.split(' ')[0])) {
      return num;
    }
    // Arabic name match
    if (arabic.includes(norm) || norm.includes(arabic.replace('ال',''))) {
      return num;
    }
  }
  // Number match e.g. "surah 2" or just "2"
  const numMatch = norm.match(/\b(\d{1,3})\b/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= 114) return n;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();

  if (!query) {
    return NextResponse.json({ error: 'Missing q parameter' }, { status: 400 });
  }

  const isArabic = /[\u0600-\u06FF]/.test(query);

  // ── 1. Surah name match — check if query is a surah name in any script/language
  const surahNum = matchSurah(query);
  if (surahNum) {
    try {
      // Fetch first 7 verses of the matched surah with Arabic + English translation
      const [arRes, enRes] = await Promise.all([
        fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/quran-uthmani`, { signal: AbortSignal.timeout(5000), next: { revalidate: 3600 } }),
        fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/en.sahih`, { signal: AbortSignal.timeout(5000), next: { revalidate: 3600 } }),
      ]);
      if (arRes.ok && enRes.ok) {
        const [arData, enData] = await Promise.all([arRes.json(), enRes.json()]);
        const arAyahs: Array<{ numberInSurah: number; text: string }> = arData?.data?.ayahs || [];
        const enAyahs: Array<{ numberInSurah: number; text: string }> = enData?.data?.ayahs || [];
        const enMap = new Map(enAyahs.map(a => [a.numberInSurah, a.text]));
        const results = arAyahs.slice(0, 10).map(a => ({
          verse_key: `${surahNum}:${a.numberInSurah}`,
          text: a.text,
          translations: [{ text: enMap.get(a.numberInSurah) || '', name: 'Sahih International' }],
        }));
        return NextResponse.json({ search: { results, total: arAyahs.length, surah: surahNum } });
      }
    } catch { /* fall through */ }
  }

  // ── 2. QuranCDN full-text search (verse text, translations, word-by-word)
  // translations=131 → Sahih International (EN), 33 → Kemenag (ID)
  try {
    const qfUrl = `https://api.qurancdn.com/api/qdc/search?q=${encodeURIComponent(query)}&size=20&page=1&translations=131,33`;
    const res = await fetch(qfUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Musfam/1.0' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const data = await res.json();
      const results: Array<{
        verse_key: string;
        text_uthmani?: string;
        translations?: Array<{ text: string; resource_name: string }>;
      }> = data?.search?.results || [];
      if (results.length > 0) {
        return NextResponse.json({
          search: {
            results: results.map(r => ({
              verse_key: r.verse_key,
              text: r.text_uthmani || '',
              translations: (r.translations || []).map(t => ({
                text: t.text?.replace(/<[^>]*>/g, '').trim() || '',
                name: t.resource_name || '',
              })),
            })),
            total: data?.search?.total_results || results.length,
          },
        });
      }
    }
  } catch { /* timeout or network */ }

  return NextResponse.json({ search: { results: [], total: 0 } });
}
