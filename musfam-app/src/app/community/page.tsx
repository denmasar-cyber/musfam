'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useSwipeDown } from '@/hooks/useSwipeDown';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import LoadingBlock from '@/components/LoadingBlock';
import { Heart, Plus, X, Search, Loader2, Globe, Users, Send, BookOpen } from 'lucide-react';

interface CommunityPost {
  id: string;
  family_id: string;
  user_id: string;
  author_name: string;
  family_name: string;
  verse_key: string | null;
  verse_arabic: string | null;
  verse_en: string | null;
  body: string;
  category: 'reflection' | 'dua' | 'reminder';
  likes_count: number;
  created_at: string;
}

interface FamilyDiscover {
  id: string;
  name: string;
  icon: string | null;
  invite_code: string;
  total_points: number;
  post_count: number;
}

const CATEGORY_CONFIG = {
  reflection: { emoji: '📿', label: 'Reflection', color: 'bg-[#075E54]/10 text-[#075E54]' },
  dua:        { emoji: '🤲', label: "Du'a",        color: 'bg-gold/15 text-[#8b6914]' },
  reminder:   { emoji: '💡', label: 'Reminder',    color: 'bg-forest/10 text-forest' },
};

function formatRelTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CommunityPage() {
  const { user, profile, family } = useAuth();
  const [tab, setTab] = useState<'feed' | 'mine' | 'discover'>('feed');

  // Feed
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [myPosts, setMyPosts] = useState<CommunityPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  // New post modal
  const [showNewPost, setShowNewPost] = useState(false);
  const swipeNewPost = useSwipeDown(() => setShowNewPost(false));
  const [postBody, setPostBody] = useState('');
  const [postCategory, setPostCategory] = useState<'reflection' | 'dua' | 'reminder'>('reflection');
  const [postVerseKey, setPostVerseKey] = useState('');
  const [postVerseArabic, setPostVerseArabic] = useState('');
  const [postVerseEn, setPostVerseEn] = useState('');
  const [verseSearch, setVerseSearch] = useState('');
  const [verseResults, setVerseResults] = useState<Array<{ surah: number; ayah: number; arab: string; terjemahan: string }>>([]);
  const [searchingVerse, setSearchingVerse] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);

  // Discover
  const [families, setFamilies] = useState<FamilyDiscover[]>([]);
  const [loadingFamilies, setLoadingFamilies] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    setLoadingPosts(true);
    const { data } = await supabase
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    setPosts((data as CommunityPost[]) || []);
    setLoadingPosts(false);

    // Load likes for current user
    if (user) {
      const { data: likes } = await supabase
        .from('community_likes')
        .select('post_id')
        .eq('user_id', user.id);
      setLikedIds(new Set((likes || []).map((l: { post_id: string }) => l.post_id)));
    }
  }, [user]);

  const loadMyPosts = useCallback(async () => {
    if (!family) return;
    const { data } = await supabase
      .from('community_posts')
      .select('*')
      .eq('family_id', family.id)
      .order('created_at', { ascending: false });
    setMyPosts((data as CommunityPost[]) || []);
  }, [family]);

  const loadFamilies = useCallback(async () => {
    if (!family) return;
    setLoadingFamilies(true);
    // Get all families except own, with their points
    const { data: fams } = await supabase
      .from('families')
      .select('id, name, icon, invite_code')
      .neq('id', family.id)
      .limit(20);

    if (!fams) { setLoadingFamilies(false); return; }

    // Get points per family
    const withStats = await Promise.all(fams.map(async (f: { id: string; name: string; icon: string | null; invite_code: string }) => {
      const { data: pts } = await supabase
        .from('points')
        .select('total_points')
        .eq('family_id', f.id);
      const total = (pts || []).reduce((s: number, r: { total_points: number }) => s + r.total_points, 0);
      const { count } = await supabase
        .from('community_posts')
        .select('*', { count: 'exact', head: true })
        .eq('family_id', f.id);
      return { ...f, total_points: total, post_count: count || 0 };
    }));

    setFamilies(withStats.sort((a, b) => b.total_points - a.total_points));
    setLoadingFamilies(false);
  }, [family]);

  useEffect(() => { loadFeed(); }, [loadFeed]);
  useEffect(() => {
    if (tab === 'mine') loadMyPosts();
    if (tab === 'discover') loadFamilies();
  }, [tab, loadMyPosts, loadFamilies]);

  async function toggleLike(postId: string) {
    if (!user) return;
    const isLiked = likedIds.has(postId);
    // Optimistic update
    const newSet = new Set(likedIds);
    if (isLiked) {
      newSet.delete(postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count - 1) } : p));
      setMyPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count - 1) } : p));
      await supabase.from('community_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      await supabase.rpc('decrement_likes', { post_id_arg: postId });
    } else {
      newSet.add(postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p));
      setMyPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p));
      await supabase.from('community_likes').insert({ post_id: postId, user_id: user.id });
      await supabase.rpc('increment_likes', { post_id_arg: postId });
    }
    setLikedIds(newSet);
  }

  async function searchVerse(q: string) {
    if (!q.trim()) { setVerseResults([]); return; }
    setSearchingVerse(true);
    try {
      const res = await fetch(`https://equran.id/api/vector?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const d = await res.json();
        setVerseResults((d.data || []).slice(0, 5));
      }
    } catch { /* silent */ }
    setSearchingVerse(false);
  }

  function selectVerse(v: { surah: number; ayah: number; arab: string; terjemahan: string }) {
    setPostVerseKey(`${v.surah}:${v.ayah}`);
    setPostVerseArabic(v.arab);
    setPostVerseEn(v.terjemahan);
    setVerseSearch('');
    setVerseResults([]);
  }

  async function submitPost() {
    if (!postBody.trim() || !user || !family || !profile) return;
    setSubmittingPost(true);
    const { data } = await supabase.from('community_posts').insert({
      family_id: family.id,
      user_id: user.id,
      author_name: profile.name,
      family_name: family.name,
      verse_key: postVerseKey || null,
      verse_arabic: postVerseArabic || null,
      verse_en: postVerseEn || null,
      body: postBody.trim(),
      category: postCategory,
    }).select().single();
    if (data) {
      setPosts(prev => [data as CommunityPost, ...prev]);
      setMyPosts(prev => [data as CommunityPost, ...prev]);
    }
    setPostBody(''); setPostVerseKey(''); setPostVerseArabic(''); setPostVerseEn('');
    setPostCategory('reflection');
    setShowNewPost(false);
    setSubmittingPost(false);
  }

  async function connectFamily(targetId: string) {
    if (!family) return;
    setConnecting(targetId);
    await supabase.from('family_connections').upsert(
      { family_id: family.id, connected_to: targetId, status: 'pending' },
      { onConflict: 'family_id,connected_to' }
    );
    setConnecting(null);
  }

  function PostCard({ post, showDelete }: { post: CommunityPost; showDelete?: boolean }) {
    const isLiked = likedIds.has(post.id);
    const cat = CATEGORY_CONFIG[post.category] || CATEGORY_CONFIG.reflection;
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
          <div className="w-9 h-9 rounded-full bg-[#075E54]/10 flex items-center justify-center font-bold text-sm text-[#075E54] flex-shrink-0">
            {post.family_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-gray-800 leading-tight">{post.author_name} <span className="text-gray-400 font-normal">· {post.family_name}</span></p>
            <p className="text-[9px] text-gray-400">{formatRelTime(post.created_at)}</p>
          </div>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${cat.color}`}>{cat.emoji} {cat.label}</span>
          {showDelete && post.user_id === user?.id && (
            <button type="button" onClick={async () => {
              await supabase.from('community_posts').delete().eq('id', post.id);
              setMyPosts(prev => prev.filter(p => p.id !== post.id));
              setPosts(prev => prev.filter(p => p.id !== post.id));
            }} className="text-gray-300 hover:text-red-400 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
        {/* Verse badge */}
        {post.verse_key && post.verse_arabic && (
          <div className="mx-4 mb-2 bg-[#E8F5E9] rounded-xl px-3 py-2 border border-[#DCF8C6]">
            <p className="text-[9px] font-bold text-[#075E54] mb-1">Quran {post.verse_key}</p>
            <p className="text-right text-base text-[#075E54] leading-loose arabic-text mb-1">{post.verse_arabic}</p>
            {post.verse_en && <p className="text-[10px] text-gray-600 italic">&quot;{post.verse_en.length > 120 ? post.verse_en.slice(0, 120) + '…' : post.verse_en}&quot;</p>}
          </div>
        )}
        {/* Body */}
        <p className="px-4 pb-3 text-sm text-gray-700 leading-relaxed">{post.body}</p>
        {/* Footer */}
        <div className="flex items-center gap-4 px-4 pb-3 border-t border-gray-50 pt-2">
          <button type="button" onClick={() => toggleLike(post.id)}
            className="flex items-center gap-1.5 text-[11px] font-bold transition-colors"
            style={{ color: isLiked ? '#e91e63' : '#9e9e9e' }}>
            <Heart size={14} fill={isLiked ? '#e91e63' : 'none'} />
            {post.likes_count > 0 && post.likes_count}
          </button>
        </div>
      </div>
    );
  }

  if (typeof window === 'undefined') return <LoadingBlock fullScreen />;

  return (
    <>
      {/* Header */}
      <div className="bg-[#075E54] text-white px-4 py-3 flex items-center justify-between flex-shrink-0 batik-overlay">
        <div>
          <p className="font-extrabold text-sm">Community</p>
          <p className="text-[10px] text-white/60">Islamic reflections between families</p>
        </div>
        <button type="button" onClick={() => setShowNewPost(true)}
          className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center shadow-md">
          <Plus size={16} className="text-white" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 bg-white flex-shrink-0">
        {([['feed', 'Feed', Globe], ['mine', 'My Posts', BookOpen], ['discover', 'Discover', Users]] as const).map(([key, label, Icon]) => (
          <button key={key} type="button" onClick={() => setTab(key as typeof tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold transition-colors ${
              tab === key ? 'text-[#075E54] border-b-2 border-[#075E54]' : 'text-gray-400'
            }`}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto hide-scrollbar bg-[#F5F5F5] pb-20 px-3 pt-3 space-y-3">
        {tab === 'feed' && (
          loadingPosts
            ? <LoadingBlock />
            : posts.length === 0
              ? <div className="text-center pt-12 text-gray-400">
                  <Globe size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="font-bold text-sm">No posts yet</p>
                  <p className="text-xs mt-1">Be the first to share a reflection!</p>
                </div>
              : posts.map(p => <PostCard key={p.id} post={p} />)
        )}
        {tab === 'mine' && (
          myPosts.length === 0
            ? <div className="text-center pt-12 text-gray-400">
                <BookOpen size={36} className="mx-auto mb-3 opacity-30" />
                <p className="font-bold text-sm">No posts from your family yet</p>
                <p className="text-xs mt-1">Share your first Islamic reflection!</p>
              </div>
            : myPosts.map(p => <PostCard key={p.id} post={p} showDelete />)
        )}
        {tab === 'discover' && (
          loadingFamilies
            ? <LoadingBlock />
            : families.length === 0
              ? <div className="text-center pt-12 text-gray-400">
                  <Users size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="font-bold text-sm">No other families yet</p>
                </div>
              : families.map(f => (
                  <div key={f.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-[#075E54]/10 flex items-center justify-center text-lg flex-shrink-0">
                      {f.icon || f.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-800">{f.name}</p>
                      <p className="text-[10px] text-gray-400">{f.total_points.toLocaleString()} pts · {f.post_count} posts</p>
                    </div>
                    <button type="button" onClick={() => connectFamily(f.id)} disabled={connecting === f.id}
                      className="px-3 py-1.5 rounded-xl bg-[#075E54] text-white text-xs font-bold disabled:opacity-50">
                      {connecting === f.id ? <Loader2 size={11} className="animate-spin" /> : 'Connect'}
                    </button>
                  </div>
                ))
        )}
      </main>

      {/* New Post Modal */}
      {showNewPost && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div ref={swipeNewPost.sheetRef}
            onTouchStart={swipeNewPost.handleTouchStart}
            onTouchMove={swipeNewPost.handleTouchMove}
            onTouchEnd={swipeNewPost.handleTouchEnd}
            className="bg-white rounded-t-3xl w-full max-w-md flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-base font-extrabold text-gray-800">New Post</h3>
              <button type="button" onClick={() => setShowNewPost(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={15} className="text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Category picker */}
              <div className="flex gap-2">
                {(['reflection', 'dua', 'reminder'] as const).map(cat => {
                  const c = CATEGORY_CONFIG[cat];
                  return (
                    <button key={cat} type="button" onClick={() => setPostCategory(cat)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${postCategory === cat ? 'bg-[#075E54] text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {c.emoji} {c.label}
                    </button>
                  );
                })}
              </div>

              {/* Verse search */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Attach a Verse <span className="normal-case font-normal">(optional)</span></p>
                {postVerseKey ? (
                  <div className="bg-[#E8F5E9] rounded-xl px-3 py-2 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-[#075E54]">Quran {postVerseKey}</p>
                      <p className="text-right text-sm text-[#075E54] arabic-text mt-0.5">{postVerseArabic}</p>
                    </div>
                    <button type="button" onClick={() => { setPostVerseKey(''); setPostVerseArabic(''); setPostVerseEn(''); }}
                      className="text-gray-400 flex-shrink-0 mt-0.5"><X size={13} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
                      <Search size={13} className="text-gray-400 flex-shrink-0" />
                      <input type="text" value={verseSearch}
                        onChange={e => { setVerseSearch(e.target.value); searchVerse(e.target.value); }}
                        placeholder="Search verse (e.g. 'patience', 'mercy')"
                        className="flex-1 text-sm bg-transparent focus:outline-none" />
                      {searchingVerse && <Loader2 size={12} className="animate-spin text-gray-400" />}
                    </div>
                    {verseResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white rounded-xl shadow-xl border border-gray-100 z-10 max-h-48 overflow-y-auto mt-1">
                        {verseResults.map((v, i) => (
                          <button key={i} type="button" onClick={() => selectVerse(v)}
                            className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                            <p className="text-[10px] font-bold text-[#075E54]">{v.surah}:{v.ayah}</p>
                            <p className="text-right text-sm arabic-text text-gray-800 leading-relaxed">{v.arab.length > 60 ? v.arab.slice(0, 60) + '…' : v.arab}</p>
                            <p className="text-[10px] text-gray-500 truncate mt-0.5">{v.terjemahan}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Post body */}
              <textarea value={postBody} onChange={e => setPostBody(e.target.value)}
                placeholder={postCategory === 'dua' ? "Share your du'a with the community..." : postCategory === 'reminder' ? 'Share an Islamic reminder...' : 'Share your reflection on this verse...'}
                className="w-full h-32 rounded-2xl border border-gray-200 p-4 text-sm focus:ring-2 focus:ring-[#075E54]/20 focus:border-[#075E54] outline-none resize-none"
                maxLength={500} />
              <p className="text-[10px] text-gray-400 text-right">{postBody.length}/500</p>
            </div>

            <div className="px-5 pb-6 pt-2 flex-shrink-0 border-t border-gray-100">
              <button type="button" onClick={submitPost}
                disabled={submittingPost || postBody.trim().length < 10}
                className="w-full bg-[#075E54] text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-40 flex items-center justify-center gap-2">
                {submittingPost ? <Loader2 size={18} className="animate-spin" /> : <><Send size={18} /> Share Post</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
