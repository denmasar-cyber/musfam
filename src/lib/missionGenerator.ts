interface MissionEntry {
  mission: string;
  reflectionPrompt: string;
}

const VERSE_THEME_MAP: Record<string, MissionEntry> = {
  // Verses used by getDailyVerseKey() - full coverage
  '1:1':    { mission: 'Recite Al-Fatihah slowly in every prayer today, pausing to understand each line before moving on', reflectionPrompt: 'Which line of Al-Fatihah resonated most deeply with you today and why?' },
  '2:45':   { mission: 'Pray Salah with full focus today, and after one prayer sit for 5 minutes of quiet dua', reflectionPrompt: 'What did you ask for in your dua and how did the stillness feel?' },
  '2:152':  { mission: 'Remember Allah with dhikr at least 3 times today: after Fajr, after Asr, and before sleep', reflectionPrompt: 'How did conscious remembrance of Allah affect your mood or focus throughout the day?' },
  '2:153':  { mission: 'Meet one challenge today with both prayer and patience: make wudu, pray 2 rakaat, then face what is difficult', reflectionPrompt: 'What was the challenge, and did turning to prayer first change how you handled it?' },
  '2:177':  { mission: 'Do one act of true righteousness today: give charity, visit someone in need, or speak a kind truth', reflectionPrompt: 'What did you do and what did this act reveal about what righteousness means to you?' },
  '2:255':  { mission: 'Put your trust in Allah: write down one worry you are carrying and consciously surrender it to Him today', reflectionPrompt: 'How did letting go of that worry affect your heart and your day?' },
  '2:261':  { mission: 'Give in the way of Allah today: charity, time, skill, or a sincere deed, knowing He multiplies it', reflectionPrompt: 'What did you give today and how did giving feel knowing Allah sees and multiplies every good act?' },
  '2:286':  { mission: 'Be gentle with yourself and others: forgive one thing that has been bothering you and let it go', reflectionPrompt: 'What did you choose to forgive, and how did it feel once you did?' },
  '3:139':  { mission: 'Face one challenge today without complaining: respond with patience and dignity instead of frustration', reflectionPrompt: 'What was the challenge, and how did choosing patience change your response?' },
  '3:173':  { mission: 'Face something difficult today trusting that Allah is enough: act with courage instead of fear', reflectionPrompt: 'What did you face today and how did relying on Allah change your approach?' },
  '3:200':  { mission: 'Be patient in one hard situation today: do not rush the outcome, trust the timing of Allah', reflectionPrompt: 'What required your patience today and what did choosing patience teach you?' },
  '4:103':  { mission: 'Pray all 5 daily salah on time today: set reminders now if you need to', reflectionPrompt: 'Were you able to pray all 5 on time? Which prayer felt most present and focused?' },
  '13:28':  { mission: 'Do 10 minutes of dhikr: Subhanallah, Alhamdulillah, Allahu Akbar, after Asr or Maghrib prayer today', reflectionPrompt: 'How did the dhikr feel? Did your heart find any calm or comfort during it?' },
  '17:80':  { mission: 'Before sleeping, make dua asking Allah to let you enter every situation with truth and leave it with truth', reflectionPrompt: 'How did asking for truthfulness change how you approached conversations or decisions today?' },
  '18:10':  { mission: 'Like the People of the Cave, make a firm intention for your deen: write down one commitment to Allah you will keep this week', reflectionPrompt: 'What commitment did you write and what will you do tomorrow to take the first step?' },
  '29:45':  { mission: 'Before your next salah, read the meaning of Surah Al-Ankabut verse 45 and reflect on how prayer protects you', reflectionPrompt: 'What does "prayer prevents immorality and wrongdoing" mean in your own daily life right now?' },
  '33:41':  { mission: 'Remember Allah abundantly today: say Subhanallah, Alhamdulillah, Allahu Akbar at least 100 times throughout the day', reflectionPrompt: 'How did constant remembrance of Allah change how your day felt or how you interacted with others?' },
  '39:53':  { mission: 'Make sincere tawbah today: reflect on one habit you want to change and ask Allah sincerely for forgiveness', reflectionPrompt: 'What habit did you reflect on, and what is one concrete step you will take to change it?' },
  '59:22':  { mission: "Spend 5 minutes contemplating one Name of Allah: Al-Quddus (The Pure) or Al-Mu'min (The Faithful)", reflectionPrompt: 'What did reflecting on this Name of Allah stir in your heart or change in how you see your day?' },
  '65:3':   { mission: 'Take one action that requires trust in Allah: step forward despite uncertainty, and leave the result to Him', reflectionPrompt: 'What did you do and how did trusting Allah shift your sense of control?' },
  '73:20':  { mission: 'Recite a portion of Quran today: even a few verses, with focus, not rushing, understanding each word', reflectionPrompt: 'What verse stayed with you after your recitation and what did it mean to you today?' },
  '76:9':   { mission: 'Feed someone or offer something without expecting any reward or even thanks: do it purely for Allah', reflectionPrompt: 'Who did you give to and how did giving with no expectation of return feel inside?' },
  '94:5':   { mission: 'Identify one hardship you are going through and reframe it: list 3 ways it might be a mercy or lesson from Allah', reflectionPrompt: 'What did you find when you looked for ease inside the difficulty?' },
  '94:6':   { mission: 'After every difficulty comes ease: share an encouraging word with someone who seems to be struggling today', reflectionPrompt: 'Who did you encourage, what did you say, and how did they respond?' },

  // ── Tawakkul (Sunday pool) ─────────────────────────────────────────────────
  '4:81':   { mission: 'Choose one worry today and consciously hand it to Allah: write it down, say "HasbunAllah wa ni\'mal wakil", then let it go', reflectionPrompt: 'How did surrendering that worry to Allah change how you felt for the rest of the day?' },
  '8:2':    { mission: 'Strengthen your iman today: when you hear the name of Allah, pause and feel it in your heart — do this in every prayer', reflectionPrompt: 'Did you notice a shift in how your heart responded to Allah\'s name? Describe it.' },
  '58:22':  { mission: 'Examine your closest connections today: are you spending time with people who bring you closer to Allah?', reflectionPrompt: 'What did you notice about the relationships that most influence your faith?' },
  '67:1':   { mission: 'Spend 5 minutes looking at the sky, water, or any creation and simply say Subhanallah — recognise His sovereignty', reflectionPrompt: 'What did you see and what thought came to your heart about the One who created it?' },

  // ── Shukr (Monday pool) ────────────────────────────────────────────────────
  '27:19':  { mission: 'Begin every task today with Bismillah and end it with Alhamdulillah: make it a conscious habit all day', reflectionPrompt: 'How did this simple practice change your awareness of who gives you the ability to act?' },
  '17:3':   { mission: 'Thank three specific people today who you rarely acknowledge: tell them exactly what they did that mattered', reflectionPrompt: 'Who did you thank, what did you say, and how did it feel to say it out loud?' },

  // ── Salah (Tuesday pool) ───────────────────────────────────────────────────
  '17:78':  { mission: 'Pray Fajr and Maghrib at their exact times today and spend 2 minutes after each in complete silence before moving', reflectionPrompt: 'What did the silence after salah feel like? Did anything surface in your heart?' },
  '62:9':   { mission: 'On this blessed day (Jumu\'ah), make sure to send salawat on the Prophet ﷺ at least 100 times', reflectionPrompt: 'How did sending salawat shift your mood or your sense of connection to the Prophet ﷺ?' },

  // ── Usrah / Family (Wednesday pool) ───────────────────────────────────────
  '49:10':  { mission: 'Reconcile with someone you have had a disagreement with, or reach out warmly to a family member you haven\'t spoken to recently', reflectionPrompt: 'What step did you take? How did reconnecting feel, and what would you do differently next time?' },
  '4:36':   { mission: 'Say something genuinely kind to every person in your household today: a compliment, a thank-you, or a warm word', reflectionPrompt: 'What did you say to each person and how did they respond?' },
  '9:128':  { mission: 'Show extra mercy to the most difficult person in your life today: be patient, gentle, and forgiving with them', reflectionPrompt: 'Who did you choose and what happened when you led with mercy instead of frustration?' },

  // ── Sabr (Thursday pool) ───────────────────────────────────────────────────
  '39:10':  { mission: 'Do one hard thing today without complaining or quitting: finish it patiently and offer it as worship to Allah', reflectionPrompt: 'What was the hard thing? What kept you going when you wanted to stop?' },
  '16:127': { mission: 'The next time something frustrates you today, pause before reacting: take a breath and choose patience deliberately', reflectionPrompt: 'What frustrated you, and what happened when you chose patience over reaction?' },
  '70:5':   { mission: 'Practice "sabr jamil" — beautiful patience: endure one discomfort today without telling anyone or complaining', reflectionPrompt: 'What did you endure silently? How did bearing it privately make you feel?' },

  // ── Sadaqah (Friday pool) ──────────────────────────────────────────────────
  '57:7':   { mission: 'Give from what you love today: donate money, time, or something you value — not just what you can spare easily', reflectionPrompt: 'What did you give that cost you something, and how did giving it feel?' },
  '76:8':   { mission: 'Feed someone or offer something without expecting any reward or even thanks: do it purely for Allah\'s sake', reflectionPrompt: 'Who did you give to, what did you give, and how did giving with no expectation feel inside?' },
  '64:16':  { mission: 'Give in the way of Allah whatever you are able today — even a smile, a prayer for someone, or sharing knowledge', reflectionPrompt: 'What did you give? How does this verse — "give as much as you are able" — change how you think about charity?' },
  '3:92':   { mission: 'Give away something you genuinely love or use today: donate it to someone who needs it more', reflectionPrompt: 'What did you give? Did letting go of it feel hard, and what does that reveal about your attachment?' },

  // ── Tadabbur / Reflection (Saturday pool) ─────────────────────────────────
  '4:82':   { mission: 'Read 10 verses of the Quran slowly today: after each one, pause and ask "what is Allah saying to me right now?"', reflectionPrompt: 'Which verse stopped you the most? What did it say to your heart specifically today?' },
  '38:29':  { mission: 'Choose one verse you\'ve always heard but never deeply thought about: read its tafsir and sit with its meaning', reflectionPrompt: 'What did you discover in the verse that you had been missing? How does it change something in how you live?' },
  '73:4':   { mission: 'Recite Quran slowly today — tartil. Even one page. Let each word land before moving to the next', reflectionPrompt: 'Which word or phrase felt different when you slowed down and gave it full attention?' },
  '17:9':   { mission: 'Read the first 10 verses of a surah you rarely visit and reflect on what guidance it offers for your life right now', reflectionPrompt: 'Which verse felt most directly relevant to something you are going through? Why?' },
  '59:21':  { mission: 'Imagine the Quran landing on a mountain — then consider: it is landing on your heart. Sit with that weight for 5 minutes', reflectionPrompt: 'What did it feel like to hold the full weight of the Quran\'s words? What changed in how you want to approach it?' },
  '47:24':  { mission: 'Take the verse you read in today\'s Quran session and find one way to apply it before the day ends', reflectionPrompt: 'What was the verse, what did you do, and did acting on it change how you understood the verse?' },

  // ── Additional verse mappings ──────────────────────────────────────────────
  '3:103':  { mission: 'Strengthen a family bond: have a real, unhurried conversation with one family member today', reflectionPrompt: 'What did you learn or appreciate about the person you spoke with?' },
  '4:36':   { mission: 'Say something genuinely kind to 3 different people today: compliment, encourage, or express gratitude', reflectionPrompt: 'What did you say to each person, and how did they respond?' },
  '9:128':  { mission: 'Show mercy to someone who is struggling: be extra gentle, patient, or forgiving with them today', reflectionPrompt: 'Who did you show mercy to and what changed between you?' },
  '14:7':   { mission: 'Write down or say aloud 5 specific things you are grateful to Allah for today: go beyond the obvious', reflectionPrompt: 'Which of the 5 blessings surprised you most when you stopped to think about it?' },
  '16:90':  { mission: 'Stand up for what is right: if you see an unfair situation today, respond with justice rather than silence', reflectionPrompt: 'What did you observe, and how did you respond or try to respond?' },
  '17:23':  { mission: 'Honor your parents: do something kind for them today without being asked, and without mentioning it', reflectionPrompt: 'What did you do and what was their reaction? How did it make you feel?' },
  '17:24':  { mission: 'Make sincere dua for your parents after every salah today: ask Allah for their health, forgiveness, and happiness', reflectionPrompt: 'What did you ask Allah for on their behalf? Did making dua for them change how you feel about them?' },
  '20:14':  { mission: 'Pray all 5 daily salah on time today: set reminders now before you read further', reflectionPrompt: 'Were you able to pray all 5 on time? Which prayer felt most connected, and why?' },
  '23:1':   { mission: 'Pray at least one salah with full khushu: put your phone away, recite slowly, and reflect on each word', reflectionPrompt: 'Which verse or moment during that prayer stood out to you most?' },
  '24:30':  { mission: 'Guard your gaze and your speech today: no backbiting, gossip, or harmful content for 24 hours', reflectionPrompt: 'What temptations came up and how did you handle them?' },
  '25:63':  { mission: 'If someone is rude or provocative today, respond calmly with peace instead of reacting in kind', reflectionPrompt: 'Did a moment arise? How did choosing a peaceful response feel compared to reacting?' },
  '27:19':  { mission: 'Begin every task today with Bismillah and end it with Alhamdulillah: make it a conscious habit all day', reflectionPrompt: 'How did this simple practice change your awareness or approach to the tasks you did?' },
  '31:14':  { mission: 'Call or visit a grandparent, aunt, uncle, or extended family member you have not spoken to recently', reflectionPrompt: 'How did that connection feel? What did you talk about and what will you take away from it?' },
  '33:70':  { mission: 'Speak only truth today: correct yourself if you exaggerate, mislead, or say something you are not certain of', reflectionPrompt: 'Was there a moment where you caught yourself? What did you do and how did honesty feel?' },
  '49:10':  { mission: 'Reconcile with someone you have had a disagreement with, or reach out to a friend you have lost touch with', reflectionPrompt: 'What step did you take toward reconciliation or reconnection? How did it go?' },
  '49:13':  { mission: 'Learn something meaningful today about a background, culture, or perspective different from your own', reflectionPrompt: 'What did you learn and how did it shift or deepen your understanding?' },
  '55:13':  { mission: 'Count 10 blessings from Allah today: push yourself past the obvious ones to find hidden gifts', reflectionPrompt: 'Which blessing had you been overlooking or taking for granted?' },
  '93:11':  { mission: 'Give something today: money, time, food, a kind deed, or a listening ear, to someone in need', reflectionPrompt: 'Who did you give to, what did you give, and how did the act of giving feel?' },
};

export function generateDailyMission(verseKey: string): { missionText: string; reflectionPrompt: string } {
  const entry = VERSE_THEME_MAP[verseKey];
  if (entry) return { missionText: entry.mission, reflectionPrompt: entry.reflectionPrompt };
  return {
    missionText: "Reflect on today's Ayah and perform one good deed inspired by its meaning",
    reflectionPrompt: 'What did the Ayah teach you, and what action did you take because of it?',
  };
}
