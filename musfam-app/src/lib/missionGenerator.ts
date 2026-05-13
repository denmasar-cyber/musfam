interface MissionEntry {
  missionText: string;
  reflectionPrompt: string;
}

// 🛡️ MUSFAM SEMANTIC KNOWLEDGE BASE (MASTERCLASS EDITION)
// A Pure Local, Deterministic, Context-Aware Engine
const THEME_POOLS: Record<string, MissionEntry[]> = {
  'spiritual': [
    { missionText: "Deep Study: Read the Tafsir of today's verse and share one profound lesson with others.", reflectionPrompt: 'What lesson did you share and how did the Tafsir deepen your understanding?' },
    { missionText: "Dhikr Connection: Recite SubhanAllah, Alhamdulillah, and Allahu Akbar 33 times after Fajr prayer.", reflectionPrompt: 'How did conscious remembrance of Allah affect your peace of mind?' },
    { missionText: "Ayat Reflection: Write down one way today's verse directly applies to your current life challenges.", reflectionPrompt: 'What was the specific connection you found?' }
  ],
  'patience': [
    { missionText: "Sabr Jamil: Meet one frustration today with complete silence and inner patience, offering it to Allah.", reflectionPrompt: 'What was the frustration and how did silence feel?' },
    { missionText: "Steadfastness: Identify one difficult habit you are trying to change and resist it once today with prayer.", reflectionPrompt: 'What was the moment of resistance?' }
  ],
  'gratitude': [
    { missionText: "Shukr Walk: Spend 10 minutes walking and mentally listing 20 things you are grateful to Allah for.", reflectionPrompt: 'Which blessing felt most significant today?' },
    { missionText: "Gratitude Ripple: Thank a family member for something they do regularly but is often overlooked.", reflectionPrompt: 'Who did you thank and what was their reaction?' }
  ],
  'family': [
    { missionText: "Family Halaqah: Gather for 10 minutes to discuss the theme of today's verse together.", reflectionPrompt: 'What was the most interesting insight shared by a family member?' },
    { missionText: "Gentle Speech: Speak only with kindness and lower your voice in every interaction with family today.", reflectionPrompt: 'Did you notice a change in the family atmosphere?' },
    { missionText: "Parents Honor: Perform one act of service for your parents (or elders) without being asked.", reflectionPrompt: 'What did you do and how did it make you feel?' }
  ],
  'health': [
    { missionText: "Sunnah Fasting: If able, perform a voluntary fast today to purify both body and soul.", reflectionPrompt: 'How did the fast heighten your spiritual focus?' },
    { missionText: "Body Trust: Avoid any unhealthy food or drink today as an act of stewardship over your body.", reflectionPrompt: 'What was the hardest thing to avoid and why?' }
  ],
  'action': [
    { missionText: "Righteous Act: Find one small injustice or mess today and fix it, purely for the sake of Allah.", reflectionPrompt: 'What did you fix and what was your intention?' },
    { missionText: "Sadaqah Secret: Give a small amount of charity privately, ensuring no one but Allah knows.", reflectionPrompt: 'How did the secrecy of the act feel?' }
  ]
};

const KEYWORD_WEIGHTS: Record<string, { theme: string; weight: number }> = {
  // Spiritual
  'salah': { theme: 'spiritual', weight: 3 }, 'prayer': { theme: 'spiritual', weight: 3 },
  'dhikr': { theme: 'spiritual', weight: 3 }, 'quran': { theme: 'spiritual', weight: 2 },
  'faith': { theme: 'spiritual', weight: 2 }, 'allah': { theme: 'spiritual', weight: 1 },
  // Patience
  'sabr': { theme: 'patience', weight: 5 }, 'patience': { theme: 'patience', weight: 5 },
  'endure': { theme: 'patience', weight: 3 }, 'steadfast': { theme: 'patience', weight: 3 },
  // Gratitude
  'shukr': { theme: 'gratitude', weight: 5 }, 'thanks': { theme: 'gratitude', weight: 5 },
  'gratitude': { theme: 'gratitude', weight: 4 }, 'blessings': { theme: 'gratitude', weight: 3 },
  // Family
  'family': { theme: 'family', weight: 5 }, 'parent': { theme: 'family', weight: 4 },
  'mother': { theme: 'family', weight: 4 }, 'father': { theme: 'family', weight: 4 },
  'brother': { theme: 'family', weight: 3 }, 'sister': { theme: 'family', weight: 3 },
  'kin': { theme: 'family', weight: 3 },
  // Health
  'food': { theme: 'health', weight: 4 }, 'eat': { theme: 'health', weight: 4 },
  'drink': { theme: 'health', weight: 4 }, 'body': { theme: 'health', weight: 3 },
  'fast': { theme: 'health', weight: 3 },
  // Action/Justice
  'justice': { theme: 'action', weight: 5 }, 'truth': { theme: 'action', weight: 4 },
  'deed': { theme: 'action', weight: 3 }, 'give': { theme: 'action', weight: 3 },
  'sadaqah': { theme: 'action', weight: 4 }, 'charity': { theme: 'action', weight: 4 }
};

export async function generateDailyMissionSemantic(date: Date, verseText?: string, verseKey?: string, familyName?: string): Promise<{ missionText: string; reflectionPrompt: string; verseKey: string }> {
  const vK = verseKey || "";
  const text = (verseText || '').toLowerCase();
  
  // Logic 1: Exact Match Protection
  if (vK === '17:81') {
    return { 
      missionText: "Stand Firm in Truth: Truly truth has come, and falsehood has perished. Conduct one act of absolute justice or honesty today.", 
      reflectionPrompt: 'What act of truth did you perform?', 
      verseKey: vK 
    };
  }

  // Logic 2: Semantic Theme Scoring
  const scores: Record<string, number> = { 'spiritual': 1, 'patience': 0, 'gratitude': 0, 'family': 0, 'health': 0, 'action': 0 };
  
  for (const [word, config] of Object.entries(KEYWORD_WEIGHTS)) {
    if (text.includes(word)) {
      scores[config.theme] += config.weight;
    }
  }

  // Find the winning theme
  let winner = 'spiritual';
  let maxScore = 0;
  for (const [theme, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      winner = theme;
    }
  }

  // Logic 3: Deterministic Mission Selection
  const pool = THEME_POOLS[winner] || THEME_POOLS['spiritual'];
  const day = date.getDate();
  const index = day % pool.length;
  const entry = pool[index];

  return {
    missionText: entry.missionText,
    reflectionPrompt: entry.reflectionPrompt,
    verseKey: vK
  };
}
