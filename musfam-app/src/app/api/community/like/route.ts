import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/community/like  body: { post_id }
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { post_id } = await req.json();
  if (!post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 });

  // Toggle like
  const { data: existing } = await supabase
    .from('community_likes')
    .select('post_id')
    .eq('post_id', post_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('community_likes').delete().eq('post_id', post_id).eq('user_id', user.id);
    await supabase.rpc('decrement_likes', { post_id_arg: post_id });
    return NextResponse.json({ liked: false });
  } else {
    await supabase.from('community_likes').insert({ post_id, user_id: user.id });
    await supabase.rpc('increment_likes', { post_id_arg: post_id });
    return NextResponse.json({ liked: true });
  }
}
