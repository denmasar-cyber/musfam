/**
 * Securely sync with Quran Foundation User API via our internal server proxy.
 * This avoids CORS issues and protects OAuth credentials.
 */

export async function syncBookmarkToFoundation(verseKey: string, isAdding: boolean) {
  try {
    void fetch(`/api/quran/sync`, {
      method: 'POST',
      body: JSON.stringify({ action: 'bookmark', verse_key: verseKey, isAdding }),
    });
  } catch (error) {
    console.error('Bookmark Sync Proxy Error:', error);
  }
}

export async function syncReadingToFoundation(verseKey: string) {
  try {
    void fetch(`/api/quran/sync`, {
      method: 'POST',
      body: JSON.stringify({ action: 'reading', verse_key: verseKey }),
    });
  } catch (error) {
    console.error('Reading Sync Proxy Error:', error);
  }
}

export async function syncStreakToFoundation(streakCount: number) {
  try {
    void fetch(`/api/quran/sync`, {
      method: 'POST',
      body: JSON.stringify({ action: 'streak', streak: streakCount }),
    });
  } catch (error) {
    console.error('Streak Sync Proxy Error:', error);
  }
}

export async function syncNoteToFoundation(verseKey: string, isAdding: boolean, noteText?: string) {
  try {
    const [chap, vn] = verseKey.split(':').map(Number);
    void fetch(`/api/quran/sync`, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'note', 
        verse_key: verseKey, 
        isAdding, 
        note_text: noteText,
        chapter_number: chap,
        verse_number: vn
      }),
    });
  } catch (error) {
    console.error('Note Sync Proxy Error:', error);
  }
}

/** Mirror a Family Chat message as a 'Post' in the Quran Foundation ecosystem. */
export async function syncPostToFoundation(content: string, roomId?: string) {
  try {
    void fetch(`/api/quran/sync?action=post&content=${encodeURIComponent(content)}${roomId ? `&room_id=${roomId}` : ''}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'post' }),
    });
  } catch (error) {
    console.error('Post Sync Proxy Error:', error);
  }
}

/** Mirror a Musfam Mission or Khatam progress as a 'Goal' in the Quran Foundation ecosystem. */
export async function syncGoalToFoundation(title: string, target: number, type: 'reading' | 'streak' | 'other' = 'reading') {
  try {
    void fetch(`/api/quran/sync?action=goal&title=${encodeURIComponent(title)}&target=${target}&type=${type}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'goal' }),
    });
  } catch (error) {
    console.error('Goal Sync Proxy Error:', error);
  }
}

/** Mirror any Musfam point gain or notable achievement as a global 'Activity'. */
export async function syncActivityToFoundation(description: string, points: number) {
  try {
    void fetch(`/api/quran/sync?action=activity&description=${encodeURIComponent(description)}&points=${points}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'activity' }),
    });
  } catch (error) {
    console.error('Activity Sync Proxy Error:', error);
  }
}
/** Add a feedback comment to a Post in the Quran Foundation ecosystem. */
export async function syncCommentToFoundation(postId: string, content: string) {
  try {
    void fetch(`/api/quran/sync?action=comment&post_id=${postId}&content=${encodeURIComponent(content)}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'comment' }),
    });
  } catch (error) {
    console.error('Comment Sync Proxy Error:', error);
  }
}

/** Increment progress for a Goal in the Quran Foundation ecosystem. */
export async function syncGoalProgressToFoundation(goalId: string, increment: number) {
  try {
    void fetch(`/api/quran/sync?action=goal_progress&goal_id=${goalId}&increment=${increment}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'goal_progress' }),
    });
  } catch (error) {
    console.error('Goal Progress Sync Proxy Error:', error);
  }
}
