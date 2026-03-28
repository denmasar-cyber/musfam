import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return supabase;
}

// GET /api/community?limit=20&offset=0&family_id=<uuid>
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const offset = parseInt(searchParams.get('offset') || '0');
  const familyId = searchParams.get('family_id');

  const supabase = getSupabase(req);

  let query = supabase
    .from('community_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (familyId) query = query.eq('family_id', familyId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data || [] });
}

// POST /api/community — create a post
export async function POST(req: NextRequest) {
  const supabase = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { verse_key, verse_arabic, verse_en, body: postBody, category, family_id, author_name, family_name } = body;

  if (!postBody?.trim()) return NextResponse.json({ error: 'Body required' }, { status: 400 });

  const { data, error } = await supabase.from('community_posts').insert({
    family_id,
    user_id: user.id,
    author_name: author_name || 'Anonymous',
    family_name: family_name || 'Family',
    verse_key: verse_key || null,
    verse_arabic: verse_arabic || null,
    verse_en: verse_en || null,
    body: postBody.trim(),
    category: category || 'reflection',
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data }, { status: 201 });
}
