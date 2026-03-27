'use client';

import RiverLoading from './RiverLoading';

const WALISONGO_QUOTES = [
  { quote: "Urip iku urup — Life is a flame; make it shine for others.", author: "Sunan Kalijaga" },
  { quote: "Aja rumangsa bisa, nanging bisaa rumangsa — Don't feel capable; be capable of feeling.", author: "Sunan Kalijaga" },
  { quote: "Eling lan waspada — Be mindful and ever watchful of the heart.", author: "Sunan Bonang" },
  { quote: "Manungsa iku papan tumibane wahyu — A person is where divine guidance descends.", author: "Sunan Ampel" },
  { quote: "Jer basuki mawa beya — Every goodness requires sacrifice and effort.", author: "Sunan Giri" },
  { quote: "Sapa nandur bakal ngunduh — Whoever plants shall harvest; your deeds return to you.", author: "Sunan Drajat" },
  { quote: "Wenehana mangan marang wong kang luwe — Feed those who hunger; generosity opens the heart.", author: "Sunan Drajat" },
  { quote: "Ngluruk tanpa bala, menang tanpa ngasorake — Advance without troops; win without humiliating.", author: "Sunan Kalijaga" },
  { quote: "Sepi ing pamrih, rame ing gawe — Seek no praise; be full in your deeds.", author: "Sunan Kalijaga" },
  { quote: "Sangkan paraning dumadi — Know where you came from and where you are going.", author: "Sunan Bonang" },
  { quote: "Memayu hayuning bawana — Beautify and preserve the world for all beings.", author: "Sunan Kalijaga" },
  { quote: "Ilmu tanpa amal kaya wit tanpa woh — Knowledge without action is a tree without fruit.", author: "Sunan Ampel" },
];

export function getWalisongoQuote() {
  return WALISONGO_QUOTES[Math.floor(Date.now() / 8000) % WALISONGO_QUOTES.length];
}

interface LoadingBlockProps {
  fullScreen?: boolean;
}

export default function LoadingBlock({ fullScreen = false }: LoadingBlockProps) {
  const wq = getWalisongoQuote();

  if (fullScreen) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-full max-w-[280px] mx-auto">
          <RiverLoading size="md" />
        </div>
        <div className="text-center max-w-xs">
          <p className="text-xs italic text-gray-500 leading-relaxed">&ldquo;{wq.quote}&rdquo;</p>
          <p className="text-[10px] font-bold text-forest/50 mt-1 uppercase tracking-wider">— {wq.author}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 w-full">
      <div className="w-full max-w-[280px] mx-auto">
        <RiverLoading size="md" />
      </div>
      <div className="text-center px-6 max-w-xs">
        <p className="text-xs italic text-gray-500 leading-relaxed">&ldquo;{wq.quote}&rdquo;</p>
        <p className="text-[10px] font-bold text-forest/50 mt-1 uppercase tracking-wider">— {wq.author}</p>
      </div>
    </div>
  );
}
