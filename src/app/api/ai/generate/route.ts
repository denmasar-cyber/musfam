import { NextResponse } from 'next/server';

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36",
];

export async function POST(req: Request) {
  try {
    const { messages, model = 'gpt-4o-mini' } = await req.json();
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const entropy = Math.random().toString(36).substring(7);

    // 1. Handshake to get VQD
    const handshake = await fetch(`https://duckduckgo.com/duckchat/v1/status?q=${entropy}`, {
      headers: { 
        "x-vqd-4": "1",
        "User-Agent": userAgent
      }
    });
    const vqd = handshake.headers.get("x-vqd-4");

    if (!vqd) {
      return NextResponse.json({ response: null, error: "Cloud token failure" });
    }

    // 2. Chat with DuckDuckGo (Resilient Strategy)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const chatRes = await fetch("https://duckduckgo.com/duckchat/v1/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-vqd-4": vqd,
          "User-Agent": userAgent,
          "Accept": "*/*",
        },
        body: JSON.stringify({
          model,
          messages: messages.map((m: any) => ({
            role: m.role,
            content: m.content
          }))
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!chatRes.ok) {
        throw new Error(`DDG Gateway Error: ${chatRes.status}`);
      }

      const rawText = await chatRes.text();
      const lines = rawText.split('\n');
      let fullResponse = "";
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        
        const payload = trimmed.substring(6).trim();
        if (payload === '[DONE]') break;
        
        try {
          const json = JSON.parse(payload);
          if (json.message) fullResponse += json.message;
        } catch (e) {
          // Skip partial crumbs
        }
      }

      if (!fullResponse) throw new Error("Empty buffer from AI");

      return NextResponse.json({ response: fullResponse });
    } catch (err: any) {
      console.error("AI Journey interrupted:", err.message);
      // Return 200 with null response so frontend triggers Jenset (Fallback)
      return NextResponse.json({ response: null, error: "Cloud logic interrupted" });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error: any) {
    return NextResponse.json({ response: null, error: error.message });
  }
}
