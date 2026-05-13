'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useSwipeDown } from '@/hooks/useSwipeDown';
import { useRouter } from 'next/navigation';
import { Mission, DailyMission, Profile } from '@/lib/types';
import { getDailyMission } from '@/lib/store';
import { getAppDate, getDailyVerseKey } from '@/lib/quran-api';
import { useQuranSearch } from '@/hooks/useQuranSearch';
import {
  Send, ChevronLeft, Video, Mic, MicOff, Trash2, Camera, Loader2,
  BookOpen, Users, X, CornerUpLeft, ChevronRight, MessageSquare, Search, ArrowLeft
} from 'lucide-react';
import LoadingBlock from '@/components/LoadingBlock';
import VideoCallModal from '@/components/VideoCallModal';

interface Message {
  id: string;
  family_id: string;
  user_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

const AyahBubble = ({ content }: { content: string }) => {
  const lines = content.split('\n');
  const ref = lines[0]?.replace('📖 ', '');
  const arabic = lines[1];
  const trans = lines.slice(2).join('\n');
  return (
    <div className="space-y-1.5 min-w-[200px]">
      <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#2d3a10]/50 uppercase tracking-widest border-b border-[#2d3a10]/10 pb-1">
        <BookOpen size={10} />
        {ref}
      </div>
      <p className="text-right text-lg text-[#2d3a10] leading-snug pt-1" style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}>
        {arabic}
      </p>
      <p className="text-[11px] text-gray-600 italic leading-relaxed">&quot;{trans}&quot;</p>
    </div>
  );
};

export default function ChatPage() {
  const { user, profile, family, loading: authLoading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dailyMission, setDailyMission] = useState<DailyMission | null>(null);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [familyIcon, setFamilyIcon] = useState<string | null>(null);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);
  const iconUploadRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [sendingVoice, setSendingVoice] = useState(false);

  // Message selection & reply
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; sender: string; content: string } | null>(null);

  // Clear chat
  const [confirmClearMyChat, setConfirmClearMyChat] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);

  // Share Ayah — uses refined shared hook
  const quran = useQuranSearch();
  const [showShareAyah, setShowShareAyah] = useState(false);
  const shareSwipe = useSwipeDown(() => setShowShareAyah(false));

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (!family || !user || authLoading) return;
    setFamilyIcon(family.icon || null);

    const loadData = async () => {
      const todayStr = getAppDate().toISOString().split('T')[0];
      const vKey = getDailyVerseKey();
      
      const vDataRes = await fetch(`https://api.quran.com/api/v4/verses/by_key/${vKey}?translations=131&fields=text_uthmani`);
      const vData = vDataRes.ok ? await vDataRes.json() : null;
      const trans = vData?.verse?.translations?.[0]?.text?.replace(/<[^>]*>/g, '') || '';
      
      const dm = await getDailyMission(family.id, todayStr, vKey, trans, family.name);
      setDailyMission(dm);

      const { data } = await supabase.from('family_messages').select('*').eq('family_id', family.id).order('created_at', { ascending: true });
      if (data) {
        setMessages(data);
      }
      setLoading(false);
      setTimeout(() => scrollToBottom('auto'), 100);
    };
    loadData();

    const channel = supabase.channel(`family_messages:${family.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_messages', filter: `family_id=eq.${family.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const nm = payload.new as Message;
          // Replace optimistic message (same user + same content within 5s) or add new
          setMessages(prev => {
            const optIdx = prev.findIndex(
              m => m.id.startsWith('opt-') && m.user_id === nm.user_id && m.content === nm.content
            );
            if (optIdx !== -1) {
              const updated = [...prev];
              updated[optIdx] = nm;
              return updated;
            }
            return [...prev, nm];
          });
          setTimeout(() => scrollToBottom(), 100);
        } else if (payload.eventType === 'DELETE') {
          // payload.old.id may be undefined if RLS blocks old row; use safe fallback
          const deletedId = payload.old?.id;
          if (deletedId) {
            setMessages(prev => prev.filter(m => m.id !== deletedId));
          }
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [family, user, authLoading]);

  const sendMessage = async (content: string) => {
    if (!user || !profile || !family || !content.trim()) return;
    let finalContent = content.trim();
    if (replyTo) { finalContent = `[reply:${replyTo.sender}: ${replyTo.content}]\n${finalContent}`; setReplyTo(null); }
    // Optimistic update: clear input & show sending state immediately
    const optimisticId = `opt-${Date.now()}`;
    const optimisticMsg: Message = {
      id: optimisticId,
      family_id: family.id,
      user_id: user.id,
      sender_name: profile.name,
      sender_role: profile.role,
      content: finalContent,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setInput('');
    setSending(true);
    setTimeout(() => scrollToBottom(), 50);
    const { error } = await supabase.from('family_messages').insert({
      family_id: family.id,
      user_id: user.id,
      sender_name: profile.name,
      sender_role: profile.role,
      content: finalContent,
    });
    if (error) {
      console.error(error);
      // Roll back optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
    }
    // Real message will arrive via realtime INSERT event and replace optimistic one
    setSending(false);
    inputRef.current?.focus();
  };

  const deleteMessage = async (id: string) => {
    // Optimistic update: remove from UI immediately
    setMessages(prev => prev.filter(m => m.id !== id));
    setSelectedMsgId(null);
    const { error } = await supabase.from('family_messages').delete().eq('id', id);
    if (error) {
      console.error(error);
      // Could reload messages here on failure, for now log it
    }
  };

  const clearChat = async (mode: 'all' | 'mine') => {
    if (!family) return;
    setClearingChat(true);
    if (mode === 'all') {
      // Delete all messages in this family chat
      setMessages([]);
      const { error } = await supabase.from('family_messages').delete().eq('family_id', family.id);
      if (error) console.error('clearChat all error:', error);
    } else {
      // Delete only this user's messages
      setMessages(prev => prev.filter(m => m.user_id !== user?.id));
      const { error } = await supabase.from('family_messages').delete().eq('family_id', family.id).eq('user_id', user!.id);
      if (error) console.error('clearChat mine error:', error);
    }
    setClearingChat(false);
    setConfirmClearMyChat(false);
  };

  const uploadFamilyIcon = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !family) return;
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `family_${family.id}_${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (error) console.error('Upload err:', error.message);
      if (data) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        if (urlData?.publicUrl) {
          const { error: updateErr } = await supabase.from('families').update({ icon: urlData.publicUrl }).eq('id', family.id);
          if (!updateErr) setFamilyIcon(urlData.publicUrl);
        }
      }
    } catch (err) { console.error('Upload catch err:', err); }
  };

  const toggleRecording = async () => {
    if (isRecording) { mediaRecorder?.stop(); setIsRecording(false); }
    else {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(s);
        const chunks: Blob[] = [];
        mr.ondataavailable = (e) => chunks.push(e.data);
        mr.onstop = () => { setRecordedBlob(new Blob(chunks, { type: 'audio/webm' })); s.getTracks().forEach(t => t.stop()); };
        mr.start();
        setMediaRecorder(mr);
        setIsRecording(true);
      } catch (e) { alert('Mic access denied'); }
    }
  };

  const sendVoiceNote = async () => {
    if (!recordedBlob || !user || !family) return;
    setSendingVoice(true);
    const path = `chat/${family.id}/${user.id}/${Date.now()}.webm`;
    const { error: upErr } = await supabase.storage.from('voice-notes').upload(path, recordedBlob);
    if (upErr) { console.error(upErr); setSendingVoice(false); return; }
    const { data: q } = supabase.storage.from('voice-notes').getPublicUrl(path);
    await sendMessage(`[voice:${q.publicUrl}]`);
    setRecordedBlob(null);
    setSendingVoice(false);
  };

  const cancelVoiceNote = () => setRecordedBlob(null);

  const startReply = (m: Message) => { setReplyTo({ id: m.id, sender: m.sender_name, content: m.content }); setSelectedMsgId(null); inputRef.current?.focus(); };

  const grouped = useMemo(() => {
    const list: { date: string; messages: Message[] }[] = [];
    messages.forEach(m => {
      const d = formatDateLabel(m.created_at);
      if (list.length === 0 || list[list.length - 1].date !== d) list.push({ date: d, messages: [m] });
      else list[list.length - 1].messages.push(m);
    });
    return list;
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (input.trim()) sendMessage(input); };

  if (authLoading || loading) return <LoadingBlock fullScreen />;

  return (
    <>
      <div className="flex flex-col h-full bg-[#E5DDD5]">
        {/* --- Truly Magnetic Header Overlay --- */}
        <div className="fixed top-0 left-0 right-0 z-50 flex flex-col shadow-lg max-w-md mx-auto">
          <div className="flex-shrink-0 bg-[#2d3a10] px-4 py-3.5 flex items-center justify-between border-b border-white/5 relative overflow-hidden batik-overlay">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/')} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-90">
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-2.5">
                <div onClick={() => iconUploadRef.current?.click()} className="cursor-pointer hover:opacity-80 transition-opacity w-9 h-9 rounded-full bg-white/20 border border-white/20 flex items-center justify-center font-bold text-white text-sm shadow-inner overflow-hidden">
                  <input type="file" accept="image/*" ref={iconUploadRef} onChange={uploadFamilyIcon} className="hidden" />
                  {familyIcon ? <img src={familyIcon} alt="F" className="w-full h-full object-cover" /> : (family?.name?.[0]?.toUpperCase() || 'F')}
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-white tracking-tight leading-none mb-1">{family?.name || 'Loading...'}</h2>
                  <span className="text-[9px] text-[#c8a84b] font-bold uppercase tracking-widest flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-[#c8a84b] animate-pulse" />
                    Family Chat
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowVideoCall(true)} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-white/10 hover:bg-white/20">
                <Video size={16} className="text-white/90" />
              </button>
              <button onClick={() => setConfirmClearMyChat(true)} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-white/10 hover:bg-white/20">
                <Trash2 size={15} className="text-white/80" />
              </button>
            </div>
          </div>
          {dailyMission && (
            <div className="bg-[#2d3a10] batik-overlay relative overflow-hidden">
               <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
               <button onClick={() => { window.location.href = '/?tab=missions&action=chat'; }} className="w-full px-4 py-3 flex items-center gap-3 active:bg-white/5 transition-colors text-left">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/10 shadow-inner">
                  <BookOpen size={18} className="text-yellow-400 opacity-90" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] text-white/40 font-bold uppercase tracking-[0.2em] mb-0.5">Today's Mini Goal</p>
                    <div className="text-[#c8a84b] text-[8px] font-extrabold px-1.5 py-0.5 rounded border border-[#c8a84b]/30 uppercase tracking-widest leading-none">CLAIM PROGRESS</div>
                  </div>
                  <p className="text-xs text-white font-medium leading-tight truncate opacity-85">{dailyMission.parent_override_text || dailyMission.generated_text}</p>
                </div>
              </button>
            </div>
          )}
        </div>

        <main className="flex-1 overflow-y-auto hide-scrollbar bg-[#E5DDD5] pb-[130px] pt-[115px]">
          <div className="mt-2 space-y-1 px-2">
            {grouped.map((group) => (
              <div key={group.date} className="space-y-1">
                <div className="flex justify-center my-3">
                  <span className="bg-[#E1F3FB]/80 text-[#2d3a10] text-[10px] font-bold px-3 py-1 rounded-lg shadow-sm uppercase tracking-wider">{group.date}</span>
                </div>
                {group.messages.map((msg) => {
                  const isMe = msg.user_id === user?.id;
                  const isAyah = /^[A-Z].*\d+:\d+\n/.test(msg.content) || msg.content.startsWith('📖');
                  const isVoice = msg.content.startsWith('[voice:');
                  const isReply = msg.content.startsWith('[reply:');
                  const voiceUrl = isVoice ? msg.content.slice(7, -1) : null;
                  const isSelected = selectedMsgId === msg.id;
                  let replyHeader = ''; let mainContent = msg.content;
                  if (isReply) {
                    const nl = msg.content.indexOf('\n');
                    if (nl !== -1) { replyHeader = msg.content.slice(0, nl).replace('[reply:', '').replace(']', '').trim(); mainContent = msg.content.slice(nl + 1); }
                  }
                  return (
                    <div key={msg.id}>
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} px-1 transition-colors ${isSelected ? 'bg-[#2d3a10]/10 rounded-xl' : ''}`}
                        onClick={() => setSelectedMsgId(isSelected ? null : msg.id)}>
                        <div className={`max-w-[80%] rounded-xl px-3 py-2 shadow-sm relative ${isMe ? 'bg-[#DCF8C6] rounded-tr-none' : 'bg-white rounded-tl-none'} ${isAyah ? 'border border-[#5a6b28]/30' : ''}`}>
                          {!isMe && <p className={`text-[10px] font-bold mb-0.5 ${msg.sender_role === 'parent' ? 'text-[#2d3a10]' : 'text-[#8b6914]'}`}>{msg.sender_name}</p>}
                          {isReply && replyHeader && <div className="bg-black/5 rounded-lg px-2 py-1 mb-1.5 border-l-2 border-[#2d3a10]/40"><p className="text-[9px] font-bold text-[#2d3a10]/70">{replyHeader}</p></div>}
                          {isVoice && voiceUrl ? <audio controls src={voiceUrl} className="w-[200px] h-9 my-0.5" /> : isAyah ? <AyahBubble content={mainContent} /> : <p className="text-sm text-gray-800 break-words whitespace-pre-wrap leading-relaxed">{mainContent}</p>}
                          <div className="flex items-center justify-end gap-1 mt-0.5"><span className="text-[9px] text-gray-400 font-medium">{formatTime(msg.created_at)}</span>{isMe && <span className="text-[#34B7F1] text-[10px]">✓✓</span>}</div>
                          <div className={`absolute top-0 w-2.5 h-2.5 ${isMe ? '-right-2 bg-[#DCF8C6] [clip-path:polygon(0_0,0_100%,100%_0)]' : '-left-2 bg-white [clip-path:polygon(100%_0,100%_100%,0_0)]'}`} />
                        </div>
                      </div>
                      {isSelected && (
                        <div className={`flex items-center gap-2 px-3 py-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <button onClick={() => startReply(msg)} className="flex items-center gap-1 bg-white rounded-full px-3 py-1 shadow-sm text-[11px] font-bold text-[#2d3a10] border border-black/5"><CornerUpLeft size={11} /> Reply</button>
                          {isMe && <button onClick={() => deleteMessage(msg.id)} disabled={deletingMsgId === msg.id} className="flex items-center gap-1 bg-red-50 rounded-full px-3 py-1 shadow-sm text-[11px] font-bold text-red-500 border border-red-100 disabled:opacity-50">{deletingMsgId === msg.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} Delete</button>}
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

        <div className="fixed bottom-16 left-0 right-0 z-20 max-w-md mx-auto">
          <div className="flex flex-col bg-[#F0F0F0]/90 backdrop-blur-md border-t border-black/5 shadow-2xl">
            {replyTo && (
              <div className="flex items-center gap-2 px-4 pt-2 pb-1">
                <div className="flex-1 bg-white rounded-xl px-3 py-1.5 border-l-2 border-[#2d3a10] min-w-0">
                  <p className="text-[10px] font-bold text-[#2d3a10]">{replyTo.sender}</p>
                  <p className="text-[11px] text-gray-500 truncate">{replyTo.content.length > 50 ? replyTo.content.slice(0, 50) + '…' : replyTo.content}</p>
                </div>
                <button title="Cancel reply" onClick={() => setReplyTo(null)} className="text-gray-400 flex-shrink-0"><X size={16} /></button>
              </div>
            )}
            {recordedBlob ? (
              <div className="flex items-center gap-2 px-3 pb-2 pt-2">
                <div className="flex-1 bg-white border border-black/10 rounded-full px-4 py-2.5 flex items-center gap-2 shadow-inner">
                  <Mic size={14} className="text-[#5a6b28] flex-shrink-0" /><span className="text-sm text-gray-600 flex-1">Voice note ready</span>
                  <button title="Cancel" onClick={cancelVoiceNote} className="text-gray-400 hover:text-red-400"><X size={15} /></button>
                </div>
                <button onClick={sendVoiceNote} disabled={sendingVoice} className="w-10 h-10 rounded-full bg-[#5a6b28] text-white flex items-center justify-center shadow-md disabled:opacity-50">{sendingVoice ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 pb-2 pt-2">
                <div className={`flex-1 bg-white border rounded-full px-4 py-2.5 flex items-center shadow-inner transition-colors ${isRecording ? 'border-red-300 bg-red-50' : 'border-black/10'}`}>
                  {isRecording ? <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><span className="flex-1 text-sm text-red-500 font-medium ml-2">Recording...</span></> : (
                    <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Type a message..." className="flex-1 text-sm focus:outline-none bg-transparent" />
                  )}
                  {!isRecording && (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setShowShareAyah(true)} className="p-1 px-2 text-[#2d3a10]/50 hover:text-[#2d3a10]"><BookOpen size={16} /></button>
                      <button type="button" onClick={() => router.push('/quran?tab=khatam')} className="p-1 px-2 text-[#2d3a10]/50 hover:text-[#2d3a10]"><Users size={16} /></button>
                    </div>
                  )}
                  <button type="button" onClick={toggleRecording} className={`ml-1.5 flex-shrink-0 transition-colors ${isRecording ? 'text-red-500' : 'text-[#2d3a10]/50'}`}>{isRecording ? <MicOff size={16} /> : <Mic size={16} />}</button>
                </div>
                {!isRecording && <button type="submit" disabled={sending || !input.trim()} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${input.trim() ? 'bg-[#5a6b28] text-white shadow-md' : 'bg-gray-200 text-gray-400'}`}>{sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}</button>}
              </form>
            )}
          </div>
        </div>
      </div>

      {/* --- Share Ayah Modal (Refined) --- */}
      {showShareAyah && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            onTouchStart={shareSwipe.handleTouchStart}
            onTouchMove={shareSwipe.handleTouchMove}
            onTouchEnd={shareSwipe.handleTouchEnd}
            ref={shareSwipe.sheetRef} 
            className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col transition-transform duration-300 h-[85vh] sm:h-auto sm:max-h-[80vh]"
          >
            <div className="flex justify-center pb-4 sm:hidden"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {quran.surahMatch ? (
                  <button onClick={() => quran.setSurahMatch(null)} className="p-1 -ml-1 text-gray-400"><ArrowLeft size={18}/></button>
                ) : <BookOpen size={18} className="text-[#2d3a10]" />}
                <h3 className="text-lg font-bold text-gray-800">{quran.surahMatch ? quran.surahMatch.name : 'Share Quran Ayah'}</h3>
              </div>
              <button onClick={() => { setShowShareAyah(false); quran.reset(); }} className="text-gray-400"><X size={20} /></button>
            </div>

            <div className="relative mb-4">
              <input type="text" value={quran.query} onChange={e => { quran.setQuery(e.target.value); quran.search(e.target.value); }}
                placeholder="Search Surah or Theme (e.g. 'Patience')" className="w-full bg-gray-100 border-none rounded-2xl px-5 py-3.5 pr-12 text-sm font-medium focus:ring-2 focus:ring-[#2d3a10]/10 transition-all"/>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">{quran.searching ? <Loader2 size={18} className="animate-spin"/> : <Search size={18}/>}</div>
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar space-y-2 pb-4">
              {quran.surahMatch ? (
                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Select Ayah from {quran.surahMatch.name}</p>
                  <div className="flex gap-2">
                    <input type="number" value={quran.ayahInput} onChange={e => quran.setAyahInput(e.target.value)} placeholder={`1-${quran.surahMatch.total}`} className="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-sm font-bold"/>
                    <button onClick={() => quran.loadSurahVerses(quran.surahMatch!.num, parseInt(quran.ayahInput) || 1)} className="bg-[#2d3a10] text-white px-6 rounded-xl font-bold text-sm">Load</button>
                  </div>
                  {quran.verseLoading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin text-[#2d3a10]"/></div> : (
                    <div className="divide-y divide-gray-50">
                      {quran.verses.map(v => (
                        <button key={v.key} onClick={() => { sendMessage(`📖 ${v.key}\n${v.arabic}\n${v.translation}`); setShowShareAyah(false); quran.reset(); }}
                          className="w-full py-4 px-2 text-left hover:bg-gray-50 flex items-start gap-3 transition-colors group">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400 group-hover:bg-[#2d3a10] group-hover:text-white transition-colors">{v.key.split(':')[1]}</div>
                          <div className="flex-1"><p className="text-right text-lg text-[#2d3a10] mb-1" style={{fontFamily: "'Amiri Quran', serif"}}>{v.arabic}</p><p className="text-xs text-gray-500 italic">"{v.translation.slice(0, 80)}..."</p></div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : quran.results.length > 0 ? (
                <div className="space-y-1">
                  {quran.results.map((r) => (
                    <button key={r.verse_key} onClick={() => { sendMessage(`📖 ${r.verse_key}\n${r.text}\n${r.translations?.[0]?.text?.replace(/<[^>]*>/g, '')}`); setShowShareAyah(false); quran.reset(); }}
                      className="w-full p-4 rounded-2xl bg-white border border-gray-100 hover:border-[#2d3a10]/30 hover:bg-gray-50/50 transition-all text-left">
                      <div className="flex items-center justify-between mb-2"><span className="text-[10px] font-bold text-[#2d3a10] uppercase tracking-widest">{r.verse_key}</span><ChevronRight size={14} className="text-gray-300"/></div>
                      <p className="text-right text-lg text-[#2d3a10] truncate mb-1" style={{fontFamily: "'Amiri Quran', serif"}}>{r.text}</p>
                      <p className="text-xs text-gray-500 truncate italic">"{r.translations?.[0]?.text?.replace(/<[^>]*>/g, '')}"</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                  <BookOpen size={40} className="mb-3"/>
                  <p className="text-sm font-medium">Search for an Ayah or Surah<br/>to share with your family</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showVideoCall && <VideoCallModal channelName={`call-${family?.id}`} userId={user!.id} displayName={profile!.name} familyName={family?.name || 'Musfam'} userRole={profile!.role} familyId={family?.id} onClose={() => setShowVideoCall(false)} />}

      {/* --- Clear Chat Confirmation Modal --- */}
      {confirmClearMyChat && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-gray-900">Clear Chat</h3>
                <p className="text-xs text-gray-500">Choose what you want to delete</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => clearChat('mine')}
                disabled={clearingChat}
                className="w-full py-3 px-4 rounded-2xl bg-[#f0f5e8] border border-[#2d3a10]/10 text-left flex items-center gap-3 hover:bg-[#e4edcc] transition-colors disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-xl bg-[#2d3a10]/10 flex items-center justify-center">
                  {clearingChat ? <Loader2 size={14} className="animate-spin text-[#2d3a10]" /> : <Trash2 size={14} className="text-[#2d3a10]" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#2d3a10]">Clear My Messages</p>
                  <p className="text-[11px] text-gray-400">Only deletes messages you sent</p>
                </div>
              </button>
              {(profile?.role === 'parent' || profile?.role === 'guardian') && (
                <button
                  onClick={() => clearChat('all')}
                  disabled={clearingChat}
                  className="w-full py-3 px-4 rounded-2xl bg-red-50 border border-red-100 text-left flex items-center gap-3 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
                    {clearingChat ? <Loader2 size={14} className="animate-spin text-red-500" /> : <Trash2 size={14} className="text-red-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-600">Clear Entire Chat</p>
                    <p className="text-[11px] text-gray-400">Deletes ALL family messages — irreversible</p>
                  </div>
                </button>
              )}
            </div>
            <button
              onClick={() => setConfirmClearMyChat(false)}
              disabled={clearingChat}
              className="w-full py-2.5 rounded-2xl bg-gray-100 text-sm font-bold text-gray-500 hover:bg-gray-200 transition-colors"
            >Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}
