'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSwipeDown } from '@/hooks/useSwipeDown';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Users, Monitor, MonitorOff,
  BookOpen, X, Smile, Bell, CheckSquare, Square, Plus, Trash2,
  Search, ChevronRight, ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import RiverLoading from '@/components/RiverLoading';

export interface IncomingCallInfo {
  callerName: string;
  familyName: string;
  channelName: string;
  callerId: string;
}

const EMOJI_REACTIONS = ['❤️', '😂', '🤲', '🌙', '⭐', '📖', '🕌', '💚'];

interface FloatingEmoji { id: number; emoji: string; x: number }
interface CallTodo { id: string; text: string; done: boolean }

interface VideoCallModalProps {
  channelName: string;
  userId: string;
  displayName: string;
  familyName: string;
  onClose: () => void;
}

interface Peer {
  uid: string;
  name: string;
  connection: RTCPeerConnection;
  remoteStream: MediaStream | null;
  videoRef?: HTMLVideoElement;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface PrayerTime { name: string; time: string }

function usePrayerTimes() {
  const [prayers, setPrayers] = useState<PrayerTime[]>([]);
  const [nextPrayer, setNextPrayer] = useState<PrayerTime | null>(null);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const cached = sessionStorage.getItem('call_prayer_times');
        let timings: Record<string, string>;
        if (cached) {
          timings = JSON.parse(cached);
        } else {
          const res = await fetch('https://api.aladhan.com/v1/timingsByCity?city=Jakarta&country=Indonesia&method=11');
          const d = await res.json();
          timings = d?.data?.timings || {};
          sessionStorage.setItem('call_prayer_times', JSON.stringify(timings));
        }
        const keys = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        const list = keys.map(k => ({ name: k, time: timings[k] || '' })).filter(p => p.time);
        setPrayers(list);
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const next = list.find(p => {
          const [h, m] = p.time.split(':').map(Number);
          return h * 60 + m > nowMins;
        });
        setNextPrayer(next || list[0] || null);
      } catch { /* silent */ }
    }
    load();
  }, []);

  useEffect(() => {
    if (!nextPrayer) return;
    const check = () => {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const [h, m] = nextPrayer.time.split(':').map(Number);
      const diff = h * 60 + m - nowMins;
      if (diff === 5) setReminderMsg(`${nextPrayer.name} in 5 minutes (${nextPrayer.time})`);
      else if (diff === 0) setReminderMsg(`Time for ${nextPrayer.name} prayer!`);
    };
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
  }, [nextPrayer]);

  return { prayers, nextPrayer, reminderMsg, setReminderMsg };
}

// ── Quran search — mirrors quran/page.tsx search logic ──────────────────────
interface QuranSearchResult {
  verse_key: string;
  text: string;
  translations: { text: string }[];
}
interface QuranSurahMatch {
  num: number;
  name: string;
  total: number;
}
// A loaded verse (or full surah list)
interface LoadedVerse { key: string; arabic: string; translation: string }

function useQuranSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<QuranSearchResult[]>([]);
  const [surahMatch, setSurahMatch] = useState<QuranSurahMatch | null>(null);
  const [ayahInput, setAyahInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [verseLoading, setVerseLoading] = useState(false);
  // Can be one verse or a whole surah list
  const [verses, setVerses] = useState<LoadedVerse[]>([]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    setResults([]);
    setSurahMatch(null);
    setAyahInput('');
    setVerses([]);
    try {
      const res = await fetch(`/api/quran/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const d = await res.json();
        if (d.search?.surah) {
          setSurahMatch({ num: d.search.surah, name: q, total: d.search.total });
        } else {
          setResults(d.search?.results || []);
        }
      }
    } catch { /* silent */ }
    setSearching(false);
  }, []);

  // Load a surah's verses from the given start ayah.
  // Always loads the full chapter so we can display from ayahFrom onwards.
  const loadSurahVerses = useCallback(async (surahNum: number, fromAyah = 1) => {
    setVerseLoading(true);
    setVerses([]);
    try {
      const res = await fetch(`/api/quran/verses?chapter=${surahNum}&per_page=300`);
      if (res.ok) {
        const d = await res.json();
        const all: Array<{ verse_key: string; text_uthmani?: string; translation?: string }> = d.verses || [];
        const mapped = all
          .filter(v => {
            const [, a] = v.verse_key.split(':');
            return parseInt(a, 10) >= fromAyah;
          })
          .map(v => ({ key: v.verse_key, arabic: v.text_uthmani || '', translation: v.translation || '' }));
        setVerses(mapped);
      }
    } catch { /* silent */ }
    setVerseLoading(false);
  }, []);

  const reset = useCallback(() => {
    setVerses([]);
    setSurahMatch(null);
    setResults([]);
    setQuery('');
    setAyahInput('');
  }, []);

  return {
    query, setQuery,
    results,
    surahMatch, setSurahMatch,
    ayahInput, setAyahInput,
    searching, verseLoading,
    verses, setVerses,
    search, loadSurahVerses, reset,
  };
}

export default function VideoCallModal({
  channelName,
  userId,
  displayName,
  familyName,
  onClose,
}: VideoCallModalProps) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [peers, setPeers] = useState<{ uid: string; name: string; hasVideo: boolean }[]>([]);
  const [connecting, setConnecting] = useState(true);
  const [camBlocked, setCamBlocked] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [screenSharing, setScreenSharing] = useState(false);

  type Panel = 'none' | 'quran' | 'prayers' | 'todos' | 'emoji';
  const [activePanel, setActivePanel] = useState<Panel>('none');
  const swipePanel = useSwipeDown(() => setActivePanel('none'));

  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const emojiCounterRef = useRef(0);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const [todos, setTodos] = useState<CallTodo[]>([]);
  const [todoInput, setTodoInput] = useState('');

  const { prayers, nextPrayer, reminderMsg, setReminderMsg } = usePrayerTimes();
  const quran = useQuranSearch();

  // Callback ref: fires every time the self-video element mounts/remounts.
  // Immediately attaches the local stream so camera appears as soon as DOM is ready.
  const attachSelfStream = useCallback((el: HTMLVideoElement | null) => {
    (selfVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    if (el && localStreamRef.current) {
      el.srcObject = localStreamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  // Re-attach after stream arrives (if video element was already mounted before stream)
  const attachStreamToVideo = useCallback(() => {
    const el = selfVideoRef.current;
    const stream = localStreamRef.current;
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
  }, []);

  // Re-attach whenever stream becomes ready (covers async timing between stream + DOM mount)
  useEffect(() => {
    if (streamReady) attachStreamToVideo();
  }, [streamReady, attachStreamToVideo]);

  // Clock
  const [clock, setClock] = useState('');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);

  const localStreamRef = useRef<MediaStream | null>(null);
  const selfVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleSignalRef = useRef<((msg: { from: string; to: string; type: string; payload: unknown; name: string }) => Promise<void>) | null>(null);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const sigChannel = `video-call-${channelName}`;

  const sendSignal = useCallback((to: string, type: string, payload: unknown) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'signal',
      payload: { from: userId, to, type, payload, name: displayName },
    });
  }, [userId, displayName]);

  const createPeerConnection = useCallback((remoteUid: string, remoteName: string, initiator: boolean) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal(remoteUid, 'ice', e.candidate);
    };

    const remoteStream = new MediaStream();
    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach(t => remoteStream.addTrack(t));
      const peer = peersRef.current.get(remoteUid);
      if (peer) {
        peer.remoteStream = remoteStream;
        if (peer.videoRef) peer.videoRef.srcObject = remoteStream;
      }
      setPeers(prev => {
        const exists = prev.find(p => p.uid === remoteUid);
        if (exists) return prev.map(p => p.uid === remoteUid ? { ...p, hasVideo: true } : p);
        return [...prev, { uid: remoteUid, name: remoteName, hasVideo: true }];
      });
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        peersRef.current.delete(remoteUid);
        setPeers(prev => prev.filter(p => p.uid !== remoteUid));
      }
    };

    const peer: Peer = { uid: remoteUid, name: remoteName, connection: pc, remoteStream: null };
    peersRef.current.set(remoteUid, peer);
    setPeers(prev => {
      if (prev.find(p => p.uid === remoteUid)) return prev;
      return [...prev, { uid: remoteUid, name: remoteName, hasVideo: false }];
    });

    if (initiator) {
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        sendSignal(remoteUid, 'offer', offer);
      });
    }
    return pc;
  }, [sendSignal]);

  handleSignalRef.current = useCallback(async (msg: { from: string; to: string; type: string; payload: unknown; name: string }) => {
    if (msg.to !== userId && msg.to !== '*') return;
    if (msg.from === userId) return;

    const from = msg.from;
    const name = msg.name || from;

    if (msg.type === 'join') { createPeerConnection(from, name, true); return; }

    if (msg.type === 'emoji') {
      const id = ++emojiCounterRef.current;
      setFloatingEmojis(prev => [...prev, { id, emoji: msg.payload as string, x: Math.random() * 70 + 10 }]);
      setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== id)), 3000);
      return;
    }

    if (msg.type === 'todo_sync') { setTodos(msg.payload as CallTodo[]); return; }

    let pc = peersRef.current.get(from)?.connection;
    if (!pc && msg.type === 'offer') pc = createPeerConnection(from, name, false);
    if (!pc) return;

    if (msg.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(from, 'answer', answer);
    } else if (msg.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit));
    } else if (msg.type === 'ice') {
      await pc.addIceCandidate(new RTCIceCandidate(msg.payload as RTCIceCandidateInit)).catch(() => null);
    }
  }, [userId, createPeerConnection, sendSignal]);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      // Request camera+mic. Try increasingly permissive constraints then audio-only.
      // IMPORTANT: must run from HTTPS or localhost — browser blocks getUserMedia on HTTP.
      let gotStream = false;
      let videoGranted = false;
      const constraintSets = [
        { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: true },
        { video: true, audio: true },
        { video: true, audio: false },
        { video: false, audio: true },
      ];
      for (const constraints of constraintSets) {
        if (gotStream || cancelled) break;
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
          localStreamRef.current = stream;
          videoGranted = stream.getVideoTracks().length > 0;
          if (!videoGranted) setCamOn(false);
          // Attach immediately — video element may or may not exist yet
          attachStreamToVideo();
          setStreamReady(true);
          gotStream = true;
        } catch { /* try next */ }
      }
      if (!gotStream) {
        setCamOn(false);
        setCamBlocked(true);
      } else if (!videoGranted) {
        setCamBlocked(true);
      }

      const ch = supabase.channel(sigChannel, { config: { broadcast: { self: false } } });
      channelRef.current = ch;
      ch.on('broadcast', { event: 'signal' }, ({ payload }) => {
        handleSignalRef.current?.(payload as { from: string; to: string; type: string; payload: unknown; name: string });
      });
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED' && !cancelled) {
          ch.send({ type: 'broadcast', event: 'signal', payload: { from: userId, to: '*', type: 'join', payload: null, name: displayName } });
          setConnecting(false);
          timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        }
      });
    }
    start();
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      peersRef.current.forEach(p => p.connection.close());
      peersRef.current.clear();
      channelRef.current?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const broadcastTodos = useCallback((list: CallTodo[]) => {
    channelRef.current?.send({
      type: 'broadcast', event: 'signal',
      payload: { from: userId, to: '*', type: 'todo_sync', payload: list, name: displayName },
    });
  }, [userId, displayName]);

  const addTodo = () => {
    const text = todoInput.trim();
    if (!text) return;
    const next = [...todos, { id: Date.now().toString(), text, done: false }];
    setTodos(next);
    broadcastTodos(next);
    setTodoInput('');
  };

  const toggleTodo = (id: string) => {
    const next = todos.map(t => t.id === id ? { ...t, done: !t.done } : t);
    setTodos(next); broadcastTodos(next);
  };

  const deleteTodo = (id: string) => {
    const next = todos.filter(t => t.id !== id);
    setTodos(next); broadcastTodos(next);
  };

  const sendEmoji = (emoji: string) => {
    const id = ++emojiCounterRef.current;
    setFloatingEmojis(prev => [...prev, { id, emoji, x: Math.random() * 70 + 10 }]);
    setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== id)), 3000);
    setActivePanel('none');
    channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: { from: userId, to: '*', type: 'emoji', payload: emoji, name: displayName } });
  };

  const handleEnd = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    peersRef.current.forEach(p => p.connection.close());
    peersRef.current.clear();
    channelRef.current?.unsubscribe();
    onClose();
  };

  const stopScreenShare = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach(t => { t.onended = null; t.stop(); });
    screenStreamRef.current = null;
    setScreenSharing(false);
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const newCamTrack = camStream.getVideoTracks()[0];
      peersRef.current.forEach(p => {
        const sender = p.connection.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(newCamTrack);
      });
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(t => { localStreamRef.current!.removeTrack(t); t.stop(); });
        localStreamRef.current.addTrack(newCamTrack);
      }
      if (selfVideoRef.current) {
        selfVideoRef.current.srcObject = localStreamRef.current;
        selfVideoRef.current.play().catch(() => {});
      }
    } catch { /* camera denied */ }
  }, []);

  const toggleScreenShare = async () => {
    if (screenSharing) {
      await stopScreenShare();
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrack.onended = () => stopScreenShare();
        peersRef.current.forEach(p => {
          const sender = p.connection.getSenders().find(s => s.track?.kind === 'video');
          sender?.replaceTrack(screenTrack);
        });
        if (selfVideoRef.current) {
          selfVideoRef.current.srcObject = new MediaStream([screenTrack]);
          selfVideoRef.current.play().catch(() => {});
        }
        setScreenSharing(true);
      } catch { /* cancelled */ }
    }
  };

  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !micOn; });
    setMicOn(m => !m);
  };

  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !camOn; });
    setCamOn(c => !c);
  };

  const togglePanel = (panel: Panel) => setActivePanel(p => p === panel ? 'none' : panel);

  // ── Video grid layout: 1 peer = spotlight, 2+ = grid ───────────────────────
  const totalParticipants = 1 + peers.length; // self + remote
  const gridClass =
    peers.length === 0 ? '' :
    peers.length === 1 ? 'grid-cols-1' :
    peers.length <= 3 ? 'grid-cols-2' :
    'grid-cols-2';

  return (
    <div className="fixed inset-0 bg-[#1C1C1E] z-[300] flex flex-col select-none">

      {/* ── Connecting overlay — shown on top while joining, video still mounts underneath ── */}
      {connecting && (
        <div className="absolute inset-0 bg-[#1C1C1E] z-50 flex flex-col items-center justify-center gap-4">
          <RiverLoading size="md" />
          <div className="text-center">
            <p className="text-white text-lg font-semibold">{familyName}</p>
            <p className="text-white/40 text-sm mt-1">Joining call...</p>
          </div>
          <button type="button" title="Cancel" onClick={handleEnd}
            className="mt-6 w-14 h-14 rounded-full bg-red-500 flex items-center justify-center active:scale-95">
            <PhoneOff size={22} className="text-white" />
          </button>
        </div>
      )}

      {/* ── Zoom-style top bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-11 pb-2 bg-[#1C1C1E]/90 backdrop-blur-sm">
        {/* Left: name + count */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <div>
            <p className="text-white text-sm font-semibold leading-tight">{familyName}</p>
            <div className="flex items-center gap-1">
              <Users size={10} className="text-white/40" />
              <span className="text-white/40 text-[11px]">{totalParticipants} • {formatDuration(duration)}</span>
            </div>
          </div>
        </div>

        {/* Center: clock */}
        <span className="text-white/60 text-xs font-mono">{clock}</span>

        {/* Right: next prayer */}
        {nextPrayer && (
          <div className="bg-white/8 rounded-lg px-2.5 py-1">
            <p className="text-white/50 text-[10px] leading-tight">Next</p>
            <p className="text-white text-[11px] font-bold leading-tight">{nextPrayer.name} {nextPrayer.time}</p>
          </div>
        )}
      </div>

      {/* ── Camera blocked banner ───────────────────────────────────────────── */}
      {camBlocked && (
        <div className="mx-3 mb-1 bg-[#3A3A3C] rounded-2xl px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <VideoOff size={14} className="text-red-400 flex-shrink-0" />
              <span className="text-white/80 text-xs font-semibold">Camera access blocked</span>
            </div>
            <button type="button"
              onClick={async () => {
                try {
                  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                  localStreamRef.current = stream;
                  setCamOn(true);
                  setCamBlocked(false);
                  setStreamReady(true);
                  attachStreamToVideo();
                } catch { /* still blocked */ }
              }}
              className="text-[#5a6b28] text-xs font-bold ml-2 flex-shrink-0 bg-[#5a6b28]/10 px-2 py-1 rounded-lg">
              Retry
            </button>
          </div>
          <p className="text-white/40 text-[10px] leading-relaxed">
            To fix: tap the camera icon in your browser address bar (or go to Site Settings) and set Camera to &quot;Allow&quot;, then tap Retry.
          </p>
        </div>
      )}

      {/* ── Prayer reminder toast ───────────────────────────────────────────── */}
      {reminderMsg && (
        <div className="mx-3 mb-1 bg-amber-500 rounded-xl px-3 py-2 flex items-center justify-between">
          <span className="text-white text-xs font-semibold">{reminderMsg}</span>
          <button type="button" title="Dismiss" onClick={() => setReminderMsg(null)} className="text-white/70 ml-2">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Video area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">

        {/* Self video — always in DOM regardless of peers, so srcObject can always be set */}
        <video
          ref={attachSelfStream}
          autoPlay muted playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: peers.length === 0 && camOn ? 'block' : 'none' }}
        />

        {/* No peers — waiting */}
        {peers.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            {!camOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#2C2C2E]">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-20 h-20 rounded-full bg-[#3C3C3E] flex items-center justify-center text-3xl font-bold text-white">
                    {displayName[0]?.toUpperCase()}
                  </div>
                  <p className="text-white text-sm font-medium">{displayName}</p>
                  {camBlocked && <p className="text-white/40 text-xs text-center px-4">Camera blocked — tap Retry above or allow in browser settings</p>}
                </div>
              </div>
            )}
            {/* Overlay: waiting */}
            <div className="absolute bottom-24 left-0 right-0 flex flex-col items-center gap-1 pointer-events-none">
              <div className="bg-black/50 backdrop-blur-sm rounded-2xl px-6 py-3 text-center">
                <p className="text-white/80 text-sm font-medium">Waiting for family members</p>
                <p className="text-white/40 text-xs mt-0.5">They&apos;ll appear when they join</p>
              </div>
            </div>
            {/* Self label */}
            <div className="absolute bottom-[100px] left-3 bg-black/60 px-2 py-0.5 rounded-md">
              <span className="text-white text-xs">{displayName.split(' ')[0]} (You)</span>
            </div>
          </div>
        )}

        {/* 1 peer — spotlight: remote full screen, self PiP */}
        {peers.length === 1 && (
          <div className="absolute inset-0">
            {/* Remote full screen */}
            <div className="absolute inset-0 bg-[#2C2C2E]">
              {peers[0].hasVideo ? (
                <video autoPlay playsInline className="w-full h-full object-cover"
                  ref={el => {
                    const peer = peersRef.current.get(peers[0].uid);
                    if (peer && el) { peer.videoRef = el; if (peer.remoteStream) el.srcObject = peer.remoteStream; }
                  }} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="w-24 h-24 rounded-full bg-[#3C3C3E] flex items-center justify-center text-4xl font-bold text-white">
                    {peers[0].name[0]?.toUpperCase()}
                  </div>
                  <p className="text-white text-base font-medium">{peers[0].name}</p>
                </div>
              )}
              {/* Name label */}
              <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-lg">
                <span className="text-white text-sm font-medium">{peers[0].name}</span>
              </div>
            </div>

            {/* Self PiP — bottom right */}
            <div className="absolute bottom-4 right-3 w-28 h-44 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-[#2C2C2E]">
              <video ref={attachSelfStream} autoPlay muted playsInline
                className="w-full h-full object-cover"
                style={{ display: camOn ? 'block' : 'none' }} />
              {!camOn && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">{displayName[0]?.toUpperCase()}</span>
                </div>
              )}
              <div className="absolute bottom-1.5 left-1.5 bg-black/60 px-1.5 py-0.5 rounded text-[10px] text-white">
                You
              </div>
            </div>
          </div>
        )}

        {/* 2+ peers — grid */}
        {peers.length >= 2 && (
          <div className={`absolute inset-0 grid ${gridClass} gap-1 p-1`}>
            {/* Self tile */}
            <div className="relative bg-[#2C2C2E] rounded-xl overflow-hidden">
              <video ref={attachSelfStream} autoPlay muted playsInline
                className="w-full h-full object-cover"
                style={{ display: camOn ? 'block' : 'none' }} />
              {!camOn && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-3xl font-bold">{displayName[0]?.toUpperCase()}</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded-md text-xs text-white">
                {displayName.split(' ')[0]} (You)
              </div>
              {!micOn && (
                <div className="absolute top-2 right-2 bg-red-500/80 rounded-full p-1">
                  <MicOff size={10} className="text-white" />
                </div>
              )}
            </div>

            {/* Remote tiles */}
            {peers.map(p => (
              <div key={p.uid} className="relative bg-[#2C2C2E] rounded-xl overflow-hidden">
                {p.hasVideo ? (
                  <video autoPlay playsInline className="w-full h-full object-cover"
                    ref={el => {
                      const peer = peersRef.current.get(p.uid);
                      if (peer && el) { peer.videoRef = el; if (peer.remoteStream) el.srcObject = peer.remoteStream; }
                    }} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white text-3xl font-bold">{p.name[0]?.toUpperCase()}</span>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded-md text-xs text-white">
                  {p.name.split(' ')[0]}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Floating emoji reactions */}
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
          {floatingEmojis.map(fe => (
            <div key={fe.id} className="absolute bottom-24 text-4xl emoji-float" style={{ left: `${fe.x}%` }}>
              {fe.emoji}
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom sheet panels (Quran / Prayers / Todos / Emoji) ────────────── */}
      {activePanel !== 'none' && (
        <div className="absolute inset-x-0 bottom-[80px] z-30">
          {/* Backdrop tap to close */}
          <div className="absolute inset-x-0 bottom-full h-screen bg-black/40" onClick={() => setActivePanel('none')} />

          {/* Sheet */}
          <div ref={swipePanel.sheetRef}
            onTouchStart={swipePanel.handleTouchStart}
            onTouchMove={swipePanel.handleTouchMove}
            onTouchEnd={swipePanel.handleTouchEnd}
            className="relative bg-[#1C1C1E] rounded-t-3xl border-t border-white/8 max-h-[70vh] flex flex-col overflow-hidden shadow-2xl">

            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 py-2 border-b border-white/8 flex-shrink-0">
              <p className="text-white text-sm font-bold">
                {activePanel === 'quran' && 'Quran'}
                {activePanel === 'prayers' && 'Prayer Times'}
                {activePanel === 'todos' && 'Discussion Points'}
                {activePanel === 'emoji' && 'React'}
              </p>
              <button type="button" title="Close" onClick={() => setActivePanel('none')}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                <X size={14} className="text-white" />
              </button>
            </div>

            {/* ── Quran sheet ── same search UX as Quran nav page ── */}
            {activePanel === 'quran' && (
              <div className="flex-1 overflow-y-auto">

                {/* Verse/surah list view */}
                {quran.verses.length > 0 && (
                  <div className="p-4 space-y-3">
                    <button type="button" onClick={() => quran.setVerses([])}
                      className="flex items-center gap-1.5 text-white/50 text-xs mb-1 active:text-white">
                      <ArrowLeft size={13} /> Back to search
                    </button>
                    {quran.verses.map(v => (
                      <div key={v.key} className="bg-white/5 rounded-2xl p-4 border border-white/8">
                        <span className="inline-block bg-[#5a6b28]/20 text-[#5a6b28] text-[10px] font-bold px-2 py-0.5 rounded-full mb-2">
                          {v.key}
                        </span>
                        <p className="arabic-text text-white text-[20px] leading-[2.2] text-right mb-2" dir="rtl">{v.arabic}</p>
                        {v.translation && (
                          <p className="text-white/50 text-xs italic leading-relaxed border-t border-white/8 pt-2">
                            &ldquo;{v.translation}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                    {quran.verseLoading && (
                      <div className="flex justify-center py-4">
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                )}

                {/* Search + picker view */}
                {quran.verses.length === 0 && (
                  <div className="p-4 space-y-3">
                    {/* Search bar */}
                    <form onSubmit={e => { e.preventDefault(); quran.search(quran.query); }} className="flex gap-2">
                      <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                        <input
                          type="text"
                          value={quran.query}
                          onChange={e => quran.setQuery(e.target.value)}
                          placeholder="Surah name, topic, Arabic..."
                          className="w-full bg-white/8 text-white placeholder-white/25 rounded-2xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#5a6b28]/50"
                        />
                      </div>
                      <button type="submit" disabled={quran.searching}
                        className="bg-[#5a6b28] text-white rounded-2xl px-4 text-sm font-bold disabled:opacity-40 min-w-[60px]">
                        {quran.searching ? '…' : 'Go'}
                      </button>
                    </form>

                    {/* Surah match → ayah picker */}
                    {quran.surahMatch && !quran.verseLoading && (
                      <div className="bg-[#5a6b28]/10 rounded-2xl p-4 space-y-3 border border-[#5a6b28]/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white text-sm font-bold">Surah {quran.surahMatch.num}</p>
                            <p className="text-white/40 text-xs">{quran.surahMatch.total} ayahs total</p>
                          </div>
                          <button type="button"
                            onClick={() => quran.loadSurahVerses(quran.surahMatch!.num, 1)}
                            className="bg-[#5a6b28] text-white text-xs font-bold px-4 py-2 rounded-xl">
                            Open All
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number" min={1} max={quran.surahMatch.total}
                            value={quran.ayahInput}
                            onChange={e => quran.setAyahInput(e.target.value)}
                            placeholder={`Ayah 1–${quran.surahMatch.total}`}
                            className="flex-1 bg-white/8 text-white placeholder-white/25 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#5a6b28]/50"
                          />
                          <button type="button"
                            onClick={() => quran.loadSurahVerses(quran.surahMatch!.num, parseInt(quran.ayahInput, 10) || 1)}
                            className="bg-white/15 text-white rounded-xl px-4 text-sm font-semibold">
                            From
                          </button>
                        </div>
                      </div>
                    )}

                    {quran.verseLoading && (
                      <div className="flex justify-center py-4">
                        <div className="w-5 h-5 border-2 border-white/20 border-t-[#5a6b28] rounded-full animate-spin" />
                      </div>
                    )}

                    {/* Topic results */}
                    {quran.results.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-white/30 text-xs">{quran.results.length} results</p>
                        {quran.results.map((r, i) => (
                          <button key={i} type="button"
                            onClick={() => {
                              const [ch, ay] = r.verse_key.split(':');
                              quran.loadSurahVerses(parseInt(ch, 10), parseInt(ay, 10));
                            }}
                            className="w-full text-left bg-white/5 rounded-2xl p-3 border border-white/8 active:bg-white/10">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[#5a6b28] text-xs font-bold">{r.verse_key}</span>
                              <ChevronRight size={12} className="text-white/30" />
                            </div>
                            <p className="arabic-text text-white/80 text-sm text-right leading-relaxed" dir="rtl" >{r.text}</p>
                            {r.translations[0] && (
                              <p className="text-white/40 text-[11px] mt-1.5 line-clamp-2">{r.translations[0].text}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {!quran.searching && !quran.verseLoading && quran.results.length === 0 && !quran.surahMatch && quran.query && (
                      <p className="text-white/30 text-xs text-center py-4">No results for &ldquo;{quran.query}&rdquo;</p>
                    )}
                    {!quran.query && (
                      <p className="text-white/20 text-xs text-center py-4">Search surah name (e.g. Al-Asr) or topic (e.g. patience)</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Prayer times sheet ── */}
            {activePanel === 'prayers' && (
              <div className="overflow-y-auto p-4 space-y-2">
                <p className="text-white/30 text-xs mb-2">Jakarta, Indonesia</p>
                {prayers.length === 0 && <p className="text-white/30 text-xs text-center py-4">Loading...</p>}
                {prayers.map(p => {
                  const isNext = nextPrayer?.name === p.name;
                  return (
                    <div key={p.name}
                      className={`flex items-center justify-between px-4 py-3 rounded-2xl ${isNext ? 'bg-[#5a6b28]/15 border border-[#5a6b28]/25' : 'bg-white/5'}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{p.name === 'Fajr' ? '🌅' : p.name === 'Dhuhr' ? '☀️' : p.name === 'Asr' ? '🌤️' : p.name === 'Maghrib' ? '🌆' : '🌙'}</span>
                        <div>
                          <p className={`text-sm font-semibold ${isNext ? 'text-white' : 'text-white/70'}`}>{p.name}</p>
                          {isNext && <p className="text-[#5a6b28] text-[10px] font-bold">NEXT</p>}
                        </div>
                      </div>
                      <span className={`font-mono text-sm font-bold ${isNext ? 'text-[#5a6b28]' : 'text-white/40'}`}>{p.time}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Todos sheet ── */}
            {activePanel === 'todos' && (
              <div className="flex-1 overflow-y-auto flex flex-col p-4 gap-3">
                <div className="flex gap-2 flex-shrink-0">
                  <input type="text" value={todoInput} onChange={e => setTodoInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTodo()}
                    placeholder="Add a discussion point..."
                    className="flex-1 bg-white/8 text-white placeholder-white/25 rounded-2xl px-3 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#5a6b28]/50" />
                  <button type="button" title="Add" onClick={addTodo}
                    className="bg-[#5a6b28] text-white rounded-2xl px-4 flex items-center justify-center">
                    <Plus size={18} />
                  </button>
                </div>
                {todos.length === 0 && <p className="text-white/25 text-xs text-center py-4">No items yet.</p>}
                <div className="space-y-2 pb-4">
                  {todos.map(t => (
                    <div key={t.id} className={`flex items-center gap-3 px-3 py-3 rounded-2xl ${t.done ? 'bg-white/3 opacity-50' : 'bg-white/8'}`}>
                      <button type="button" title={t.done ? 'Uncheck' : 'Check'} onClick={() => toggleTodo(t.id)} className="flex-shrink-0">
                        {t.done ? <CheckSquare size={18} className="text-[#5a6b28]" /> : <Square size={18} className="text-white/30" />}
                      </button>
                      <span className={`flex-1 text-sm ${t.done ? 'line-through text-white/30' : 'text-white'}`}>{t.text}</span>
                      <button type="button" title="Delete" onClick={() => deleteTodo(t.id)} className="flex-shrink-0 text-white/20">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Emoji sheet ── */}
            {activePanel === 'emoji' && (
              <div className="p-4">
                <div className="grid grid-cols-4 gap-3 pb-2">
                  {EMOJI_REACTIONS.map(e => (
                    <button type="button" key={e} title={e} onClick={() => sendEmoji(e)}
                      className="h-16 rounded-2xl bg-white/8 text-4xl active:scale-90 transition-transform flex items-center justify-center">
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Controls bar — End button dead-center ───────────────────────────── */}
      <div className="bg-[#1C1C1E] border-t border-white/5 z-10 pb-8 pt-3 px-3">
        {/* Two rows: secondary tools above, core controls below */}

        {/* Row 1 — secondary (Quran, Prayer, Agenda, React) */}
        <div className="flex items-center justify-around mb-3 px-2">
          <div className="flex flex-col items-center gap-1">
            <button type="button" title="Quran" onClick={() => togglePanel('quran')}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${activePanel === 'quran' ? 'bg-[#5a6b28]' : 'bg-[#2C2C2E]'}`}>
              <BookOpen size={18} className="text-white" />
            </button>
            <span className="text-[9px] text-white/30">Quran</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button type="button" title="Prayer times" onClick={() => togglePanel('prayers')}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${activePanel === 'prayers' ? 'bg-amber-500' : 'bg-[#2C2C2E]'}`}>
              <Bell size={18} className="text-white" />
            </button>
            <span className="text-[9px] text-white/30">Prayer</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button type="button" title="Discussion agenda" onClick={() => togglePanel('todos')}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center relative transition-colors ${activePanel === 'todos' ? 'bg-[#075E54]' : 'bg-[#2C2C2E]'}`}>
              <CheckSquare size={18} className="text-white" />
              {todos.filter(t => !t.done).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#5a6b28] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {todos.filter(t => !t.done).length}
                </span>
              )}
            </button>
            <span className="text-[9px] text-white/30">Agenda</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button type="button" title="React" onClick={() => togglePanel('emoji')}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${activePanel === 'emoji' ? 'bg-yellow-500' : 'bg-[#2C2C2E]'}`}>
              <Smile size={20} className="text-white" />
            </button>
            <span className="text-[9px] text-white/30">React</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button type="button" title={screenSharing ? 'Stop sharing' : 'Share screen'} onClick={toggleScreenShare}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${screenSharing ? 'bg-blue-500' : 'bg-[#2C2C2E]'}`}>
              {screenSharing ? <MonitorOff size={18} className="text-white" /> : <Monitor size={18} className="text-white" />}
            </button>
            <span className="text-[9px] text-white/30">{screenSharing ? 'Stop' : 'Share'}</span>
          </div>
        </div>

        {/* Row 2 — core: Mic · Cam · [END] · Cam · Mic layout → Mic left, End center, Cam right */}
        <div className="flex items-center justify-center gap-5">
          {/* Mic */}
          <div className="flex flex-col items-center gap-1">
            <button type="button" title={micOn ? 'Mute' : 'Unmute'} onClick={toggleMic}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${micOn ? 'bg-[#3A3A3C]' : 'bg-red-500'}`}>
              {micOn ? <Mic size={22} className="text-white" /> : <MicOff size={22} className="text-white" />}
            </button>
            <span className="text-[9px] text-white/30">{micOn ? 'Mute' : 'Unmute'}</span>
          </div>

          {/* End — DEAD CENTER, largest */}
          <div className="flex flex-col items-center gap-1">
            <button type="button" title="End call" onClick={handleEnd}
              className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-2xl active:scale-95 transition-transform border-4 border-red-400/30">
              <PhoneOff size={30} className="text-white" />
            </button>
            <span className="text-[9px] text-white/40 font-medium">End</span>
          </div>

          {/* Camera */}
          <div className="flex flex-col items-center gap-1">
            <button type="button" title={camOn ? 'Stop video' : 'Start video'} onClick={toggleCam}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${camOn ? 'bg-[#3A3A3C]' : 'bg-red-500'}`}>
              {camOn ? <Video size={22} className="text-white" /> : <VideoOff size={22} className="text-white" />}
            </button>
            <span className="text-[9px] text-white/30">{camOn ? 'Video' : 'No Video'}</span>
          </div>
        </div>
      </div>

    </div>
  );
}
