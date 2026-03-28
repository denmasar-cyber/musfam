const QURAN_API_CONTENT = 'https://api.quran.com/api/v4';
const QURAN_API_USER = 'https://api.quran.com/api/v1';
const OAUTH_ENDPOINT = 'https://oauth2.quran.foundation';
const CLIENT_ID = 'f3ecd35d-0d5a-4cc7-b2e1-6da1a66ff396';
const CLIENT_SECRET = 'rFa-g.jWcZiET5llbFomfpxg0f';

let cachedToken: string | null = null;
let tokenExpiry = 0;

export async function getAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  try {
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const res = await fetch(`${OAUTH_ENDPOINT}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return cachedToken;
  } catch {
    return null;
  }
}

export function getHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/** 
 * Generic fetcher for Quran Foundation APIs.
 * Defaults to V4 Content API. Use /v1 prefix for User APIs.
 */
export async function quranFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = { ...getHeaders(token), ...options.headers };
  
  const isV1 = path.startsWith('/v1/');
  const cleanPath = isV1 ? path.replace('/v1', '') : path;
  const baseUrl = isV1 ? QURAN_API_USER : QURAN_API_CONTENT;
  
  return fetch(`${baseUrl}${cleanPath}`, { 
    ...options, 
    headers,
    next: { revalidate: options.method === 'POST' ? 0 : 3600 } 
  });
}

/**
 * Gets the current app date shifted by -4 hours to align with Sahur (dawn).
 * This means the "new day" in Musfam starts at 4:00 AM instead of midnight.
 */
export function getAppDate(): Date {
  // Sahur shift: -4 hours
  const SAHUR_SHIFT_MS = 4 * 60 * 60 * 1000;
  return new Date(Date.now() - SAHUR_SHIFT_MS);
}

/**
 * Deterministically returns the Verse Key for today based on day of week and week of year.
 * Used for Verse of the Day and Daily Mission alignment.
 * Shifted by Sahur logic so new mission appears at 4 AM.
 */
export function getDailyVerseKey(dateStr?: string): string {
  // Use provided date string or use shifted app date to avoid UTC shift issues
  let d: Date;
  if (dateStr) {
    const [y, m, day] = dateStr.split('-').map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = getAppDate();
  }
  
  const dayOfWeek = d.getDay();
  // Simple week count from start of year
  const weekOfYear = Math.floor((+d - +new Date(d.getFullYear(), 0, 1)) / 604800000);
  
  const THEMES: Record<number, string[]> = {
    0: ['2:255','65:3','3:173','4:81','8:2','58:22','67:1'],
    1: ['14:7','55:13','93:11','2:152','27:19','17:3','76:9'],
    2: ['4:103','20:14','29:45','2:45','23:1','17:78','62:9'],
    3: ['31:14','17:23','17:24','3:103','49:10','4:36','9:128'],
    4: ['2:153','3:200','2:177','3:139','39:10','16:127','70:5'],
    5: ['2:261','57:7','76:8','2:177','93:9','64:16','3:92'],
    6: ['47:24','4:82','38:29','96:1','73:4','17:9','59:21'],
  };
  
  const pool = THEMES[dayOfWeek] ?? THEMES[0];
  return pool[weekOfYear % pool.length];
}
