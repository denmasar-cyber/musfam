-- ================================================================
-- MUSFAM — COMPLETE DATABASE SETUP
-- Run this entire file in Supabase SQL Editor (one shot).
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS, CREATE POLICY IF NOT EXISTS,
-- ALTER ... IF EXISTS, etc. Idempotent where possible.
-- ================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- enables fast ILIKE / full-text search

-- ================================================================
-- 1. FAMILIES
-- ================================================================
CREATE TABLE IF NOT EXISTS families (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  invite_code  TEXT        UNIQUE NOT NULL,
  pin_hash     TEXT        NOT NULL,
  created_by   UUID        REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_families_invite ON families(invite_code);

ALTER TABLE families ENABLE ROW LEVEL SECURITY;

-- Drop and recreate families policies to ensure correct definitions
DROP POLICY IF EXISTS families_select ON families;
DROP POLICY IF EXISTS families_insert ON families;
DROP POLICY IF EXISTS families_update ON families;
CREATE POLICY families_select ON families FOR SELECT USING (true);
CREATE POLICY families_insert ON families FOR INSERT WITH CHECK (true);
CREATE POLICY families_update ON families FOR UPDATE
  USING (id IN (SELECT family_id FROM profiles WHERE id = auth.uid()));

-- Add icon column for editable family group icon
ALTER TABLE families ADD COLUMN IF NOT EXISTS icon TEXT;

-- ================================================================
-- 2. PROFILES
-- ================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id  UUID  REFERENCES families(id) NOT NULL,
  name       TEXT  NOT NULL,
  role       TEXT  NOT NULL CHECK (role IN ('parent', 'child')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_family ON profiles(family_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop old recursive policy if it exists, then recreate safely
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their family" ON profiles;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_select') THEN
    -- USING (true): no subquery into profiles → no recursion
    -- All authenticated users can read profiles (needed for family member lookup)
    CREATE POLICY profiles_select ON profiles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_insert') THEN
    CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_update') THEN
    CREATE POLICY profiles_update ON profiles FOR UPDATE USING (id = auth.uid());
  END IF;
END $$;

-- ================================================================
-- Helper: get current user's family_id (used in policies)
-- ================================================================
CREATE OR REPLACE FUNCTION get_my_family_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT family_id FROM profiles WHERE id = auth.uid()
$$;

-- ================================================================
-- 3. MISSIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS missions (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID  REFERENCES families(id) NOT NULL,
  title       TEXT  NOT NULL,
  description TEXT  DEFAULT '',
  category    TEXT  NOT NULL CHECK (category IN ('health','spiritual','chores','education')),
  icon        TEXT  DEFAULT 'activity',
  created_by  UUID  REFERENCES auth.users(id),
  assigned_to TEXT,
  is_default  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_missions_family ON missions(family_id);

ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='missions' AND policyname='missions_select') THEN
    CREATE POLICY missions_select ON missions FOR SELECT USING (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='missions' AND policyname='missions_insert') THEN
    CREATE POLICY missions_insert ON missions FOR INSERT WITH CHECK (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='missions' AND policyname='missions_update') THEN
    CREATE POLICY missions_update ON missions FOR UPDATE USING (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='missions' AND policyname='missions_delete') THEN
    CREATE POLICY missions_delete ON missions FOR DELETE USING (family_id = get_my_family_id());
  END IF;
END $$;

-- ================================================================
-- 4. MISSION COMPLETIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS mission_completions (
  id               UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id        UUID  REFERENCES families(id) NOT NULL,
  user_id          UUID  REFERENCES auth.users(id) NOT NULL,
  mission_id       UUID  REFERENCES missions(id),         -- nullable: daily missions have no FK
  daily_mission_id UUID,                                  -- FK added below after daily_missions table
  completed_at     TIMESTAMPTZ DEFAULT NOW(),
  reflection_text  TEXT,
  proof_url        TEXT,
  verse_id         INTEGER,
  points_earned    INTEGER DEFAULT 70
);
CREATE INDEX IF NOT EXISTS idx_completions_family ON mission_completions(family_id);
CREATE INDEX IF NOT EXISTS idx_completions_user   ON mission_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_completions_date   ON mission_completions(completed_at DESC);

ALTER TABLE mission_completions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mission_completions' AND policyname='completions_select') THEN
    CREATE POLICY completions_select ON mission_completions FOR SELECT USING (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mission_completions' AND policyname='completions_insert') THEN
    CREATE POLICY completions_insert ON mission_completions FOR INSERT WITH CHECK (family_id = get_my_family_id());
  END IF;
END $$;

-- ================================================================
-- 5. REFLECTIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS reflections (
  id               UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id        UUID  REFERENCES families(id) NOT NULL,
  user_id          UUID  REFERENCES auth.users(id) NOT NULL,
  mission_id       UUID  REFERENCES missions(id),
  completion_id    UUID  REFERENCES mission_completions(id),
  reflection_text  TEXT  NOT NULL,
  verse_key        TEXT,
  verse_text_arabic TEXT,
  verse_translation TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reflections_family ON reflections(family_id);
CREATE INDEX IF NOT EXISTS idx_reflections_user   ON reflections(user_id);

ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reflections' AND policyname='reflections_select') THEN
    CREATE POLICY reflections_select ON reflections FOR SELECT USING (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reflections' AND policyname='reflections_insert') THEN
    CREATE POLICY reflections_insert ON reflections FOR INSERT WITH CHECK (family_id = get_my_family_id());
  END IF;
END $$;

-- ================================================================
-- 6. POINTS
-- ================================================================
CREATE TABLE IF NOT EXISTS points (
  user_id      UUID REFERENCES auth.users(id) NOT NULL,
  family_id    UUID REFERENCES families(id) NOT NULL,
  total_points INTEGER DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, family_id)
);

ALTER TABLE points ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='points' AND policyname='points_select') THEN
    -- Allow reading ALL points rows (needed for leaderboard across families)
    CREATE POLICY points_select ON points FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='points' AND policyname='points_insert') THEN
    CREATE POLICY points_insert ON points FOR INSERT WITH CHECK (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='points' AND policyname='points_update') THEN
    CREATE POLICY points_update ON points FOR UPDATE USING (family_id = get_my_family_id() AND user_id = auth.uid());
  END IF;
END $$;

-- ================================================================
-- 7. STREAKS
-- ================================================================
CREATE TABLE IF NOT EXISTS streaks (
  user_id           UUID REFERENCES auth.users(id) NOT NULL,
  family_id         UUID REFERENCES families(id) NOT NULL,
  current_streak    INTEGER DEFAULT 0,
  longest_streak    INTEGER DEFAULT 0,
  last_active_date  DATE,
  PRIMARY KEY (user_id, family_id)
);

ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='streaks' AND policyname='streaks_select') THEN
    CREATE POLICY streaks_select ON streaks FOR SELECT USING (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='streaks' AND policyname='streaks_insert') THEN
    CREATE POLICY streaks_insert ON streaks FOR INSERT WITH CHECK (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='streaks' AND policyname='streaks_update') THEN
    CREATE POLICY streaks_update ON streaks FOR UPDATE USING (family_id = get_my_family_id() AND user_id = auth.uid());
  END IF;
END $$;

-- ================================================================
-- 8. REWARDS
-- ================================================================
CREATE TABLE IF NOT EXISTS rewards (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID  REFERENCES families(id) NOT NULL,
  name       TEXT  NOT NULL,
  cost       INTEGER NOT NULL,
  icon       TEXT  DEFAULT 'gift',
  claimed    BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMPTZ,
  claimed_by UUID  REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS idx_rewards_family ON rewards(family_id);

ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rewards' AND policyname='rewards_select') THEN
    CREATE POLICY rewards_select ON rewards FOR SELECT USING (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rewards' AND policyname='rewards_insert') THEN
    CREATE POLICY rewards_insert ON rewards FOR INSERT WITH CHECK (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rewards' AND policyname='rewards_update') THEN
    CREATE POLICY rewards_update ON rewards FOR UPDATE USING (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rewards' AND policyname='rewards_delete') THEN
    CREATE POLICY rewards_delete ON rewards FOR DELETE USING (family_id = get_my_family_id());
  END IF;
END $$;

-- ================================================================
-- 9. ACTIVITY LOG
-- ================================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     UUID  REFERENCES families(id) NOT NULL,
  user_id       UUID  REFERENCES auth.users(id) NOT NULL,
  description   TEXT  NOT NULL,
  points_change INTEGER DEFAULT 0,
  icon          TEXT  DEFAULT 'activity',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_family ON activity_log(family_id);
CREATE INDEX IF NOT EXISTS idx_activity_user   ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_date   ON activity_log(created_at DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activity_log' AND policyname='activity_select') THEN
    CREATE POLICY activity_select ON activity_log FOR SELECT USING (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activity_log' AND policyname='activity_insert') THEN
    CREATE POLICY activity_insert ON activity_log FOR INSERT WITH CHECK (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activity_log' AND policyname='activity_delete') THEN
    CREATE POLICY activity_delete ON activity_log FOR DELETE USING (family_id = get_my_family_id());
  END IF;
END $$;

-- ================================================================
-- 10. QURAN PROGRESS (family-scoped page counter)
-- ================================================================
CREATE TABLE IF NOT EXISTS quran_progress (
  family_id  UUID  PRIMARY KEY REFERENCES families(id),
  pages_read INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quran_progress ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quran_progress' AND policyname='qprogress_select') THEN
    CREATE POLICY qprogress_select ON quran_progress FOR SELECT USING (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quran_progress' AND policyname='qprogress_insert') THEN
    CREATE POLICY qprogress_insert ON quran_progress FOR INSERT WITH CHECK (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quran_progress' AND policyname='qprogress_update') THEN
    CREATE POLICY qprogress_update ON quran_progress FOR UPDATE USING (family_id = get_my_family_id());
  END IF;
END $$;

-- ================================================================
-- 11. HYDRATION
-- ================================================================
CREATE TABLE IF NOT EXISTS hydration (
  id        UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID  REFERENCES auth.users(id) NOT NULL,
  family_id UUID  REFERENCES families(id) NOT NULL,
  date      DATE  NOT NULL DEFAULT CURRENT_DATE,
  count     INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

ALTER TABLE hydration ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hydration' AND policyname='hydration_select') THEN
    CREATE POLICY hydration_select ON hydration FOR SELECT USING (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hydration' AND policyname='hydration_insert') THEN
    CREATE POLICY hydration_insert ON hydration FOR INSERT WITH CHECK (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hydration' AND policyname='hydration_update') THEN
    CREATE POLICY hydration_update ON hydration FOR UPDATE USING (family_id = get_my_family_id() AND user_id = auth.uid());
  END IF;
END $$;

-- ================================================================
-- 12. QURAN BOOKMARKS
-- ================================================================
CREATE TABLE IF NOT EXISTS quran_bookmarks (
  id             UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID  REFERENCES auth.users(id) NOT NULL,
  family_id      UUID  REFERENCES families(id) NOT NULL,
  verse_key      TEXT  NOT NULL,
  chapter_number INTEGER NOT NULL,
  verse_number   INTEGER NOT NULL,
  surah_name     TEXT,
  text_uthmani   TEXT,
  translation    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, verse_key)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user   ON quran_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_family ON quran_bookmarks(family_id);

ALTER TABLE quran_bookmarks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quran_bookmarks' AND policyname='bookmarks_select') THEN
    CREATE POLICY bookmarks_select ON quran_bookmarks FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quran_bookmarks' AND policyname='bookmarks_insert') THEN
    CREATE POLICY bookmarks_insert ON quran_bookmarks FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quran_bookmarks' AND policyname='bookmarks_delete') THEN
    CREATE POLICY bookmarks_delete ON quran_bookmarks FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- ================================================================
-- 13. QURAN NOTES
-- ================================================================
CREATE TABLE IF NOT EXISTS quran_notes (
  id             UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID  REFERENCES auth.users(id) NOT NULL,
  family_id      UUID  REFERENCES families(id) NOT NULL,
  verse_key      TEXT  NOT NULL,
  chapter_number INTEGER NOT NULL,
  verse_number   INTEGER NOT NULL,
  note_text      TEXT  NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notes_user   ON quran_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_family ON quran_notes(family_id);
CREATE INDEX IF NOT EXISTS idx_notes_verse  ON quran_notes(verse_key);

ALTER TABLE quran_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quran_notes' AND policyname='notes_select') THEN
    CREATE POLICY notes_select ON quran_notes FOR SELECT USING (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quran_notes' AND policyname='notes_insert') THEN
    CREATE POLICY notes_insert ON quran_notes FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quran_notes' AND policyname='notes_update') THEN
    CREATE POLICY notes_update ON quran_notes FOR UPDATE USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quran_notes' AND policyname='notes_delete') THEN
    CREATE POLICY notes_delete ON quran_notes FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- ================================================================
-- 14. QURAN READING LOG (streak tracking)
-- ================================================================
CREATE TABLE IF NOT EXISTS quran_reading_log (
  id             UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID  REFERENCES auth.users(id) NOT NULL,
  family_id      UUID  REFERENCES families(id) NOT NULL,
  verse_key      TEXT  NOT NULL,
  chapter_number INTEGER NOT NULL,
  verses_read    INTEGER DEFAULT 1,
  read_at        TIMESTAMPTZ DEFAULT NOW(),
  date           DATE  NOT NULL DEFAULT CURRENT_DATE
);
CREATE INDEX IF NOT EXISTS idx_reading_log_user ON quran_reading_log(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_log_date ON quran_reading_log(date);

ALTER TABLE quran_reading_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quran_reading_log' AND policyname='readlog_select') THEN
    CREATE POLICY readlog_select ON quran_reading_log FOR SELECT USING (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quran_reading_log' AND policyname='readlog_insert') THEN
    CREATE POLICY readlog_insert ON quran_reading_log FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ================================================================
-- 15. DAILY MISSIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS daily_missions (
  id                     UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id              UUID  NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  date                   DATE  NOT NULL,
  verse_key              TEXT  NOT NULL,
  generated_text         TEXT  NOT NULL,
  parent_override_text   TEXT,
  parent_override_prompt TEXT,
  is_parent_override     BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (family_id, date)
);
CREATE INDEX IF NOT EXISTS idx_daily_missions_family_date ON daily_missions(family_id, date);

ALTER TABLE daily_missions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_missions' AND policyname='dm_select') THEN
    CREATE POLICY dm_select ON daily_missions FOR SELECT USING (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_missions' AND policyname='dm_insert') THEN
    CREATE POLICY dm_insert ON daily_missions FOR INSERT WITH CHECK (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_missions' AND policyname='dm_update') THEN
    CREATE POLICY dm_update ON daily_missions FOR UPDATE USING (family_id = get_my_family_id());
  END IF;
END $$;

-- Now we can add the FK from mission_completions to daily_missions
ALTER TABLE mission_completions
  ADD COLUMN IF NOT EXISTS daily_mission_id UUID REFERENCES daily_missions(id);

-- ================================================================
-- 16. DAILY SCHEDULE
-- ================================================================
CREATE TABLE IF NOT EXISTS daily_schedule (
  id        UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID  NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id   UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date      DATE  NOT NULL,
  title     TEXT  NOT NULL,
  time      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schedule_family_date ON daily_schedule(family_id, date);

ALTER TABLE daily_schedule ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_schedule' AND policyname='sched_select') THEN
    CREATE POLICY sched_select ON daily_schedule FOR SELECT USING (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_schedule' AND policyname='sched_insert') THEN
    CREATE POLICY sched_insert ON daily_schedule FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_schedule' AND policyname='sched_delete') THEN
    CREATE POLICY sched_delete ON daily_schedule FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- ================================================================
-- 17. FAMILY CHAT MESSAGES
-- ================================================================
CREATE TABLE IF NOT EXISTS family_messages (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID  NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id     UUID  REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name TEXT  NOT NULL,
  sender_role TEXT  NOT NULL CHECK (sender_role IN ('parent','child')),
  content     TEXT  NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_family_messages_family ON family_messages(family_id, created_at DESC);

ALTER TABLE family_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='family_messages' AND policyname='fmsg_select') THEN
    CREATE POLICY fmsg_select ON family_messages FOR SELECT USING (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='family_messages' AND policyname='fmsg_insert') THEN
    CREATE POLICY fmsg_insert ON family_messages FOR INSERT
      WITH CHECK (user_id = auth.uid() AND family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='family_messages' AND policyname='fmsg_delete') THEN
    CREATE POLICY fmsg_delete ON family_messages FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- Safe Enable Realtime for all core tables
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'family_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE family_messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'points') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE points;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'mission_completions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mission_completions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'missions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE missions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'rewards') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rewards;
  END IF;
END $$;

-- ================================================================
-- 18. QUR'ANTHER (Khatam) SESSIONS
-- No UNIQUE(family_id, status) — that constraint was wrong and is removed here.
-- ================================================================
CREATE TABLE IF NOT EXISTS khatam_sessions (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    UUID  NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  status       TEXT  NOT NULL DEFAULT 'voting' CHECK (status IN ('voting','active','completed')),
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
-- Drop the bad unique constraint if it exists from an old migration
ALTER TABLE khatam_sessions
  DROP CONSTRAINT IF EXISTS khatam_sessions_family_id_status_key;

CREATE INDEX IF NOT EXISTS idx_khatam_sessions_family ON khatam_sessions(family_id, status);

ALTER TABLE khatam_sessions ENABLE ROW LEVEL SECURITY;

-- Fix ks_select: open read so vote counts are always visible
-- Fix ks_select: open read so vote counts are always visible
DROP POLICY IF EXISTS ks_select ON khatam_sessions;
CREATE POLICY ks_select ON khatam_sessions FOR SELECT USING (true);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='khatam_sessions' AND policyname='ks_insert') THEN
    CREATE POLICY ks_insert ON khatam_sessions FOR INSERT WITH CHECK (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='khatam_sessions' AND policyname='ks_update') THEN
    CREATE POLICY ks_update ON khatam_sessions FOR UPDATE USING (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='khatam_sessions' AND policyname='ks_delete') THEN
    CREATE POLICY ks_delete ON khatam_sessions FOR DELETE USING (family_id = get_my_family_id());
  END IF;
END $$;

-- ================================================================
-- 19. QUR'ANTHER ASSIGNMENTS
-- ================================================================
CREATE TABLE IF NOT EXISTS khatam_assignments (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID  NOT NULL REFERENCES khatam_sessions(id) ON DELETE CASCADE,
  family_id    UUID  NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id      UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  juz_number   INT   NOT NULL CHECK (juz_number BETWEEN 1 AND 30),
  completed    BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE (session_id, juz_number)
);
CREATE INDEX IF NOT EXISTS idx_khatam_assign_session ON khatam_assignments(session_id);
CREATE INDEX IF NOT EXISTS idx_khatam_assign_user    ON khatam_assignments(user_id);

ALTER TABLE khatam_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='khatam_assignments' AND policyname='ka_select') THEN
    CREATE POLICY ka_select ON khatam_assignments FOR SELECT USING (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='khatam_assignments' AND policyname='ka_insert') THEN
    CREATE POLICY ka_insert ON khatam_assignments FOR INSERT WITH CHECK (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='khatam_assignments' AND policyname='ka_update') THEN
    CREATE POLICY ka_update ON khatam_assignments FOR UPDATE USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='khatam_assignments' AND policyname='ka_delete') THEN
    CREATE POLICY ka_delete ON khatam_assignments FOR DELETE USING (family_id = get_my_family_id());
  END IF;
END $$;

-- ================================================================
-- 20. QUR'ANTHER VOTES
-- ================================================================
CREATE TABLE IF NOT EXISTS khatam_votes (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID  NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id    UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (family_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_khatam_votes_family ON khatam_votes(family_id);

ALTER TABLE khatam_votes ENABLE ROW LEVEL SECURITY;

-- Fix kv_select: open read so vote counts are always visible
DROP POLICY IF EXISTS kv_select ON khatam_votes;
CREATE POLICY kv_select ON khatam_votes FOR SELECT USING (true);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='khatam_votes' AND policyname='kv_insert') THEN
    CREATE POLICY kv_insert ON khatam_votes FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='khatam_votes' AND policyname='kv_delete') THEN
    CREATE POLICY kv_delete ON khatam_votes FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- ================================================================
-- 21. AURA BOARD VIEW  (leaderboard — reads points across families)
-- ================================================================
CREATE OR REPLACE VIEW aura_board AS
SELECT
  f.id   AS family_id,
  f.name AS family_name,
  COALESCE(SUM(p.total_points), 0)                            AS total_points,
  RANK() OVER (ORDER BY COALESCE(SUM(p.total_points),0) DESC) AS rank
FROM families f
LEFT JOIN points p ON p.family_id = f.id
GROUP BY f.id, f.name;

GRANT SELECT ON aura_board TO authenticated;

-- ================================================================
-- 22. PIN FUNCTIONS
-- ================================================================
CREATE OR REPLACE FUNCTION hash_pin(p_pin TEXT)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER AS $$
  SELECT crypt(p_pin, gen_salt('bf'))
$$;

CREATE OR REPLACE FUNCTION verify_family_pin(p_family_id UUID, p_pin TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT pin_hash = crypt(p_pin, pin_hash) FROM families WHERE id = p_family_id
$$;

CREATE OR REPLACE FUNCTION get_family_by_invite_code(p_code TEXT)
RETURNS SETOF families LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM families WHERE invite_code = p_code
$$;

-- ================================================================
-- 23. SUPABASE STORAGE — proof-images bucket
-- Create the bucket programmatically so the app can upload proof photos.
-- If this fails (bucket already exists), that's fine — ignore the error.
-- ================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('proof-images', 'proof-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: any authenticated user can upload to their own folder
-- (folder = user_id prefix), anyone can read (public bucket)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='proof_images_insert'
  ) THEN
    CREATE POLICY proof_images_insert ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'proof-images' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='proof_images_select'
  ) THEN
    CREATE POLICY proof_images_select ON storage.objects FOR SELECT
      USING (bucket_id = 'proof-images');
  END IF;
END $$;

-- ================================================================
-- 24. FULL-TEXT SEARCH — verse_cache table
-- This caches quran verse text+translation so search works WITHOUT
-- calling the external API (which requires OAuth and can fail).
-- The app's search route can query this table as a fallback.
-- Populate it by running: INSERT INTO verse_cache SELECT ... from your data.
-- For now we create the schema so the table is ready.
-- ================================================================
CREATE TABLE IF NOT EXISTS verse_cache (
  verse_key        TEXT PRIMARY KEY,   -- e.g. "2:255"
  chapter_number   INTEGER NOT NULL,
  verse_number     INTEGER NOT NULL,
  surah_name       TEXT,
  text_arabic      TEXT,
  text_uthmani     TEXT,
  translation_en   TEXT,
  search_vector    TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', COALESCE(translation_en,'') || ' ' || COALESCE(surah_name,''))
  ) STORED
);
CREATE INDEX IF NOT EXISTS idx_verse_cache_fts    ON verse_cache USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_verse_cache_arabic ON verse_cache USING GIN(text_arabic gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_verse_cache_trans  ON verse_cache USING GIN(translation_en gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_verse_cache_surah  ON verse_cache(chapter_number);

-- Allow all authenticated users to read verse_cache (no family scoping needed)
ALTER TABLE verse_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='verse_cache' AND policyname='vc_select') THEN
    CREATE POLICY vc_select ON verse_cache FOR SELECT USING (true);
  END IF;
  -- Only service role can write (populated by admin/migration, not by users)
END $$;

-- ================================================================
-- 25. MISC COLUMN PATCHES (safe to run again)
-- ================================================================

-- Make mission_id nullable (daily missions don't have a missions FK)
ALTER TABLE mission_completions ALTER COLUMN mission_id DROP NOT NULL;

-- Add proof_url if missing
ALTER TABLE mission_completions ADD COLUMN IF NOT EXISTS proof_url TEXT;

-- Per-child reward assignment
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

-- Mission AP points, special classification, child visibility
ALTER TABLE missions ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 10;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS is_special BOOLEAN DEFAULT FALSE;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS visible_to_child BOOLEAN DEFAULT TRUE;

-- Reward special classification and child visibility
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS is_special BOOLEAN DEFAULT FALSE;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS visible_to_child BOOLEAN DEFAULT TRUE;

-- Approval workflow columns
ALTER TABLE mission_completions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE mission_completions ADD COLUMN IF NOT EXISTS submitter_name TEXT;

-- Policy: parents can update status (approve/reject)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mission_completions' AND policyname='completions_update') THEN
    CREATE POLICY completions_update ON mission_completions FOR UPDATE USING (family_id = get_my_family_id());
  END IF;
END $$;

-- ================================================================
-- QURAN READING DETECTION
-- ================================================================

CREATE TABLE IF NOT EXISTS quran_reads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id    UUID REFERENCES families(id) ON DELETE CASCADE,
  reader_name  TEXT NOT NULL DEFAULT '',
  verse_key    TEXT NOT NULL,       -- e.g. '2:255'
  surah_name   TEXT NOT NULL DEFAULT '',
  read_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  read_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, verse_key, read_date)
);

CREATE INDEX IF NOT EXISTS idx_quran_reads_family ON quran_reads(family_id, read_at DESC);

ALTER TABLE quran_reads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quran_reads' AND policyname='qr_select') THEN
    CREATE POLICY qr_select ON quran_reads FOR SELECT USING (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quran_reads' AND policyname='qr_upsert') THEN
    CREATE POLICY qr_upsert ON quran_reads FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quran_reads' AND policyname='qr_update') THEN
    CREATE POLICY qr_update ON quran_reads FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

-- ================================================================
-- STORAGE BUCKETS
-- ================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('proof-images', 'proof-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-notes', 'voice-notes', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload voice notes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='objects' AND schemaname='storage' AND policyname='voice_notes_insert'
  ) THEN
    CREATE POLICY voice_notes_insert ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'voice-notes' AND auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='objects' AND schemaname='storage' AND policyname='voice_notes_select'
  ) THEN
    CREATE POLICY voice_notes_select ON storage.objects
      FOR SELECT USING (bucket_id = 'voice-notes');
  END IF;
END $$;

-- ================================================================
-- 26. PER-USER CHAT CLEAR TIMESTAMPS
-- Each user can "clear" their view of the family chat.
-- Messages older than cleared_at are hidden for that user only.
-- ================================================================
CREATE TABLE IF NOT EXISTS chat_clear_timestamps (
  user_id    UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id  UUID  NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  cleared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, family_id)
);

ALTER TABLE chat_clear_timestamps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_clear_timestamps' AND policyname='cct_select') THEN
    CREATE POLICY cct_select ON chat_clear_timestamps FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_clear_timestamps' AND policyname='cct_insert') THEN
    CREATE POLICY cct_insert ON chat_clear_timestamps FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_clear_timestamps' AND policyname='cct_update') THEN
    CREATE POLICY cct_update ON chat_clear_timestamps FOR UPDATE USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_clear_timestamps' AND policyname='cct_delete') THEN
    CREATE POLICY cct_delete ON chat_clear_timestamps FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- ================================================================
-- 27. ACCOUNT DELETION SUPPORT
-- ================================================================

-- Allow users to delete their own profile (needed for account deletion flow)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_delete') THEN
    CREATE POLICY profiles_delete ON profiles FOR DELETE USING (id = auth.uid());
  END IF;
END $$;

-- Allow users to delete their own mission completions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mission_completions' AND policyname='completions_delete') THEN
    CREATE POLICY completions_delete ON mission_completions FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- Allow users to delete their own reflections
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reflections' AND policyname='reflections_delete') THEN
    CREATE POLICY reflections_delete ON reflections FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- Allow users to delete their own points row
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='points' AND policyname='points_delete') THEN
    CREATE POLICY points_delete ON points FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- Allow users to delete their own streaks row
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='streaks' AND policyname='streaks_delete') THEN
    CREATE POLICY streaks_delete ON streaks FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- Allow users to delete their own quran reading log entries
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quran_reading_log' AND policyname='readlog_delete') THEN
    CREATE POLICY readlog_delete ON quran_reading_log FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- Chat: ensure each member can delete their own messages (may already exist)
DROP POLICY IF EXISTS fmsg_delete ON family_messages;
CREATE POLICY fmsg_delete ON family_messages FOR DELETE USING (user_id = auth.uid());

-- Parents can delete any message in their family (for "clear all chat")
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='family_messages' AND policyname='fmsg_delete_parent') THEN
    CREATE POLICY fmsg_delete_parent ON family_messages FOR DELETE
      USING (
        family_id = get_my_family_id()
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
      );
  END IF;
END $$;

-- ================================================================
-- 28. STORAGE: AVATARS BUCKET
-- ================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='objects' AND schemaname='storage' AND policyname='avatars_insert'
  ) THEN
    CREATE POLICY avatars_insert ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='objects' AND schemaname='storage' AND policyname='avatars_select'
  ) THEN
    CREATE POLICY avatars_select ON storage.objects
      FOR SELECT USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='objects' AND schemaname='storage' AND policyname='avatars_update'
  ) THEN
    CREATE POLICY avatars_update ON storage.objects
      FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ================================================================
-- 29. COMMUNITY POSTS (Islamic reflection sharing between families)
-- ================================================================
CREATE TABLE IF NOT EXISTS community_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID REFERENCES families(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  family_name TEXT NOT NULL,
  verse_key   TEXT,
  verse_arabic TEXT,
  verse_en    TEXT,
  body        TEXT NOT NULL,
  category    TEXT DEFAULT 'reflection' CHECK (category IN ('reflection','dua','reminder')),
  likes_count INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='community_posts' AND policyname='cp_select') THEN
    CREATE POLICY cp_select ON community_posts FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='community_posts' AND policyname='cp_insert') THEN
    CREATE POLICY cp_insert ON community_posts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='community_posts' AND policyname='cp_delete') THEN
    CREATE POLICY cp_delete ON community_posts FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- ================================================================
-- 30. COMMUNITY LIKES
-- ================================================================
CREATE TABLE IF NOT EXISTS community_likes (
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE community_likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='community_likes' AND policyname='cl_select') THEN
    CREATE POLICY cl_select ON community_likes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='community_likes' AND policyname='cl_insert') THEN
    CREATE POLICY cl_insert ON community_likes FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='community_likes' AND policyname='cl_delete') THEN
    CREATE POLICY cl_delete ON community_likes FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- ================================================================
-- 31. FAMILY CONNECTIONS (inter-family bonding)
-- ================================================================
CREATE TABLE IF NOT EXISTS family_connections (
  family_id    UUID REFERENCES families(id) ON DELETE CASCADE,
  connected_to UUID REFERENCES families(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (family_id, connected_to)
);

ALTER TABLE family_connections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='family_connections' AND policyname='fc_select') THEN
    CREATE POLICY fc_select ON family_connections FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='family_connections' AND policyname='fc_insert') THEN
    CREATE POLICY fc_insert ON family_connections FOR INSERT WITH CHECK (family_id = get_my_family_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='family_connections' AND policyname='fc_update') THEN
    CREATE POLICY fc_update ON family_connections FOR UPDATE USING (connected_to = get_my_family_id());
  END IF;
END $$;

-- ================================================================
-- Section 32: Community like helper functions
-- ================================================================
CREATE OR REPLACE FUNCTION increment_likes(post_id_arg UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE community_posts SET likes_count = likes_count + 1 WHERE id = post_id_arg;
$$;

CREATE OR REPLACE FUNCTION decrement_likes(post_id_arg UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE community_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = post_id_arg;
$$;

-- ================================================================
-- Section 33: AUTOMATIC POINT SYNCHRONIZATION (The "Coherent" System)
-- ================================================================
-- This trigger system ensures point coherence across all actions.
-- It automatically updates the points table whenever a mission is 
-- approved or a reward is claimed.

CREATE OR REPLACE FUNCTION update_user_points_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- MISSION APPROVAL LOGIC
  IF (TG_TABLE_NAME = 'mission_completions') THEN
    IF (TG_OP = 'INSERT' AND NEW.status = 'approved') OR 
       (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'approved') THEN
      
      INSERT INTO points (user_id, family_id, total_points, updated_at)
      VALUES (NEW.user_id, NEW.family_id, NEW.points_earned, NOW())
      ON CONFLICT (user_id, family_id) 
      DO UPDATE SET 
        total_points = points.total_points + EXCLUDED.total_points,
        updated_at = NOW();

      -- Auto-log activity
      INSERT INTO activity_log (family_id, user_id, description, points_change, icon)
      VALUES (NEW.family_id, NEW.user_id, 'Mission approved: +' || NEW.points_earned || ' AP', NEW.points_earned, 'stars');
    END IF;

  -- REWARD CLAIM LOGIC
  ELSIF (TG_TABLE_NAME = 'rewards') THEN
    IF (TG_OP = 'UPDATE' AND OLD.claimed = false AND NEW.claimed = true) THEN
      
      UPDATE points 
      SET total_points = total_points - NEW.cost, 
          updated_at = NOW()
      WHERE user_id = NEW.claimed_by AND family_id = NEW.family_id;

      -- Auto-log activity
      INSERT INTO activity_log (family_id, user_id, description, points_change, icon, created_at)
      VALUES (NEW.family_id, NEW.claimed_by, 'Reward claimed: -' || NEW.cost || ' AP', -NEW.cost, 'gift', NOW());
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mission trigger
DROP TRIGGER IF EXISTS tr_sync_points_on_completion ON mission_completions;
CREATE TRIGGER tr_sync_points_on_completion
AFTER INSERT OR UPDATE ON mission_completions
FOR EACH ROW EXECUTE FUNCTION update_user_points_sync();

-- Reward trigger
DROP TRIGGER IF EXISTS tr_sync_points_on_reward ON rewards;
CREATE TRIGGER tr_sync_points_on_reward
AFTER UPDATE ON rewards
FOR EACH ROW EXECUTE FUNCTION update_user_points_sync();

-- ================================================================
-- Section 34: RANKING & LEADERBOARD REFRESH
-- ================================================================

-- Create or replace the view for family points sum
CREATE OR REPLACE VIEW aura_board AS
SELECT
  f.id   AS family_id,
  f.name AS family_name,
  COALESCE(SUM(p.total_points), 0)                            AS total_points,
  RANK() OVER (ORDER BY COALESCE(SUM(p.total_points),0) DESC) AS rank
FROM families f
LEFT JOIN points p ON p.family_id = f.id
GROUP BY f.id, f.name;

GRANT SELECT ON aura_board TO authenticated;

-- ================================================================
-- Section 35: ADMINISTRATIVE & UTILITY FUNCTIONS
-- ================================================================

-- Function to clear ALL logs and history for a single user (A "Fresh Start")
-- Keeps the profile, family, and points but deletes ALL activity/history and messages.
-- Function to clear ALL logs and history for a single user (Auto-Comprehensive)
-- Dynamically finds all tables with 'user_id' and purges them for this user.
CREATE OR REPLACE FUNCTION clear_user_logs(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_table_name TEXT;
BEGIN
  -- 1. Automate the "Manual Trash" logic for completed/claimed items
  -- GUARDIAN POWER: If user is a parent, delete ALL general family missions that are "Done"
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND role = 'parent') THEN
    DELETE FROM missions WHERE family_id = (SELECT family_id FROM profiles WHERE id = p_user_id) AND category = 'general' AND id IN (SELECT mission_id FROM mission_completions WHERE status = 'approved');
    DELETE FROM rewards WHERE family_id = (SELECT family_id FROM profiles WHERE id = p_user_id) AND claimed = true;
  ELSE
    -- CHILD POWER: Delete personal/assigned missions that are "Done"
    DELETE FROM missions WHERE assigned_to = p_user_id AND id IN (SELECT mission_id FROM mission_completions WHERE user_id = p_user_id AND status = 'approved');
    DELETE FROM rewards WHERE claimed_by = p_user_id;
  END IF;

  -- 2. Dynamically delete from all tables that have user_id, assigned_to, or claimed_by
  FOR v_table_name IN 
    SELECT DISTINCT table_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND column_name IN ('user_id', 'assigned_to', 'claimed_by')
      AND table_name NOT IN ('profiles', 'points', 'streaks', 'missions', 'rewards') -- Handled above specifically
  LOOP
    -- Safely execute deletion for whichever columns exist in the table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = v_table_name AND column_name = 'user_id') THEN
      EXECUTE 'DELETE FROM ' || quote_ident(v_table_name) || ' WHERE user_id = $1' USING p_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = v_table_name AND column_name = 'assigned_to') THEN
      EXECUTE 'DELETE FROM ' || quote_ident(v_table_name) || ' WHERE assigned_to = $1' USING p_user_id;
    END IF;
    -- Note: claimed_by is mainly for rewards, but covered here for completeness
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = v_table_name AND column_name = 'claimed_by') THEN
       EXECUTE 'UPDATE ' || quote_ident(v_table_name) || ' SET claimed = false, claimed_at = NULL, claimed_by = NULL WHERE claimed_by = $1' USING p_user_id;
    END IF;
  END LOOP;

  -- 2. Special Case: Reseting Reward status (un-claim)
  UPDATE rewards SET claimed = false, claimed_at = NULL, claimed_by = NULL WHERE claimed_by = p_user_id;

  -- 3. Reset Points & Streaks (Instead of deleting the row)
  UPDATE points SET total_points = 0, updated_at = NOW() WHERE user_id = p_user_id;
  UPDATE streaks SET current_streak = 0, longest_streak = 0, last_active_date = NULL WHERE user_id = p_user_id;

  -- 4. Reset Hydration count specifically
  UPDATE hydration SET count = 0 WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to PERMANENTLY DELETE an account and ALL its data (Auto-Comprehensive)
CREATE OR REPLACE FUNCTION delete_user_account_complete(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_table_name TEXT;
BEGIN
  -- 1. Dynamically delete from all tables (all logs, assignments, claims)
  FOR v_table_name IN 
    SELECT DISTINCT table_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND column_name IN ('user_id', 'assigned_to', 'claimed_by')
      AND table_name NOT IN ('profiles', 'points', 'streaks')
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = v_table_name AND column_name = 'user_id') THEN
      EXECUTE 'DELETE FROM ' || quote_ident(v_table_name) || ' WHERE user_id = $1' USING p_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = v_table_name AND column_name = 'assigned_to') THEN
      EXECUTE 'DELETE FROM ' || quote_ident(v_table_name) || ' WHERE assigned_to = $1' USING p_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = v_table_name AND column_name = 'claimed_by') THEN
      EXECUTE 'DELETE FROM ' || quote_ident(v_table_name) || ' WHERE claimed_by = $1' USING p_user_id;
    END IF;
  END LOOP;

  -- 2. Delete the base account records
  DELETE FROM points WHERE user_id = p_user_id;
  DELETE FROM streaks WHERE user_id = p_user_id;
  DELETE FROM profiles WHERE id = p_user_id;
  
  -- Note: auth.users is handled by Supabase Auth itself, 
  -- but this cleans up ALL public schema traces of that ID.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- DONE
-- ================================================================
-- Tables created / confirmed: families, profiles, missions,
-- mission_completions, reflections, points, streaks, rewards,
-- activity_log, quran_progress, hydration, quran_bookmarks,
-- quran_notes, quran_reading_log, daily_missions, daily_schedule,
-- family_messages, khatam_sessions, khatam_assignments,
-- khatam_votes, verse_cache, chat_clear_timestamps,
-- community_posts, community_likes, family_connections
-- Views: aura_board
-- Triggers: automatic points calculator (coherent system)
-- Storage buckets: proof-images, voice-notes, avatars
-- ================================================================
