'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  getDailyMission, completeMission, hasCompletedDailyMission,
  getFamilyPoints, uploadProofImage,
  DailyMission,
} from '@/lib/store';
import { Send, BookOpen, X, Loader2, CheckCircle, Trash2, Diamond, Users, ArrowUpRight, ImageIcon, Mic, MicOff, Video, ChevronLeft, CornerUpLeft } from 'lucide-react';
import VideoCallModal from '@/components/VideoCallModal';
import RiverLoading from '@/components/RiverLoading';
import LoadingBlock from '@/components/LoadingBlock';
import { useSwipeDown } from '@/hooks/useSwipeDown';

interface ChatMessage {
  id: string;
  family_id: string;
  user_id: string;
  sender_name: string;
  sender_role: 'parent' | 'child';
  content: string;
  created_at: string;
}

interface OnlineMember {
  user_id: string;
  name: string;
  role: 'parent' | 'child';
}

interface VerseOfDay {
  verse_key: string;
  text_arabic: string;
  translation: string;
  surah_name: string;
  ayah_number: string;
}


// Surah transliteration names (index 0 = surah 1)
const SURAH_TRANSLITERATIONS = [
  '','Al-Fatihah','Al-Baqarah','Ali \'Imran','An-Nisa','Al-Ma\'idah','Al-An\'am','Al-A\'raf','Al-Anfal','At-Tawbah','Yunus',
  'Hud','Yusuf','Ar-Ra\'d','Ibrahim','Al-Hijr','An-Nahl','Al-Isra','Al-Kahf','Maryam','Ta-Ha',
  'Al-Anbiya','Al-Hajj','Al-Mu\'minun','An-Nur','Al-Furqan','Ash-Shu\'ara','An-Naml','Al-Qasas','Al-\'Ankabut','Ar-Rum',
  'Luqman','As-Sajdah','Al-Ahzab','Saba','Fatir','Ya-Sin','As-Saffat','Sad','Az-Zumar','Ghafir',
  'Fussilat','Ash-Shura','Az-Zukhruf','Ad-Dukhan','Al-Jathiyah','Al-Ahqaf','Muhammad','Al-Fath','Al-Hujurat','Qaf',
  'Adh-Dhariyat','At-Tur','An-Najm','Al-Qamar','Ar-Rahman','Al-Waqi\'ah','Al-Hadid','Al-Mujadila','Al-Hashr','Al-Mumtahanah',
  'As-Saf','Al-Jumu\'ah','Al-Munafiqun','At-Taghabun','At-Talaq','At-Tahrim','Al-Mulk','Al-Qalam','Al-Haqqah','Al-Ma\'arij',
  'Nuh','Al-Jinn','Al-Muzzammil','Al-Muddaththir','Al-Qiyamah','Al-Insan','Al-Mursalat','An-Naba','An-Nazi\'at','\'Abasa',
  'At-Takwir','Al-Infitar','Al-Mutaffifin','Al-Inshiqaq','Al-Buruj','At-Tariq','Al-A\'la','Al-Ghashiyah','Al-Fajr','Al-Balad',
  'Ash-Shams','Al-Layl','Ad-Duhaa','Ash-Sharh','At-Tin','Al-\'Alaq','Al-Qadr','Al-Bayyinah','Az-Zalzalah','Al-\'Adiyat',
  'Al-Qari\'ah','At-Takathur','Al-\'Asr','Al-Humazah','Al-Fil','Quraysh','Al-Ma\'un','Al-Kawthar','Al-Kafirun','An-Nasr',
  'Al-Masad','Al-Ikhlas','Al-Falaq','An-Nas',
];

function verseKeyToLabel(key: string): string {
  const [surahStr, ayahStr] = key.split(':');
  const surahNum = parseInt(surahStr, 10);
  const name = SURAH_TRANSLITERATIONS[surahNum] || `Surah ${surahNum}`;
  return `${name} : ${ayahStr}`;
}

const HIJRI_MONTHS = [
  'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani",
  'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah',
];

const GREGORIAN_MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function gregorianToHijri(date: Date): { day: number; month: number; year: number; monthName: string } {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const jd = Math.floor((1461 * (y + 4800 + Math.floor((m - 14) / 12))) / 4)
    + Math.floor((367 * (m - 2 - 12 * Math.floor((m - 14) / 12))) / 12)
    - Math.floor((3 * Math.floor((y + 4900 + Math.floor((m - 14) / 12)) / 100)) / 4)
    + d - 32075;
  const l = jd - 1948440 + 10632, n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719)
    + Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
    - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l3) / 709);
  const day = l3 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { day, month, year, monthName: HIJRI_MONTHS[month - 1] ?? '' };
}

function getDailyVerseKey(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun … 6=Sat
  const weekOfYear = Math.floor((+now - +new Date(now.getFullYear(), 0, 1)) / 604800000);

  // 7 daily themes × multiple verse options per theme.
  // Day theme stays consistent (e.g. Monday is always Gratitude) so family
  // members can discuss the same topic. Week number rotates the verse.
  const THEMES: Record<number, string[]> = {
    0: ['2:255','65:3','3:173','4:81','8:2','58:22','67:1'],          // Sunday  — Tawakkul (Trust in Allah)
    1: ['14:7','55:13','93:11','2:152','27:19','17:3','76:9'],        // Monday  — Shukr (Gratitude)
    2: ['4:103','20:14','29:45','2:45','23:1','17:78','62:9'],        // Tuesday — Salah (Prayer)
    3: ['31:14','17:23','17:24','3:103','49:10','4:36','9:128'],      // Wednesday — Usrah (Family)
    4: ['2:153','3:200','2:177','3:139','39:10','16:127','70:5'],     // Thursday — Sabr (Patience)
    5: ['2:261','57:7','76:8','2:177','93:9','64:16','3:92'],        // Friday  — Sadaqah (Charity) — Jumu'ah
    6: ['47:24','4:82','38:29','96:1','73:4','17:9','59:21'],        // Saturday — Tadabbur (Reflection)
  };

  const pool = THEMES[dayOfWeek] ?? THEMES[0];
  return pool[weekOfYear % pool.length];
}

// ── Weather condition → contextual Quran verse ──────────────────────────────
function getWeatherVerse(wttrCode: number): { label: string; arabic: string; translation: string } {
  // wttr.in weatherCode: 395,389,386,377,374,371,368,365,362,359,356,353,350,338,335,332,329,326,323,320,317,314,311,308,305,302,299,296,293,284,281,278,266,263,260,248,230,227,200,185,182,179,176
  // Severe / thunderstorm / blizzard → disaster dua
  if (wttrCode >= 386 || wttrCode === 200) return {
    label: 'Supplication in Hardship',
    arabic: 'رَبَّنَا لَا تُؤَاخِذۡنَآ إِن نَّسِينَآ أَوۡ أَخۡطَأۡنَا',
    translation: 'Our Lord, do not take us to task if we forget or make mistakes. (Al-Baqarah 2:286)',
  };
  // Rain / drizzle
  if (wttrCode >= 263 && wttrCode <= 384) return {
    label: 'Rain — a Sign of Allah\'s Mercy',
    arabic: 'وَنَزَّلۡنَا مِنَ ٱلسَّمَآءِ مَآءً مُّبَٰرَكاً',
    translation: 'And We sent down from the sky blessed water. (Qaf 50:9)',
  };
  // Snow / ice
  if (wttrCode >= 179 && wttrCode <= 260) return {
    label: 'Marvels of Allah\'s Creation',
    arabic: 'أَلَمۡ تَرَ أَنَّ ٱللَّهَ أَنزَلَ مِنَ ٱلسَّمَآءِ مَآءً',
    translation: 'Do you not see that Allah sends down water from the sky? (Fatir 35:27)',
  };
  // Fog / mist / haze
  if (wttrCode === 143 || wttrCode === 248 || wttrCode === 260) return {
    label: 'Signs for Those Who Reflect',
    arabic: 'إِنَّ فِى ذَٰلِكَ لَءَايَٰتٍ لِّقَوۡمٍ يَتَفَكَّرُونَ',
    translation: 'Indeed in that are signs for a people who give thought. (Ar-Ra\'d 13:3)',
  };
  // Overcast / cloudy
  if (wttrCode >= 113 && wttrCode <= 122) return {
    label: 'Allah\'s Beautiful Creation',
    arabic: 'هُوَ ٱلَّذِى يُرِيكُمُ ٱلۡبَرۡقَ خَوۡفاً وَطَمَعاً',
    translation: 'It is He who shows you lightning, causing fear and aspiration. (Ar-Ra\'d 13:12)',
  };
  // Sunny / clear
  return {
    label: 'Gratitude for Today\'s Blessing',
    arabic: 'فَبِأَيِّ ءَالَآءِ رَبِّكُمَا تُكَذِّبَانِ',
    translation: 'Then which of the favors of your Lord would you deny? (Ar-Rahman 55:13)',
  };
}

// wttr.in condition code → emoji icon
function wttrIcon(code: number): string {
  if (code === 113) return '☀️';
  if (code === 116) return '🌤️';
  if (code === 119 || code === 122) return '☁️';
  if (code === 143 || code === 248 || code === 260) return '🌫️';
  if (code >= 263 && code <= 299) return '🌦️';
  if (code >= 302 && code <= 359) return '🌧️';
  if (code >= 362 && code <= 395) return '⛈️';
  if (code >= 179 && code <= 230) return '❄️';
  return '🌡️';
}

interface WeatherData {
  temp: number;
  code: number;
  description: string;
  icon: string;
  city: string;
}

const POPULAR_CITIES = [
  'Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Makassar',
  'Kuala Lumpur', 'Singapore', 'Riyadh', 'Cairo', 'Istanbul',
  'London', 'New York', 'Sydney', 'Dubai', 'Karachi',
];

async function fetchWttr(city: string): Promise<WeatherData | null> {
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
    if (!res.ok) return null;
    const d = await res.json();
    const cur = d?.current_condition?.[0];
    if (!cur) return null;
    const code = Number(cur.weatherCode);
    return {
      temp: Number(cur.temp_C),
      code,
      description: cur.weatherDesc?.[0]?.value || 'Unknown',
      icon: wttrIcon(code),
      city,
    };
  } catch { return null; }
}

function WeatherBar() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [loadingCity, setLoadingCity] = useState(false);
  const [savedCity, setSavedCity] = useState<string>(() =>
    (typeof window !== 'undefined' ? localStorage.getItem('musfam_weather_city') : null) ?? ''
  );

  useEffect(() => {
    const city = savedCity;
    if (city) {
      // Use saved city
      const cacheKey = `musfam_weather_${city}_${new Date().toISOString().slice(0, 13)}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) { try { setWeather(JSON.parse(cached)); return; } catch { /* ignore */ } }
      fetchWttr(city).then(w => {
        if (w) { setWeather(w); sessionStorage.setItem(cacheKey, JSON.stringify(w)); }
      });
    } else {
      // Auto-detect via geolocation → reverse geocode city name
      navigator.geolocation?.getCurrentPosition(
        pos => {
          const { latitude, longitude } = pos.coords;
          // Use lat/lon directly with wttr.in
          const query = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
          const cacheKey = `musfam_weather_geo_${new Date().toISOString().slice(0, 13)}`;
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) { try { setWeather(JSON.parse(cached)); return; } catch { /* ignore */ } }
          fetchWttr(query).then(w => {
            if (w) {
              // Try to get area name from wttr nearest_area
              fetch(`https://wttr.in/${query}?format=j1`)
                .then(r => r.ok ? r.json() : null)
                .then(d => {
                  const area = d?.nearest_area?.[0]?.areaName?.[0]?.value || '';
                  const country = d?.nearest_area?.[0]?.country?.[0]?.value || '';
                  const label = area ? `${area}${country ? ', ' + country : ''}` : query;
                  const wWithCity = { ...w, city: label };
                  setWeather(wWithCity);
                  sessionStorage.setItem(cacheKey, JSON.stringify(wWithCity));
                })
                .catch(() => { setWeather(w); sessionStorage.setItem(cacheKey, JSON.stringify(w)); });
            }
          });
        },
        () => {} // geolocation denied — just show nothing
      );
    }
  }, [savedCity]);

  async function handleSetCity(city: string) {
    setLoadingCity(true);
    const w = await fetchWttr(city);
    if (w) {
      const key = `musfam_weather_${city}_${new Date().toISOString().slice(0, 13)}`;
      sessionStorage.setItem(key, JSON.stringify(w));
      setWeather(w);
      setSavedCity(city);
      localStorage.setItem('musfam_weather_city', city);
    }
    setLoadingCity(false);
    setShowCityPicker(false);
    setCityInput('');
  }

  if (!weather && !showCityPicker) return (
    <div className="mx-4 mt-3">
      <button type="button" onClick={() => setShowCityPicker(true)}
        className="w-full bg-white border border-black/[0.06] rounded-2xl px-4 py-2.5 flex items-center gap-2 text-left shadow-sm">
        <span className="text-lg">🌤️</span>
        <p className="text-[11px] text-gray-400 font-medium flex-1">Tap to set your city for weather &amp; contextual Quran verse</p>
      </button>
    </div>
  );

  const verse = weather ? getWeatherVerse(weather.code) : null;
  const isDisaster = weather ? (weather.code >= 386 || weather.code === 200) : false;

  return (
    <div className="mx-4 mt-3">
      {showCityPicker ? (
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-[#2d3a10] batik-overlay flex items-center gap-2">
            <span className="text-lg">🌍</span>
            <p className="text-white text-[11px] font-bold flex-1">Choose your city</p>
            <button type="button" onClick={() => setShowCityPicker(false)} className="text-white/60 text-xs">✕</button>
          </div>
          <div className="p-3 space-y-2">
            <div className="flex gap-2">
              <input
                aria-label="City name"
                placeholder="Type a city name…"
                value={cityInput}
                onChange={e => setCityInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && cityInput.trim()) handleSetCity(cityInput.trim()); }}
                className="flex-1 rounded-xl border border-cream-dark bg-cream-light px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
              />
              <button type="button" onClick={() => { if (cityInput.trim()) handleSetCity(cityInput.trim()); }}
                disabled={!cityInput.trim() || loadingCity}
                className="px-4 py-2 rounded-xl bg-forest text-white text-xs font-bold disabled:opacity-40">
                {loadingCity ? '…' : 'Set'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_CITIES.map(c => (
                <button key={c} type="button" onClick={() => handleSetCity(c)}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-cream-dark text-gray-600 active:bg-forest active:text-white transition-colors">
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : weather && verse ? (
        <div className={`rounded-2xl overflow-hidden shadow-sm border ${isDisaster ? 'border-red-200' : 'border-black/[0.06]'}`}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setExpanded(e => !e)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setExpanded(v => !v);
              }
            }}
            className="w-full text-left cursor-pointer"
          >
            <div className={`px-4 py-2.5 flex items-center gap-2 batik-overlay ${isDisaster ? 'bg-red-600' : 'bg-[#2d3a10]'}`}>
              <span className="text-lg leading-none">{weather.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[11px] font-bold truncate">{weather.description} · {weather.temp}°C · {weather.city}</p>
                <p className="text-white/60 text-[9px] font-medium truncate">{verse.label}</p>
              </div>
              <button type="button" title="Change city" onClick={e => { e.stopPropagation(); setShowCityPicker(true); }}
                className="text-white/50 text-[10px] mr-1">📍</button>
              <span className="text-white/50 text-[10px]">{expanded ? '▲' : '▼'}</span>
            </div>
          </div>
          {expanded && (
            <div className="px-4 pt-3 pb-4 bg-white">
              <p className="text-right text-[18px] text-[#2d3a10] leading-[2] arabic-text mb-2">{verse.arabic}</p>
              <p className="text-gray-500 text-[11px] italic leading-relaxed border-t border-gray-100 pt-2">
                &ldquo;{verse.translation}&rdquo;
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

function PrayerTimesBar() {
  const [times, setTimes] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
        fetch(`https://api.aladhan.com/v1/timings/${today}?latitude=${latitude}&longitude=${longitude}&method=2`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.data?.timings) setTimes(d.data.timings); })
          .catch(() => {});
      },
      () => {}
    );
  }, []);
  if (!times) return null;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const nextIdx = PRAYER_NAMES.findIndex(p => {
    const [h, m] = (times[p] || '00:00').split(':').map(Number);
    return h * 60 + m > nowMin;
  });
  const nextPrayer = PRAYER_NAMES[nextIdx];
  const nextTime = nextPrayer ? (times[nextPrayer] || '').slice(0, 5) : '';
  return (
    <div className="mx-4 mt-4">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-black/[0.06]">
        {/* Next prayer highlight bar */}
        {nextPrayer && (
          <div className="bg-[#2d3a10] px-4 py-2.5 flex items-center justify-between batik-overlay">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#5a6b28] animate-pulse" />
              <span className="text-white text-xs font-bold">Next: {nextPrayer}</span>
            </div>
            <span className="text-white font-extrabold text-sm tracking-wider">{nextTime}</span>
          </div>
        )}
        {/* All 5 prayer times */}
        <div className="flex divide-x divide-gray-100 px-1 py-3">
          {PRAYER_NAMES.map((p, i) => (
            <div key={p} className={`flex flex-col items-center flex-1 ${i === nextIdx ? 'opacity-100' : 'opacity-55'}`}>
              <span className="text-[8px] font-bold uppercase text-[#2d3a10] tracking-wider">{p}</span>
              <span className="text-[12px] font-extrabold text-gray-800 mt-0.5 tabular-nums">{(times[p] || '--:--').slice(0, 5)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AyahBubble({ content }: { content: string }) {
  const lines = content.split('\n');
  const labelLine = lines[0];
  const rest = lines.slice(1).join('\n');
  return (
    <div>
      <p className="text-[10px] font-bold text-[#2d3a10]/70 mb-1">{labelLine}</p>
      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed"
        style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}>
        {rest}
      </p>
    </div>
  );
}

export default function HomePage() {
  const { user, profile, family } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verseOfDay, setVerseOfDay] = useState<VerseOfDay | null>(null);
  const [verseLoading, setVerseLoading] = useState(true);
  const [showShareAyah, setShowShareAyah] = useState(false);
  const [shareInput, setShareInput] = useState('');
  const [shareResult, setShareResult] = useState<{ arabic: string; translation: string; key: string } | null>(null);
  const [shareLooking, setShareLooking] = useState(false);
  const [onlineMembers, setOnlineMembers] = useState<OnlineMember[]>([]);
  const [dailyMission, setDailyMission] = useState<DailyMission | null>(null);
  const [missionCompleted, setMissionCompleted] = useState(false);
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  const [reflectionText, setReflectionText] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [missionError, setMissionError] = useState('');
  const [submittingMission, setSubmittingMission] = useState(false);
  const [familyPoints, setFamilyPoints] = useState(0);
  const [khatamSession, setKhatamSession] = useState<{ status: string; done: number } | null>(null);
  const [hadithOfDay, setHadithOfDay] = useState<{ narrator: string; text: string } | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [familyIcon, setFamilyIcon] = useState<string>(family?.icon || '');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [confirmClearMyChat, setConfirmClearMyChat] = useState(false);
  const [confirmClearAllChat, setConfirmClearAllChat] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const reflectionContentRef = useRef<HTMLDivElement>(null);
  const reflectionTextareaRef = useRef<HTMLTextAreaElement>(null);
  // Per-user local clear timestamp — messages before this are hidden for this user only
  const [myClearedAt, setMyClearedAt] = useState<string | null>(null);
  // Two-layer home: 'home' shows cards + chat preview, 'chat' shows full chat
  const [layer, setLayer] = useState<'home' | 'chat'>('home');
  // Per-message actions
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; sender: string; content: string } | null>(null);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);
  const closeReflectionModal = useCallback(() => {
    setShowReflectionModal(false);
    setMissionError('');
  }, []);
  const reflectionSwipe = useSwipeDown(closeReflectionModal, 80, () => (reflectionContentRef.current?.scrollTop ?? 0) === 0);
  const reflectionSheetRef = reflectionSwipe.sheetRef;
  const setReflectionSheetRef = useCallback((node: HTMLDivElement | null) => {
    reflectionSheetRef.current = node;
  }, [reflectionSheetRef]);
  const handleReflectionTouchStart = useCallback((e: React.TouchEvent) => reflectionSwipe.handleTouchStart(e), [reflectionSwipe]);
  const handleReflectionTouchMove = useCallback((e: React.TouchEvent) => reflectionSwipe.handleTouchMove(e), [reflectionSwipe]);
  const handleReflectionTouchEnd = useCallback(() => reflectionSwipe.handleTouchEnd(), [reflectionSwipe]);
  // Video call
  const [showVideoCall, setShowVideoCall] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const today = new Date();
  const hijri = gregorianToHijri(today);
  const todayStr = today.toISOString().split('T')[0];
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Load verse of day
  useEffect(() => {
    const key = getDailyVerseKey();
    const [chapter, ayah] = key.split(':');
    Promise.all([
      fetch(`/api/quran/verses?chapter=${chapter}&per_page=300`).then(r => r.ok ? r.json() : null),
      fetch(`https://api.alquran.cloud/v1/surah/${chapter}`).then(r => r.ok ? r.json() : null),
    ]).then(([data, surahData]) => {
      const surahName = surahData?.data?.englishName || `Surah ${chapter}`;
      if (data?.verses) {
        const v = data.verses.find((x: any) => x.verse_key === key);
        if (v) setVerseOfDay({
          verse_key: key,
          text_arabic: v.text_uthmani || '',
          translation: v.translation || '',
          surah_name: surahName,
          ayah_number: ayah,
        });
      }
      setVerseLoading(false);
    }).catch(() => setVerseLoading(false));
  }, []);

  // Load Hadith of the Day (cached in sessionStorage by date)
  useEffect(() => {
    const cacheKey = `hadith_${todayStr}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) { try { setHadithOfDay(JSON.parse(cached)); return; } catch { /* ignore */ } }
    fetch('https://random-hadith-generator.vercel.app/bukhari/')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.data) {
          const h = { narrator: data.data.header || 'Sahih al-Bukhari', text: data.data.hadith_english || '' };
          if (h.text) { setHadithOfDay(h); sessionStorage.setItem(cacheKey, JSON.stringify(h)); }
        }
      }).catch(() => { /* best effort */ });
  }, [todayStr]);

  // Sync family icon from family context
  useEffect(() => {
    if (family?.icon) setFamilyIcon(family.icon);
  }, [family?.icon]);

  // Load daily mission, schedule, points, khatam
  useEffect(() => {
    if (!family || !user) return;
    const verseKey = getDailyVerseKey();
    getDailyMission(family.id, todayStr, verseKey).then(m => setDailyMission(m));
    hasCompletedDailyMission(user.id, family.id, todayStr).then(done => setMissionCompleted(done));
    getFamilyPoints(family.id).then(pts => setFamilyPoints(pts));
    // Load khatam session summary
    supabase.from('khatam_sessions').select('id, status').eq('family_id', family.id).in('status', ['active', 'voting']).maybeSingle()
      .then(({ data }) => {
        if (data?.status === 'active') {
          supabase.from('khatam_assignments').select('completed').eq('session_id', data.id)
            .then(({ data: assigns }) => {
              const done = (assigns || []).filter((a: { completed: boolean }) => a.completed).length;
              setKhatamSession({ status: 'active', done });
            });
        } else if (data?.status === 'voting') {
          setKhatamSession({ status: 'voting', done: 0 });
        } else {
          setKhatamSession(null);
        }
      });
  }, [family, user, todayStr]);

  // Load messages (filtered by this user's personal clear timestamp)
  const loadMessages = useCallback(async () => {
    if (!family || !user) return;
    // Load personal clear timestamp
    const { data: clearRow } = await supabase
      .from('chat_clear_timestamps')
      .select('cleared_at')
      .eq('user_id', user.id)
      .eq('family_id', family.id)
      .maybeSingle();
    const clearedAt = clearRow?.cleared_at ?? null;
    setMyClearedAt(clearedAt);

    let query = supabase.from('family_messages').select('*').eq('family_id', family.id).order('created_at', { ascending: true }).limit(200);
    if (clearedAt) query = query.gt('created_at', clearedAt);
    const { data } = await query;
    if (data) setMessages(data as ChatMessage[]);
    setLoading(false);
  }, [family, user]);
  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Realtime chat
  useEffect(() => {
    if (!family) return;
    const channel = supabase.channel(`family_chat_${family.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'family_messages', filter: `family_id=eq.${family.id}` },
        (payload) => setMessages(prev => [...prev, payload.new as ChatMessage]))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [family]);

  // Load family members
  useEffect(() => {
    if (!family) return;
    supabase.from('profiles').select('id, name, role').eq('family_id', family.id).then(({ data }) => {
      if (data) setOnlineMembers(data.map((p: any) => ({ user_id: p.id, name: p.name, role: p.role })));
    });
  }, [family]);

  // Auto-scroll to bottom
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function sendMessage(text: string) {
    let content = text.trim();
    if (!content || !user || !family || !profile) return;
    if (replyTo) {
      const preview = replyTo.content.length > 60 ? replyTo.content.slice(0, 60) + '…' : replyTo.content;
      content = `[reply:${replyTo.sender}] ${preview}\n${content}`;
      setReplyTo(null);
    }
    setSending(true);
    await supabase.from('family_messages').insert({ family_id: family.id, user_id: user.id, sender_name: profile.name, sender_role: profile.role, content });
    setInput(''); setSending(false); inputRef.current?.focus();
  }

  async function handleCompleteMission() {
    if (!user || !family || !dailyMission) return;
    setMissionError('');
    setSubmittingMission(true);

    // Upload proof image if selected
    let finalProof = proofNote;
    if (proofFile) {
      setUploadingProof(true);
      const url = await uploadProofImage(proofFile, user.id);
      setUploadingProof(false);
      if (url) finalProof = url;
    }

    const finalReflection = finalProof.trim()
      ? `[Proof: ${finalProof.trim()}] ${reflectionText}`
      : reflectionText;

    const result = await completeMission(user.id, family.id, dailyMission.id, finalReflection, profile?.name, profile?.role);
    if (result) {
      setMissionCompleted(true);
      setShowReflectionModal(false);
      setReflectionText('');
      setProofNote('');
      setProofFile(null);
    } else {
      setMissionError('Already completed today, or reflection is too short (min 10 characters).');
    }
    setSubmittingMission(false);
  }

  async function lookupShareVerse() {
    const q = shareInput.trim();
    if (!q) return;
    setShareLooking(true); setShareResult(null);
    try {
      // Use same search API as Quran navbar — handles verse keys, surah names, topics, Arabic
      const res = await fetch(`/api/quran/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const d = await res.json();
        const results = d?.search?.results;
        if (results && results.length > 0) {
          const v = results[0];
          setShareResult({
            arabic: v.text || '',
            translation: v.translations?.[0]?.text || '',
            key: v.verse_key,
          });
        }
      }
    } catch { /* silent */ }
    setShareLooking(false);
  }

  async function sendShareAyah() {
    if (!shareResult || !user || !family || !profile) return;
    const text = `📖 ${verseKeyToLabel(shareResult.key)}\n${shareResult.arabic}\n\n"${shareResult.translation}"`;
    await supabase.from('family_messages').insert({ family_id: family.id, user_id: user.id, sender_name: profile.name, sender_role: profile.role, content: text });
    setShowShareAyah(false); setShareInput(''); setShareResult(null);
  }


  function handleSubmit(e: React.FormEvent) { e.preventDefault(); sendMessage(input); }

  async function toggleRecording() {
    if (isRecording) {
      // Stop recording — captured blob goes to preview state
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }
    if (!navigator.mediaDevices) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      // Auto-stop after 60s
      setTimeout(() => { if (mr.state === 'recording') { mr.stop(); setIsRecording(false); } }, 60000);
    } catch { /* mic denied */ }
  }

  function cancelVoiceNote() {
    setRecordedBlob(null);
    audioChunksRef.current = [];
  }

  async function sendVoiceNote() {
    if (!recordedBlob) return;
    setSendingVoice(true);
    const fileName = `voice_${Date.now()}.webm`;
    const { data: uploadData, error } = await supabase.storage.from('voice-notes').upload(fileName, recordedBlob, { contentType: 'audio/webm' });
    if (!error && uploadData) {
      const { data: urlData } = supabase.storage.from('voice-notes').getPublicUrl(uploadData.path);
      if (urlData?.publicUrl) await sendMessage(`[voice:${urlData.publicUrl}]`);
    }
    setRecordedBlob(null);
    audioChunksRef.current = [];
    setSendingVoice(false);
  }

  async function updateFamilyIcon(icon: string) {
    if (!family || profile?.role !== 'parent') return;
    setFamilyIcon(icon);
    setShowIconPicker(false);
    await supabase.from('families').update({ icon }).eq('id', family.id);
  }

  async function deleteMessage(msgId: string) {
    if (!user) return;
    setDeletingMsgId(msgId);
    await supabase.from('family_messages').delete().eq('id', msgId).eq('user_id', user.id);
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setSelectedMsgId(null);
    setDeletingMsgId(null);
  }

  function startReply(msg: ChatMessage) {
    setReplyTo({ id: msg.id, sender: msg.sender_name, content: msg.content });
    setSelectedMsgId(null);
  }

  async function clearMyChat() {
    if (!user || !family) return;
    setClearingChat(true);
    const now = new Date().toISOString();
    // Upsert personal clear timestamp — messages before now are hidden for THIS user only
    await supabase.from('chat_clear_timestamps').upsert(
      { user_id: user.id, family_id: family.id, cleared_at: now },
      { onConflict: 'user_id,family_id' }
    );
    setMyClearedAt(now);
    setMessages([]);
    setConfirmClearMyChat(false);
    setClearingChat(false);
  }

  async function clearAllChat() {
    if (!user || !family) return;
    setClearingChat(true);
    const now = new Date().toISOString();
    // Each person can only clear for themselves — this clears for the current user
    await supabase.from('chat_clear_timestamps').upsert(
      { user_id: user.id, family_id: family.id, cleared_at: now },
      { onConflict: 'user_id,family_id' }
    );
    setMyClearedAt(now);
    setMessages([]);
    setConfirmClearAllChat(false);
    setClearingChat(false);
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  function formatDate(iso: string) {
    const d = new Date(iso), t = new Date(), y = new Date();
    y.setDate(t.getDate() - 1);
    if (d.toDateString() === t.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long' });
  }

  const grouped: { date: string; messages: ChatMessage[] }[] = [];
  for (const msg of messages) {
    const label = formatDate(msg.created_at);
    const last = grouped[grouped.length - 1];
    if (last && last.date === label) last.messages.push(msg);
    else grouped.push({ date: label, messages: [msg] });
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const missionText = dailyMission
    ? (dailyMission.is_parent_override && dailyMission.parent_override_text
        ? dailyMission.parent_override_text
        : dailyMission.generated_text)
    : null;
  const reflectionCharCount = reflectionText.trim().length;

  useEffect(() => {
    if (!showReflectionModal) return;
    requestAnimationFrame(() => reflectionTextareaRef.current?.focus());
  }, [showReflectionModal]);

  if (loading) {
    return (
      <LoadingBlock fullScreen />
    );
  }

  // ── Video call overlay — real Agora SDK ──
  const VideoCallOverlay = showVideoCall ? (
    <VideoCallModal
      channelName={family?.id || 'musfam-default'}
      userId={user?.id || 'anon'}
      displayName={profile?.name || 'You'}
      familyName={family?.name || 'Family'}
      onClose={() => setShowVideoCall(false)}
    />
  ) : null;

  return (
    <>
      {VideoCallOverlay}

      {/* ── LAYER: HOME ── */}
      {layer === 'home' && (
        <>
          {/* ── Hero header — full bleed green with batik depth ── */}
          <div className="relative bg-[#2d3a10] flex-shrink-0 z-10 pb-4 overflow-hidden batik-overlay">
            {/* Batik kawung overlay — real PNG tile */}
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: 'url(/batik-kawung.png)',
              backgroundRepeat: 'repeat',
              backgroundSize: '100px 68px',
              opacity: 0.07,
              mixBlendMode: 'screen',
            }} />

            {/* Top bar */}
            <div className="relative px-4 pt-4 pb-0 flex items-center justify-between">
              <div>
                <p className="font-extrabold text-white text-xl leading-tight tracking-tight">Musfam</p>
                <p className="text-[10px] text-white/50 font-medium mt-0.5">
                  {hijri.day} {hijri.monthName} {hijri.year} H
                </p>
              </div>
              <div className="flex items-center gap-2">
                {familyPoints > 0 && (
                  <div className="flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1.5 shadow-inner">
                    <Diamond size={11} className="text-[#d4a017]" />
                    <span className="text-white text-[12px] font-extrabold tabular-nums">{familyPoints.toLocaleString()} AP</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bismillah + greeting */}
            <div className="relative px-4 mt-2">
              <p className="text-white/75 text-[17px] arabic-text tracking-wide leading-relaxed text-right">
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </p>
              <p className="text-white/50 text-[11px] font-medium mt-1">
                {greeting}, {profile?.name?.split(' ')[0] || 'family'} · {today.getDate()} {GREGORIAN_MONTHS[today.getMonth()]}
              </p>
            </div>

            {/* Khatam progress strip (if active) */}
            {khatamSession?.status === 'active' && (
              <div className="relative mx-4 mt-3 bg-white/10 rounded-xl px-3 py-2 flex items-center gap-2">
                <BookOpen size={12} className="text-[#5a6b28]" />
                <div className="flex-1">
                  <p className="text-white text-[10px] font-bold">Qur&apos;anther Progress</p>
                  <div className="w-full h-1.5 bg-white/20 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-[#5a6b28] rounded-full" style={{ width: `${Math.min(100, (khatamSession.done / 30) * 100)}%` }} />
                  </div>
                </div>
                <span className="text-white/60 text-[10px] font-bold">{khatamSession.done}/30</span>
              </div>
            )}

          </div>

          {/* ── Scrollable body ── */}
          <main className="flex-1 overflow-y-auto hide-scrollbar pb-20" style={{ background: '#F7F5F0' }}>

            {/* ── Verse of Day — full-width hero card ── */}
            {verseOfDay && (
              <div className="mx-4 -mt-3 relative z-10">
                <div className="rounded-3xl overflow-hidden shadow-xl border border-black/[0.06]"
                  style={{ background: 'linear-gradient(160deg, #fff 0%, #f0fdf4 100%)' }}>
                  <div className="px-4 pt-4 pb-1 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#5a6b28]" />
                      <span className="text-[9px] font-bold text-[#2d3a10] uppercase tracking-[0.15em]">Verse of the Day</span>
                    </div>
                    <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{verseOfDay.surah_name} · {verseOfDay.ayah_number}</span>
                  </div>
                  <div className="px-5 pt-2 pb-4">
                    <p className="text-right text-[20px] text-[#2d3a10] leading-[2.2] arabic-text mb-3 line-clamp-3">
                      {verseOfDay.text_arabic}
                    </p>
                    <p className="text-gray-500 text-[11px] italic leading-relaxed border-t border-gray-100 pt-2.5">
                      &ldquo;{verseOfDay.translation}&rdquo;
                    </p>
                    <button type="button" onClick={() => router.push('/quran')}
                      className="flex items-center gap-1 text-[#2d3a10] text-[10px] font-bold mt-2.5 active:opacity-60">
                      Read in Quran <ArrowUpRight size={10} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Prayer times — pill strip ── */}
            <div className="mt-4">
              <PrayerTimesBar />
            </div>

            {/* ── Weather + contextual Quran verse ── */}
            <WeatherBar />

            {/* ── Daily Mission — prominent standalone card ── */}
            {dailyMission && (
              <div className="mx-4 mt-3">
                <div className={`rounded-3xl overflow-hidden shadow-md transition-all ${
                  missionCompleted
                    ? 'border border-[#5a6b28]/30'
                    : 'border border-black/[0.06]'
                }`}
                  style={{
                    background: missionCompleted
                      ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)'
                      : 'linear-gradient(135deg, #ffffff, #f9f9f7)',
                  }}>
                  <div className={`px-4 py-2.5 flex items-center justify-between ${
                    missionCompleted ? 'bg-[#5a6b28]' : 'bg-[#2d3a10]'
                  }`}>
                    <div className="flex items-center gap-2">
                      <CheckCircle size={12} className="text-white/80" />
                      <span className="text-white text-[9px] font-bold uppercase tracking-widest">
                        {missionCompleted ? 'Mission Complete' : "Today's Mission"}
                      </span>
                    </div>
                    {missionCompleted && <span className="text-white text-[10px] font-extrabold">+10 AP ✓</span>}
                  </div>
                  <div className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-gray-800 font-semibold text-[13px] leading-snug line-clamp-3">
                        {missionText}
                      </p>
                      {!missionCompleted && (
                        <button type="button" onClick={() => setShowReflectionModal(true)}
                          className="mt-3 bg-[#2d3a10] text-white font-bold py-2 px-5 rounded-xl text-[11px] active:scale-95 transition-transform shadow-sm">
                          Complete Mission
                        </button>
                      )}
                    </div>
                    {missionCompleted && (
                      <div className="w-10 h-10 rounded-full bg-[#5a6b28]/20 flex items-center justify-center flex-shrink-0">
                        <CheckCircle size={20} className="text-[#5a6b28]" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Hadith card — full width ── */}
            {hadithOfDay && (
              <div className="mx-4 mt-3 rounded-2xl overflow-hidden shadow-sm border border-[#c8a84b]/30">
                <div className="px-3 py-1.5 flex items-center gap-1.5 batik-overlay" style={{ background: 'linear-gradient(90deg, #2d3a10, #3d4e18)' }}>
                  <span className="text-[11px]">📜</span>
                  <span className="text-white text-[8px] font-bold uppercase tracking-widest">Hadith of the Day</span>
                </div>
                <div className="bg-[#c8a84b]/8 px-4 py-3" style={{ background: 'rgba(200,168,75,0.07)' }}>
                  <p className="text-gray-700 text-[11px] leading-relaxed line-clamp-3 italic">
                    &ldquo;{hadithOfDay.text.length > 160 ? hadithOfDay.text.slice(0, 160) + '…' : hadithOfDay.text}&rdquo;
                  </p>
                  <p className="text-[#8b6914] text-[9px] font-bold truncate mt-1.5">{hadithOfDay.narrator}</p>
                </div>
              </div>
            )}

            {/* ── Family Chat entry — WA style full-width row ── */}
            <div className="px-4 mt-4">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-2 px-1">Conversations</p>
              <button type="button" onClick={() => setLayer('chat')}
                className="w-full bg-white rounded-2xl flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition-all shadow-sm border border-black/[0.05] text-left">
                <div className="relative flex-shrink-0">
                  <div className="w-[46px] h-[46px] rounded-full bg-gradient-to-br from-[#2d3a10] to-[#3d4e18] flex items-center justify-center shadow">
                    {familyIcon ? <span className="text-xl">{familyIcon}</span> : <Users size={20} className="text-white" />}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#5a6b28] rounded-full border-2 border-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-0.5">
                    <p className="font-bold text-[14px] text-gray-900 truncate">{family?.name || 'Family'} Group</p>
                    {messages.length > 0 && (
                      <span className="text-[10px] text-[#5a6b28] font-semibold flex-shrink-0 ml-2 tabular-nums">
                        {formatTime(messages[messages.length - 1].created_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-gray-400 truncate">
                    {messages.length > 0
                      ? (() => {
                          const last = messages[messages.length - 1];
                          return `${last.sender_name.split(' ')[0]}: ${last.content.startsWith('[voice:') ? '🎤 Voice note' : last.content.startsWith('📖') ? '📖 Shared a verse' : last.content.length > 38 ? last.content.slice(0, 38) + '…' : last.content}`;
                        })()
                      : 'Tap to open family chat'}
                  </p>
                </div>
              </button>
            </div>
          </main>
        </>
      )}

      {/* ── LAYER: CHAT ── full WA chat */}
      {layer === 'chat' && (
        <>
          {/* Chat header with back button + video call */}
          <div className="bg-[#2d3a10] text-white px-3 py-2.5 flex items-center justify-between shadow-sm flex-shrink-0 z-10 batik-overlay">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setLayer('home')} title="Back"
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors">
                <ChevronLeft size={18} className="text-white" />
              </button>
              <div className="relative">
                <button type="button"
                  onClick={() => profile?.role === 'parent' && setShowIconPicker(s => !s)}
                  className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-base select-none"
                  title={profile?.role === 'parent' ? 'Change group icon' : undefined}>
                  {familyIcon ? <span className="text-lg">{familyIcon}</span> : (family?.name?.charAt(0)?.toUpperCase() || 'F')}
                </button>
                {showIconPicker && (
                  <div className="absolute top-11 left-0 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 grid grid-cols-4 gap-2 w-[160px]">
                    {['🕌','🌙','⭐','📖','🤲','🌿','🕋','💎','🌸','🦋','🌺','🌟'].map(em => (
                      <button key={em} type="button" onClick={() => updateFamilyIcon(em)}
                        className="text-2xl w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors">
                        {em}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="font-bold text-sm leading-tight">{family?.name || 'Family'} Group</p>
                <p className="text-[10px] text-white/65 leading-tight">
                  {onlineMembers.length > 0
                    ? onlineMembers.map(m => m.name.split(' ')[0]).join(', ')
                    : 'Loading members...'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" title="Video Call" onClick={() => setShowVideoCall(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-white/10 hover:bg-white/20">
                <Video size={16} className="text-white/90" />
              </button>
              <button type="button" title="Clear chat" onClick={() => setConfirmClearMyChat(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-white/10 hover:bg-white/20">
                <Trash2 size={15} className="text-white/80" />
              </button>
            </div>
          </div>

          {/* Scrollable chat body */}
          <main className="flex-1 overflow-y-auto hide-scrollbar bg-[#E5DDD5] pb-[130px]">
            {/* ── Chat messages ── */}
            <div className="mt-2 space-y-1 px-2" ref={chatRef}>
              {grouped.map((group) => (
                <div key={group.date} className="space-y-1">
                  <div className="flex justify-center my-3">
                    <span className="bg-[#E1F3FB]/80 text-[#2d3a10] text-[10px] font-bold px-3 py-1 rounded-lg shadow-sm uppercase tracking-wider">
                      {group.date}
                    </span>
                  </div>
                  {group.messages.map((msg) => {
                    const isMe = msg.user_id === user?.id;
                    const isAyah = msg.content.startsWith('📖');
                    const isVoice = msg.content.startsWith('[voice:');
                    const isReply = msg.content.startsWith('[reply:');
                    const voiceUrl = isVoice ? msg.content.slice(7, -1) : null;
                    const isSelected = selectedMsgId === msg.id;
                    // Parse reply header
                    let replyHeader = '';
                    let mainContent = msg.content;
                    if (isReply) {
                      const nl = msg.content.indexOf('\n');
                      if (nl !== -1) {
                        replyHeader = msg.content.slice(0, nl).replace('[reply:', '').replace(']', '').trim();
                        mainContent = msg.content.slice(nl + 1);
                      }
                    }
                    return (
                      <div key={msg.id}>
                        <div
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'} px-1 transition-colors ${isSelected ? 'bg-[#2d3a10]/10 rounded-xl' : ''}`}
                          onClick={() => setSelectedMsgId(isSelected ? null : msg.id)}>
                          <div className={`max-w-[80%] rounded-xl px-3 py-2 shadow-sm relative ${
                            isMe ? 'bg-[#DCF8C6] rounded-tr-none' : 'bg-white rounded-tl-none'
                          } ${isAyah ? 'border border-[#5a6b28]/30' : ''}`}>
                            {!isMe && (
                              <p className={`text-[10px] font-bold mb-0.5 ${msg.sender_role === 'parent' ? 'text-[#2d3a10]' : 'text-[#8b6914]'}`}>
                                {msg.sender_name}
                              </p>
                            )}
                            {isReply && replyHeader && (
                              <div className="bg-black/5 rounded-lg px-2 py-1 mb-1.5 border-l-2 border-[#2d3a10]/40">
                                <p className="text-[9px] font-bold text-[#2d3a10]/70">{replyHeader}</p>
                              </div>
                            )}
                            {isVoice && voiceUrl ? (
                              <audio controls src={voiceUrl} className="w-[200px] h-9 my-0.5" style={{ colorScheme: 'light' }} />
                            ) : isAyah ? (
                              <AyahBubble content={mainContent} />
                            ) : (
                              <p className="text-sm text-gray-800 break-words whitespace-pre-wrap leading-relaxed">{mainContent}</p>
                            )}
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              <span className="text-[9px] text-gray-400 font-medium">{formatTime(msg.created_at)}</span>
                              {isMe && <span className="text-[#34B7F1] text-[10px]">✓✓</span>}
                            </div>
                            <div className={`absolute top-0 w-2.5 h-2.5 ${isMe
                              ? '-right-2 bg-[#DCF8C6] [clip-path:polygon(0_0,0_100%,100%_0)]'
                              : '-left-2 bg-white [clip-path:polygon(100%_0,100%_100%,0_0)]'}`} />
                          </div>
                        </div>
                        {/* Action row when message is selected */}
                        {isSelected && (
                          <div className={`flex items-center gap-2 px-3 py-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <button type="button" onClick={() => startReply(msg)}
                              className="flex items-center gap-1 bg-white rounded-full px-3 py-1 shadow-sm text-[11px] font-bold text-[#2d3a10] border border-black/5">
                              <CornerUpLeft size={11} /> Reply
                            </button>
                            {isMe && (
                              <button type="button" onClick={() => deleteMessage(msg.id)} disabled={deletingMsgId === msg.id}
                                className="flex items-center gap-1 bg-red-50 rounded-full px-3 py-1 shadow-sm text-[11px] font-bold text-red-500 border border-red-100 disabled:opacity-50">
                                {deletingMsgId === msg.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={bottomRef} className="h-2" />
            </div>
          </main>

          {/* ── Fixed bottom: input ── */}
          <div className="fixed bottom-16 left-0 right-0 z-20 max-w-md mx-auto">
            <div className="flex flex-col bg-[#F0F0F0]/90 backdrop-blur-md border-t border-black/5">
              {/* Reply preview bar */}
              {replyTo && (
                <div className="flex items-center gap-2 px-4 pt-2 pb-1">
                  <div className="flex-1 bg-white rounded-xl px-3 py-1.5 border-l-2 border-[#2d3a10] min-w-0">
                    <p className="text-[10px] font-bold text-[#2d3a10]">{replyTo.sender}</p>
                    <p className="text-[11px] text-gray-500 truncate">{replyTo.content.length > 50 ? replyTo.content.slice(0, 50) + '…' : replyTo.content}</p>
                  </div>
                  <button type="button" title="Cancel reply" onClick={() => setReplyTo(null)} className="text-gray-400 flex-shrink-0">
                    <X size={16} />
                  </button>
                </div>
              )}
              {/* Voice note preview bar */}
              {recordedBlob ? (
                <div className="flex items-center gap-2 px-3 pb-2 pt-2">
                  <div className="flex-1 bg-white border border-black/10 rounded-full px-4 py-2.5 flex items-center gap-2 shadow-inner">
                    <Mic size={14} className="text-[#5a6b28] flex-shrink-0" />
                    <span className="text-sm text-gray-600 flex-1">Voice note ready</span>
                    <button type="button" title="Cancel voice note" onClick={cancelVoiceNote} className="text-gray-400 hover:text-red-400 transition-colors">
                      <X size={15} />
                    </button>
                  </div>
                  <button type="button" onClick={sendVoiceNote} disabled={sendingVoice}
                    className="w-10 h-10 rounded-full bg-[#5a6b28] text-white flex items-center justify-center shadow-md flex-shrink-0 disabled:opacity-50">
                    {sendingVoice ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 pb-2 pt-2">
                  <div className={`flex-1 bg-white border rounded-full px-4 py-2.5 flex items-center shadow-inner transition-colors ${isRecording ? 'border-red-300 bg-red-50' : 'border-black/10'}`}>
                    {isRecording ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                        <span className="flex-1 text-sm text-red-500 font-medium ml-2">Recording...</span>
                      </>
                    ) : (
                      <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
                        placeholder="Type a message..." className="flex-1 text-sm focus:outline-none bg-transparent" />
                    )}
                    {!isRecording && (
                      <>
                        <button type="button" onClick={() => setShowShareAyah(true)} className="text-[#2d3a10]/50 ml-2 flex-shrink-0" title="Share Ayah">
                          <BookOpen size={16} />
                        </button>
                        <button type="button" onClick={() => router.push('/quran?tab=khatam')} className="text-[#2d3a10]/50 ml-1 flex-shrink-0" title="Qur'anther">
                          <Users size={16} />
                        </button>
                      </>
                    )}
                    <button type="button" onClick={toggleRecording}
                      className={`ml-1.5 flex-shrink-0 transition-colors ${isRecording ? 'text-red-500' : 'text-[#2d3a10]/50'}`}
                      title={isRecording ? 'Stop recording' : 'Record voice note'}>
                      {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                  </div>
                  {!isRecording && (
                    <button type="submit" disabled={sending || !input.trim()}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                        input.trim() ? 'bg-[#5a6b28] text-white shadow-md' : 'bg-gray-200 text-gray-400'
                      }`}>
                      {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
                    </button>
                  )}
                </form>
              )}
            </div>
          </div>

        </>
      )}

      {/* ── Modals (shown on top of either layer) ── */}

      {/* ── Reflection modal ── */}
      {showReflectionModal && dailyMission && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) closeReflectionModal(); }}>
          <div
            ref={setReflectionSheetRef}
            onTouchStart={handleReflectionTouchStart}
            onTouchMove={handleReflectionTouchMove}
            onTouchEnd={handleReflectionTouchEnd}
            className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
            <div ref={reflectionContentRef} className="p-6 pb-[220px] space-y-4 overflow-y-auto flex-1 overscroll-contain">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-extrabold text-gray-800">Mission Reflection</h3>
                <button type="button" title="Close" onClick={closeReflectionModal}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                  <X size={18} />
                </button>
              </div>
              <div className="bg-[#F0FDF4] p-3 rounded-2xl border border-[#DCF8C6]">
                <p className="text-[10px] font-bold text-[#2d3a10] uppercase tracking-widest mb-1">
                  Prompt · Quran {dailyMission.verse_key}
                </p>
                <p className="text-sm text-gray-700 font-medium italic">
                  &quot;{dailyMission.parent_override_prompt || 'What did this ayah teach you, and what action did you take?'}&quot;
                </p>
              </div>

              {/* Proof upload */}
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Proof <span className="font-normal normal-case text-gray-300">(optional — photo or description)</span>
                </p>
                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 hover:bg-gray-100 transition-colors">
                  <ImageIcon size={15} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-500 flex-1 truncate">
                    {proofFile ? proofFile.name : 'Upload photo...'}
                  </span>
                  <input type="file" accept="image/*" className="sr-only"
                    onChange={e => setProofFile(e.target.files?.[0] ?? null)} />
                </label>
                {!proofFile && (
                  <input type="text" value={proofNote} onChange={e => setProofNote(e.target.value)}
                    placeholder="Or describe your proof..."
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d3a10]/20" />
                )}
              </div>

              <textarea value={reflectionText} onChange={e => setReflectionText(e.target.value)}
                ref={reflectionTextareaRef}
                placeholder="Write your reflection here..."
                className="w-full h-28 rounded-2xl border border-gray-200 p-4 text-sm focus:ring-2 focus:ring-[#2d3a10]/20 focus:border-[#2d3a10] outline-none resize-none" />
              <div className="flex justify-between items-center px-1">
                {reflectionCharCount > 0 && reflectionCharCount < 10
                  ? <span className="text-[10px] font-bold text-amber-500">Add a bit more...</span>
                  : <span className="text-[10px] text-gray-400">*required</span>}
                <span className="text-[10px] text-gray-400">Required to complete</span>
              </div>
              {missionError && (
                <p className="text-xs text-red-500 font-medium text-center bg-red-50 rounded-xl py-2 px-3">{missionError}</p>
              )}
              <div className="h-6" aria-hidden="true" />
            </div>
            <div className="px-6 py-4 flex-shrink-0 border-t border-gray-100">
              <button type="button" disabled={submittingMission || uploadingProof || reflectionCharCount < 10} onClick={handleCompleteMission}
                className="w-full bg-[#2d3a10] text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                {(submittingMission || uploadingProof) ? <Loader2 size={20} className="animate-spin" /> : <><CheckCircle size={20} /> Submit Reflection</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Share Ayah modal ── */}
      {showShareAyah && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Share Quran Ayah</h3>
              <button type="button" title="Close" onClick={() => { setShowShareAyah(false); setShareInput(''); setShareResult(null); }}
                className="text-gray-400"><X size={20} /></button>
            </div>
            <div className="flex gap-2">
              <input type="text" value={shareInput} onChange={e => setShareInput(e.target.value)}
                placeholder="2:255, Al-Baqarah, mercy..." onKeyDown={e => e.key === 'Enter' && lookupShareVerse()}
                className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none" />
              <button type="button" onClick={lookupShareVerse} disabled={shareLooking}
                className="bg-[#2d3a10] text-white px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">
                {shareLooking ? <Loader2 size={16} className="animate-spin" /> : 'Find'}
              </button>
            </div>
            {shareResult && (
              <div className="bg-[#DCF8C6]/40 rounded-2xl p-4 border border-[#DCF8C6] space-y-2">
                <p className="text-xs font-bold text-[#2d3a10]/60 uppercase tracking-wider">{verseKeyToLabel(shareResult.key)}</p>
                <p className="text-right text-lg text-[#2d3a10]" style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}>
                  {shareResult.arabic}
                </p>
                <p className="text-xs text-gray-600 italic line-clamp-3">&quot;{shareResult.translation}&quot;</p>
                <button type="button" onClick={sendShareAyah}
                  className="w-full bg-[#5a6b28] text-white font-bold py-2.5 rounded-xl text-sm">
                  Share to Group
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Confirm: Clear My Chat */}
      {confirmClearMyChat && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="font-extrabold text-gray-800 text-center text-lg mb-1">Clear Chat for Me?</h3>
            <p className="text-sm text-gray-500 text-center mb-5">All messages will be hidden from your view only. Other members still see them.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmClearMyChat(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm">
                Cancel
              </button>
              <button type="button" onClick={clearMyChat} disabled={clearingChat}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm disabled:opacity-50">
                {clearingChat ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Clear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm: Clear All Chat (parent only) */}
      {confirmClearAllChat && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-600" />
            </div>
            <h3 className="font-extrabold text-gray-800 text-center text-lg mb-1">Clear All Chat for Me?</h3>
            <p className="text-sm text-gray-500 text-center mb-5">All messages will be hidden from your view only. Other family members still see the chat.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmClearAllChat(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm">
                Cancel
              </button>
              <button type="button" onClick={clearAllChat} disabled={clearingChat}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm disabled:opacity-50">
                {clearingChat ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Clear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
