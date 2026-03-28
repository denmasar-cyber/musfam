'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { uploadProofImage } from '@/lib/store';
import { syncPostToFoundation } from '@/lib/quran-foundation-sync';
import { Send, BookOpen, X, Loader2, Trash2, Users, Mic, MicOff, Video, Camera, CornerUpLeft, ChevronLeft } from 'lucide-react';
import VideoCallModal from '@/components/VideoCallModal';
import LoadingBlock from '@/components/LoadingBlock';
import { useSwipeDown } from '@/hooks/useSwipeDown';
import { useRouter } from 'next/navigation';

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
  return `${name} ${surahStr}:${ayahStr}`;
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

export default function ChatPage() {
  const { user, profile, family } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onlineMembers, setOnlineMembers] = useState<OnlineMember[]>([]);
  const [showShareAyah, setShowShareAyah] = useState(false);
  const [shareInput, setShareInput] = useState('');
  const [shareResult, setShareResult] = useState<{ arabic: string; translation: string; key: string } | null>(null);
  const [shareLooking, setShareLooking] = useState(false);
  const [myClearedAt, setMyClearedAt] = useState<string | null>(null);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; sender: string; content: string } | null>(null);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);
  const [confirmClearMyChat, setConfirmClearMyChat] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [familyIcon, setFamilyIcon] = useState<string>('upload');
  const [dailyMission, setDailyMission] = useState<any>(null);
  const [verseOfDay, setVerseOfDay] = useState<any>(null);
  const [missionLoading, setMissionLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const iconUploadRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  void uploadProofImage; // suppress unused warning

  const closeShareAyah = useCallback(() => setShowShareAyah(false), []);
  const shareSwipe = useSwipeDown(closeShareAyah);

  useEffect(() => {
    if (family?.icon) setFamilyIcon(family.icon);
    else if (family?.id) {
       // Deep fetch if not in auth context
       supabase.from('families').select('icon').eq('id', family.id).single().then(({ data }) => {
         if (data?.icon) setFamilyIcon(data.icon);
         else setFamilyIcon('upload');
       });
    }
  }, [family]);

  const loadMessages = useCallback(async () => {
    if (!family || !user) return;
    
    setLoading(true);
    try {
      // 1. Load Messages
      // 🛡️ ECOSYSTEM SYNC: Fetch message history from Quran Foundation
      const res = await fetch(`/api/quran/sync?action=posts&room_id=${family.id}`);
      if (res.ok) {
        const data = await res.json();
        const foundationMessages: ChatMessage[] = (data.posts || []).map((p: any) => ({
          id: p.id,
          family_id: family.id,
          user_id: p.user_id,
          sender_name: p.user?.name || 'Member',
          sender_role: 'child', 
          content: p.content,
          created_at: p.created_at
        }));
        setMessages(foundationMessages);
      } else {
        const { data } = await supabase.from('family_messages').select('*').eq('family_id', family.id).order('created_at', { ascending: true }).limit(50);
        if (data) setMessages(data as ChatMessage[]);
      }

      // 2. Load Daily Mission
      setMissionLoading(true);
      const vK = Date.now().toString(); // simplistic key
      const { data: vRes } = await supabase.from('daily_verse_cache').select('*').limit(1).maybeSingle();
      if (vRes) setVerseOfDay(vRes);
      
      const { data: mRes } = await supabase.from('daily_missions').select('*').eq('family_id', family.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (mRes) setDailyMission(mRes);
      setMissionLoading(false);

    } catch (err) {
      console.error('Foundation Sync Error:', err);
    }
    setLoading(false);
  }, [family, user]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (!family) return;
    const channelArr = [
      supabase.channel(`family_chat_${family.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'family_messages', filter: `family_id=eq.${family.id}` },
          (payload) => setMessages(prev => [...prev, payload.new as ChatMessage]))
        .subscribe(),
      supabase.channel(`family_info_${family.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'families', filter: `id=eq.${family.id}` },
          (payload) => {
            const up = payload.new as any;
            setFamilyIcon(up.icon || '');
          })
        .subscribe()
    ];
    return () => { channelArr.forEach(c => supabase.removeChannel(c)); };
  }, [family]);

  useEffect(() => {
    if (!family) return;
    supabase.from('profiles').select('id, name, role').eq('family_id', family.id).then(({ data }) => {
      if (data) setOnlineMembers(data.map((p: { id: string; name: string; role: string }) => ({ user_id: p.id, name: p.name, role: p.role as 'parent' | 'child' })));
    });
  }, [family]);

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
    
    // 🛡️ ECOSYSTEM SYNC: Send to Quran Foundation Social Cloud
    await syncPostToFoundation(content, family.id);
    
    // Maintain local Supabase for instant Realtime broadcast within the family app
    await supabase.from('family_messages').insert({ 
      family_id: family.id, 
      user_id: user.id, 
      sender_name: profile.name, 
      sender_role: profile.role, 
      content 
    });
    
    setInput(''); setSending(false); inputRef.current?.focus();
  }

  async function lookupShareVerse() {
    const q = shareInput.trim();
    if (!q) return;
    setShareLooking(true); setShareResult(null);
    try {
      const res = await fetch(`/api/quran/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const d = await res.json();
        const results = d?.search?.results;
        if (results && results.length > 0) {
          const v = results[0];
          setShareResult({ arabic: v.text || '', translation: v.translations?.[0]?.text || '', key: v.verse_key });
        }
      }
    } catch { /* silent */ }
    setShareLooking(false);
  }

  async function sendShareAyah() {
    if (!shareResult || !user || !family || !profile) return;
    const text = `${verseKeyToLabel(shareResult.key)}\n${shareResult.arabic}\n\n"${shareResult.translation}"`;
    void syncPostToFoundation(text);
    await supabase.from('family_messages').insert({ family_id: family.id, user_id: user.id, sender_name: profile.name, sender_role: profile.role, content: text });
    setShowShareAyah(false); setShareInput(''); setShareResult(null);
  }

  function handleSubmit(e: React.FormEvent) { e.preventDefault(); sendMessage(input); }

  async function toggleRecording() {
    if (isRecording) {
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      setIsRecording(false); return;
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
      setTimeout(() => { if (mr.state === 'recording') { mr.stop(); setIsRecording(false); } }, 60000);
    } catch { /* mic denied */ }
  }

  function cancelVoiceNote() { setRecordedBlob(null); audioChunksRef.current = []; }

  async function sendVoiceNote() {
    if (!recordedBlob) return;
    setSendingVoice(true);
    const fileName = `voice_${Date.now()}.webm`;
    const { data: uploadData, error } = await supabase.storage.from('voice-notes').upload(fileName, recordedBlob, { contentType: 'audio/webm' });
    if (!error && uploadData) {
      const { data: urlData } = supabase.storage.from('voice-notes').getPublicUrl(uploadData.path);
      if (urlData?.publicUrl) await sendMessage(`[voice:${urlData.publicUrl}]`);
    }
    setRecordedBlob(null); audioChunksRef.current = []; setSendingVoice(false);
  }

  async function updateFamilyIcon(icon: string) {
    if (!family || profile?.role !== 'parent') return;
    const cacheBuster = icon.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`;
    const newIconUrl = icon.includes('http') ? `${icon}${cacheBuster}` : icon;
    setFamilyIcon(newIconUrl);
    await supabase.from('families').update({ icon: newIconUrl }).eq('id', family.id);
  }

  async function deleteMessage(msgId: string) {
    if (!user) return;
    setDeletingMsgId(msgId);
    await supabase.from('family_messages').delete().eq('id', msgId).eq('user_id', user.id);
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setSelectedMsgId(null); setDeletingMsgId(null);
  }

  function startReply(msg: ChatMessage) {
    setReplyTo({ id: msg.id, sender: msg.sender_name, content: msg.content });
    setSelectedMsgId(null);
  }

  async function clearMyChat() {
    if (!user || !family) return;
    setClearingChat(true);
    const now = new Date().toISOString();
    await supabase.from('chat_clear_timestamps').upsert(
      { user_id: user.id, family_id: family.id, cleared_at: now },
      { onConflict: 'user_id,family_id' }
    );
    setMyClearedAt(now); setMessages([]); setConfirmClearMyChat(false); setClearingChat(false);
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

  void myClearedAt;

  const grouped: { date: string; messages: ChatMessage[] }[] = [];
  for (const msg of messages) {
    const label = formatDate(msg.created_at);
    const last = grouped[grouped.length - 1];
    if (last && last.date === label) last.messages.push(msg);
    else grouped.push({ date: label, messages: [msg] });
  }

  if (loading) {
    return <LoadingBlock fullScreen />;
  }

  return (
    <>
      {showVideoCall && (
        <VideoCallModal
          channelName={family?.id || 'musfam-default'}
          userId={user?.id || 'anon'}
          displayName={profile?.name || 'You'}
          familyName={family?.name || 'Family'}
          onClose={() => setShowVideoCall(false)}
        />
      )}

      {/* Chat header (z-100 to stay above messages) */}
      <div className="relative bg-[#2d3a10] text-white px-3 py-2.5 flex items-center justify-between shadow-sm flex-shrink-0 z-[100] overflow-visible batik-overlay rounded-none">
        
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.push('/')} title="Back"
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors">
            <ChevronLeft size={18} className="text-white" />
          </button>
          <div className="relative overflow-visible">
            <input
              type="file"
              ref={iconUploadRef}
              className="hidden"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !user || !family) return;
                
                // Optimistic UI Update: Show the image immediately
                const localUrl = URL.createObjectURL(file);
                setFamilyIcon(localUrl);
                
                const ext = file.name.split('.').pop() || 'jpg';
                const path = `family_${family.id}.${ext}`;
                const { data: uploadData, error } = await supabase.storage
                  .from('avatars')
                  .upload(path, file, { upsert: true, contentType: file.type });
                
                if (!error && uploadData) {
                  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
                  if (urlData?.publicUrl) {
                    await updateFamilyIcon(urlData.publicUrl);
                  }
                } else if (error) {
                  console.error('Family icon upload error:', error.message);
                }
              }}
            />
            <button type="button"
              onClick={() => profile?.role === 'parent' && iconUploadRef.current?.click()}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-base select-none overflow-hidden relative z-10 hover:bg-white/30 active:scale-95 transition-all"
              title={profile?.role === 'parent' ? 'Click to change group icon' : undefined}>
              {familyIcon && familyIcon.length > 0 && familyIcon !== 'upload' ? (
                familyIcon.includes('/') ? (
                  <img src={familyIcon} alt="Group" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg">{familyIcon}</span>
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/10 text-white/50">
                   <Camera size={18} />
                </div>
              )}
            </button>
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
      
      {/* --- DAILY MISSION HEADER (Mini Goal) --- */}
      {dailyMission && !missionLoading && (
        <div className="relative px-4 pb-3 pt-1 batik-overlay border-t border-white/5 overflow-hidden">
          {/* Main Container with Glassmorphism */}
          <div className="absolute inset-0 bg-[#1a2408]/80 backdrop-blur-md" />
          
          <div className="relative bg-white/5 rounded-2xl px-4 py-3 border border-white/10 flex items-center gap-4 shadow-xl">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/10 shadow-inner">
              <BookOpen size={20} className="text-yellow-400 drop-shadow-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-[0.2em] mb-0.5">Today's Mission</p>
              <p className="text-[13px] text-white font-semibold leading-snug">
                {dailyMission.parent_override_text || dailyMission.generated_text}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable chat body */}
      <main className="flex-1 overflow-y-auto hide-scrollbar bg-[#E5DDD5] pb-[130px]">
        <div className="mt-2 space-y-1 px-2">
          {grouped.map((group) => (
            <div key={group.date} className="space-y-1">
              <div className="flex justify-center my-3">
                <span className="bg-[#E1F3FB]/80 text-[#2d3a10] text-[10px] font-bold px-3 py-1 rounded-lg shadow-sm uppercase tracking-wider">
                  {group.date}
                </span>
              </div>
              {group.messages.map((msg) => {
                const isMe = msg.user_id === user?.id;
                const isAyah = /^[A-Z].*\d+:\d+\n/.test(msg.content) || msg.content.startsWith('📖');
                const isVoice = msg.content.startsWith('[voice:');
                const isReply = msg.content.startsWith('[reply:');
                const voiceUrl = isVoice ? msg.content.slice(7, -1) : null;
                const isSelected = selectedMsgId === msg.id;
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

      {/* Fixed bottom input */}
      <div className="fixed bottom-16 left-0 right-0 z-20 max-w-md mx-auto">
        <div className="flex flex-col bg-[#F0F0F0]/90 backdrop-blur-md border-t border-black/5">
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

      {/* Share Ayah modal */}
      {showShareAyah && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) { setShowShareAyah(false); setShareInput(''); setShareResult(null); } }}>
          <div
            ref={shareSwipe.sheetRef}
            onTouchStart={shareSwipe.handleTouchStart}
            onTouchMove={shareSwipe.handleTouchMove}
            onTouchEnd={shareSwipe.handleTouchEnd}
            className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4">
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

      {/* Confirm: Clear Chat */}
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
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm">Cancel</button>
              <button type="button" onClick={clearMyChat} disabled={clearingChat}
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
