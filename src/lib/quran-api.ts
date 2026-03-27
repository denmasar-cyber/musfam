const QURAN_API_BASE = 'https://api.quran.com/api/v4';
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
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function quranFetch(path: string): Promise<Response> {
  const token = await getAccessToken();
  const headers = getHeaders(token);
  return fetch(`${QURAN_API_BASE}${path}`, { headers, next: { revalidate: 3600 } });
}
