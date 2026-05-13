import { NextRequest, NextResponse } from 'next/server';
import { quranFetch } from '@/lib/quran-api';

/**
 * Server-side proxy for Quran Foundation User API (v1).
 * Avoids CORS issues and protects OAuth credentials.
 */
export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}

async function handleSync(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get('action');
    let body: any = null;

    if (request.method === 'POST') {
      try {
        body = await request.json();
      } catch {
        // Empty body is fine if we use query params
      }
    }

    let path = '';
    let method = request.method;
    
    // Switch based on action
    switch (action) {
      case 'bookmark':
        const isAdding = request.nextUrl.searchParams.get('isAdding') === 'true';
        method = isAdding ? 'POST' : 'DELETE';
        const vk = request.nextUrl.searchParams.get('verse_key');
        path = isAdding ? '/v1/user/bookmarks' : `/v1/user/bookmarks/${vk}`;
        if (isAdding) body = { verse_key: vk };
        break;
      
      case 'reading':
        path = '/v1/user/progress';
        body = body || { verse_key: request.nextUrl.searchParams.get('verse_key'), timestamp: Math.floor(Date.now() / 1000) };
        break;

      case 'post':
        path = '/v1/user/posts';
        body = body || { content: request.nextUrl.searchParams.get('content'), room_id: request.nextUrl.searchParams.get('room_id') };
        break;

      case 'posts':
        method = 'GET';
        path = `/v1/user/posts?room_id=${request.nextUrl.searchParams.get('room_id')}`;
        break;

      case 'comment':
        path = '/v1/user/comments';
        body = body || { post_id: request.nextUrl.searchParams.get('post_id'), content: request.nextUrl.searchParams.get('content') };
        break;

      case 'goal':
        path = '/v1/user/goals';
        body = body || { 
          title: request.nextUrl.searchParams.get('title'),
          target: parseInt(request.nextUrl.searchParams.get('target') || '1'),
          type: request.nextUrl.searchParams.get('type') || 'reading' 
        };
        break;

      case 'goal_progress':
        path = `/v1/user/goals/${request.nextUrl.searchParams.get('goal_id')}/progress`;
        body = body || { increment: parseInt(request.nextUrl.searchParams.get('increment') || '1') };
        break;

      case 'activity':
        path = '/v1/user/activity';
        body = body || { description: request.nextUrl.searchParams.get('description'), points: parseInt(request.nextUrl.searchParams.get('points') || '0') };
        break;

      default:
        // Fallback for custom actions passed in body
        if (!action && body?.action) {
           return handleSync(new NextRequest(request.url + `?action=${body.action}`, { method: 'POST', body: JSON.stringify(body) }));
        }
        return NextResponse.json({ error: 'Invalid action or method' }, { status: 400 });
    }

    const res = await quranFetch(path, {
      method,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return NextResponse.json({ error: 'Backend API error', details: errData }, { status: res.status });
    }

    const data = await res.json().catch(() => ({ success: true }));
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Quran Sync Proxy Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
