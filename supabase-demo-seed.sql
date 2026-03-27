-- ================================================================
-- MUSFAM DEMO ECOSYSTEM SEED
-- Creates 4 families for the Aura Board competition
-- Run this in Supabase SQL Editor (service role context)
--
-- Keluarga Samawa (real + demo members):
--   muhammaddenmasabdurrasyid@gmail.com → real account (must exist)
--   sribulan@samawa.demo  (parent, pass: demo1234)
--   dimas@samawa.demo     (child,  pass: demo1234)
--   nimas@samawa.demo     (child,  pass: demo1234)
--   keymas@samawa.demo    (child,  pass: demo1234)
--
-- Keluarga Barakah:  abdullah@barakah.demo / fatimah@barakah.demo / yusuf@barakah.demo / maryam@barakah.demo
-- Keluarga Shaleh:   ibrahim@shaleh.demo / khadijah@shaleh.demo / umar@shaleh.demo
-- Keluarga Nur:      ahmad@nur.demo / aisyah@nur.demo / bilal@nur.demo / zainab@nur.demo
-- All demo passwords: demo1234
-- ================================================================

DO $$
DECLARE
  -- Family IDs
  fam_samawa   UUID;
  fam_barakah  UUID;
  fam_shaleh   UUID;
  fam_nur      UUID;

  -- Keluarga Samawa — real account
  u_me      UUID;  -- muhammaddenmasabdurrasyid@gmail.com

  -- Keluarga Samawa — demo members
  u_bulan   UUID := gen_random_uuid();
  u_dimas   UUID := gen_random_uuid();
  u_nimas   UUID := gen_random_uuid();
  u_keymas  UUID := gen_random_uuid();

  -- Keluarga Barakah
  u_ab      UUID := gen_random_uuid();
  u_fat     UUID := gen_random_uuid();
  u_yus     UUID := gen_random_uuid();
  u_mar     UUID := gen_random_uuid();

  -- Keluarga Shaleh
  u_ibr     UUID := gen_random_uuid();
  u_khad    UUID := gen_random_uuid();
  u_umar    UUID := gen_random_uuid();

  -- Keluarga Nur
  u_ahm     UUID := gen_random_uuid();
  u_ais     UUID := gen_random_uuid();
  u_bil     UUID := gen_random_uuid();
  u_zai     UUID := gen_random_uuid();

BEGIN

-- ── Resolve real account ─────────────────────────────────────────
SELECT id INTO u_me FROM auth.users WHERE email = 'muhammaddenmasabdurrasyid@gmail.com';

IF u_me IS NULL THEN
  RAISE EXCEPTION 'Real account muhammaddenmasabdurrasyid@gmail.com not found. Sign up first.';
END IF;

-- ── Create demo auth.users (idempotent) ──────────────────────────
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role, instance_id)
SELECT u_bulan, 'sribulan@samawa.demo', crypt('demo1234', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'sribulan@samawa.demo');

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role, instance_id)
SELECT u_dimas, 'dimas@samawa.demo', crypt('demo1234', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'dimas@samawa.demo');

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role, instance_id)
SELECT u_nimas, 'nimas@samawa.demo', crypt('demo1234', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'nimas@samawa.demo');

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role, instance_id)
SELECT u_keymas, 'keymas@samawa.demo', crypt('demo1234', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'keymas@samawa.demo');

-- Keluarga Barakah
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role, instance_id)
SELECT u_ab, 'abdullah@barakah.demo', crypt('demo1234', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'abdullah@barakah.demo');

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role, instance_id)
SELECT u_fat, 'fatimah@barakah.demo', crypt('demo1234', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'fatimah@barakah.demo');

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role, instance_id)
SELECT u_yus, 'yusuf@barakah.demo', crypt('demo1234', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'yusuf@barakah.demo');

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role, instance_id)
SELECT u_mar, 'maryam@barakah.demo', crypt('demo1234', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'maryam@barakah.demo');

-- Keluarga Shaleh
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role, instance_id)
SELECT u_ibr, 'ibrahim@shaleh.demo', crypt('demo1234', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'ibrahim@shaleh.demo');

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role, instance_id)
SELECT u_khad, 'khadijah@shaleh.demo', crypt('demo1234', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'khadijah@shaleh.demo');

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role, instance_id)
SELECT u_umar, 'umar@shaleh.demo', crypt('demo1234', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'umar@shaleh.demo');

-- Keluarga Nur
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role, instance_id)
SELECT u_ahm, 'ahmad@nur.demo', crypt('demo1234', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'ahmad@nur.demo');

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role, instance_id)
SELECT u_ais, 'aisyah@nur.demo', crypt('demo1234', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'aisyah@nur.demo');

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role, instance_id)
SELECT u_bil, 'bilal@nur.demo', crypt('demo1234', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'bilal@nur.demo');

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role, instance_id)
SELECT u_zai, 'zainab@nur.demo', crypt('demo1234', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'zainab@nur.demo');

-- ── Resolve demo member UUIDs (in case already existed) ──────────
SELECT id INTO u_bulan  FROM auth.users WHERE email = 'sribulan@samawa.demo';
SELECT id INTO u_dimas  FROM auth.users WHERE email = 'dimas@samawa.demo';
SELECT id INTO u_nimas  FROM auth.users WHERE email = 'nimas@samawa.demo';
SELECT id INTO u_keymas FROM auth.users WHERE email = 'keymas@samawa.demo';
SELECT id INTO u_ab     FROM auth.users WHERE email = 'abdullah@barakah.demo';
SELECT id INTO u_fat    FROM auth.users WHERE email = 'fatimah@barakah.demo';
SELECT id INTO u_yus    FROM auth.users WHERE email = 'yusuf@barakah.demo';
SELECT id INTO u_mar    FROM auth.users WHERE email = 'maryam@barakah.demo';
SELECT id INTO u_ibr    FROM auth.users WHERE email = 'ibrahim@shaleh.demo';
SELECT id INTO u_khad   FROM auth.users WHERE email = 'khadijah@shaleh.demo';
SELECT id INTO u_umar   FROM auth.users WHERE email = 'umar@shaleh.demo';
SELECT id INTO u_ahm    FROM auth.users WHERE email = 'ahmad@nur.demo';
SELECT id INTO u_ais    FROM auth.users WHERE email = 'aisyah@nur.demo';
SELECT id INTO u_bil    FROM auth.users WHERE email = 'bilal@nur.demo';
SELECT id INTO u_zai    FROM auth.users WHERE email = 'zainab@nur.demo';

-- ── Resolve/create family IDs ────────────────────────────────────
SELECT id INTO fam_samawa  FROM families WHERE invite_code = 'SAMAWA';
SELECT id INTO fam_barakah FROM families WHERE invite_code = 'BRKAH';
SELECT id INTO fam_shaleh  FROM families WHERE invite_code = 'SHLEH';
SELECT id INTO fam_nur     FROM families WHERE invite_code = 'NURFA';
IF fam_samawa  IS NULL THEN fam_samawa  := gen_random_uuid(); END IF;
IF fam_barakah IS NULL THEN fam_barakah := gen_random_uuid(); END IF;
IF fam_shaleh  IS NULL THEN fam_shaleh  := gen_random_uuid(); END IF;
IF fam_nur     IS NULL THEN fam_nur     := gen_random_uuid(); END IF;

-- ── Families ─────────────────────────────────────────────────────
INSERT INTO families (id, name, invite_code, pin_hash, created_by, created_at, icon)
VALUES
  (fam_samawa,  'Keluarga Samawa',  'SAMAWA', crypt('1234', gen_salt('bf')), u_me,  now(), '🕌'),
  (fam_barakah, 'Keluarga Barakah', 'BRKAH',  crypt('1234', gen_salt('bf')), u_ab,  now(), '🌙'),
  (fam_shaleh,  'Keluarga Shaleh',  'SHLEH',  crypt('1234', gen_salt('bf')), u_ibr, now(), '⭐'),
  (fam_nur,     'Keluarga Nur',     'NURFA',  crypt('1234', gen_salt('bf')), u_ahm, now(), '🌟')
ON CONFLICT (invite_code) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon;

-- ── Profiles ─────────────────────────────────────────────────────
-- Keluarga Samawa: real user (parent) + 4 demo members
-- NOTE: real user's name/role will only be set if they don't have a profile yet
INSERT INTO profiles (id, family_id, name, role, created_at)
VALUES
  (u_me,     fam_samawa, 'Muhammad Denmas', 'parent', now()),
  (u_bulan,  fam_samawa, 'Sri Bulan',       'parent', now()),
  (u_dimas,  fam_samawa, 'Dimas',           'child',  now()),
  (u_nimas,  fam_samawa, 'Nimas',           'child',  now()),
  (u_keymas, fam_samawa, 'Keymas',          'child',  now())
ON CONFLICT (id) DO UPDATE SET family_id = EXCLUDED.family_id, role = EXCLUDED.role;
-- Note: name is NOT updated for the real account (u_me) to preserve what they set themselves

-- Keluarga Barakah
INSERT INTO profiles (id, family_id, name, role, created_at)
VALUES
  (u_ab,  fam_barakah, 'Abdullah', 'parent', now()),
  (u_fat, fam_barakah, 'Fatimah',  'parent', now()),
  (u_yus, fam_barakah, 'Yusuf',    'child',  now()),
  (u_mar, fam_barakah, 'Maryam',   'child',  now())
ON CONFLICT (id) DO UPDATE SET family_id = EXCLUDED.family_id, name = EXCLUDED.name, role = EXCLUDED.role;

-- Keluarga Shaleh
INSERT INTO profiles (id, family_id, name, role, created_at)
VALUES
  (u_ibr,  fam_shaleh, 'Ibrahim',  'parent', now()),
  (u_khad, fam_shaleh, 'Khadijah', 'parent', now()),
  (u_umar, fam_shaleh, 'Umar',     'child',  now())
ON CONFLICT (id) DO UPDATE SET family_id = EXCLUDED.family_id, name = EXCLUDED.name, role = EXCLUDED.role;

-- Keluarga Nur
INSERT INTO profiles (id, family_id, name, role, created_at)
VALUES
  (u_ahm, fam_nur, 'Ahmad',  'parent', now()),
  (u_ais, fam_nur, 'Aisyah', 'parent', now()),
  (u_bil, fam_nur, 'Bilal',  'child',  now()),
  (u_zai, fam_nur, 'Zainab', 'child',  now())
ON CONFLICT (id) DO UPDATE SET family_id = EXCLUDED.family_id, name = EXCLUDED.name, role = EXCLUDED.role;

-- ── Points ───────────────────────────────────────────────────────
-- Samawa #1: 2450 total (me:650, bulan:580, dimas:520, nimas:400, keymas:300)
-- Barakah #2: 1980 total
-- Shaleh  #3: 1450 total
-- Nur     #4:  980 total
INSERT INTO points (user_id, family_id, total_points, updated_at)
VALUES
  (u_me,     fam_samawa,  650, now()),
  (u_bulan,  fam_samawa,  580, now()),
  (u_dimas,  fam_samawa,  520, now()),
  (u_nimas,  fam_samawa,  400, now()),
  (u_keymas, fam_samawa,  300, now()),
  (u_ab,  fam_barakah, 580, now()),
  (u_fat, fam_barakah, 520, now()),
  (u_yus, fam_barakah, 480, now()),
  (u_mar, fam_barakah, 400, now()),
  (u_ibr,  fam_shaleh, 600, now()),
  (u_khad, fam_shaleh, 500, now()),
  (u_umar, fam_shaleh, 350, now()),
  (u_ahm, fam_nur, 300, now()),
  (u_ais, fam_nur, 280, now()),
  (u_bil, fam_nur, 240, now()),
  (u_zai, fam_nur, 160, now())
ON CONFLICT (user_id, family_id) DO UPDATE SET total_points = EXCLUDED.total_points;

-- ── Streaks ──────────────────────────────────────────────────────
INSERT INTO streaks (user_id, family_id, current_streak, longest_streak, last_active_date)
VALUES
  (u_me,     fam_samawa, 10, 21, now()::date),
  (u_bulan,  fam_samawa, 12, 18, now()::date),
  (u_dimas,  fam_samawa,  7, 12, now()::date),
  (u_nimas,  fam_samawa,  5,  8, now()::date),
  (u_keymas, fam_samawa,  3,  6, now()::date),
  (u_ab,  fam_barakah,  9, 14, now()::date),
  (u_fat, fam_barakah,  8, 12, now()::date),
  (u_yus, fam_barakah,  6,  9, now()::date),
  (u_mar, fam_barakah,  4,  7, now()::date),
  (u_ibr,  fam_shaleh,  7, 10, now()::date),
  (u_khad, fam_shaleh,  6,  9, now()::date),
  (u_umar, fam_shaleh,  3,  5, now()::date),
  (u_ahm, fam_nur, 4, 6, now()::date),
  (u_ais, fam_nur, 3, 5, now()::date),
  (u_bil, fam_nur, 2, 4, now()::date),
  (u_zai, fam_nur, 1, 3, now()::date)
ON CONFLICT (user_id, family_id) DO UPDATE
  SET current_streak   = EXCLUDED.current_streak,
      longest_streak   = EXCLUDED.longest_streak,
      last_active_date = EXCLUDED.last_active_date;

-- ── Quran progress ────────────────────────────────────────────────
INSERT INTO quran_progress (family_id, pages_read)
VALUES
  (fam_samawa,  180),
  (fam_barakah, 120),
  (fam_shaleh,   80),
  (fam_nur,      40)
ON CONFLICT (family_id) DO UPDATE SET pages_read = EXCLUDED.pages_read;

-- ── Missions (Samawa only — real family) ─────────────────────────
INSERT INTO missions (family_id, title, description, category, icon, created_by, is_default, points, is_special, visible_to_child)
SELECT fam_samawa, title, description, category, icon, u_me, true, points, is_special, true FROM (VALUES
  ('Tilawah Pagi',    'Baca 1 halaman Al-Quran setelah Subuh',               'spiritual',  'book-open',       120, false),
  ('Hafalan Keluarga','Hafalkan 1 ayat bersama setelah Maghrib',              'spiritual',  'sparkles',        150, true),
  ('Tadabbur Ayat',   'Baca tafsir 1 ayat favorit lalu ceritakan maknanya',  'spiritual',  'message-square',  140, true),
  ('Sholat Berjamaah','Sholat Maghrib atau Isya bersama di rumah',            'spiritual',  'users',           110, false),
  ('Sedekah Harian',  'Lakukan 1 kebaikan kecil hari ini',                    'spiritual',  'heart',           100, false),
  ('Dzikir Pagi',     'Baca dzikir pagi minimal 5 menit setelah Subuh',       'spiritual',  'sun',              90, false),
  ('Muhasabah Malam', 'Tulis 1 hal yang kamu syukuri hari ini sebelum tidur', 'education',  'sticky-note',      80, false)
) AS v(title, description, category, icon, points, is_special)
WHERE NOT EXISTS (SELECT 1 FROM missions WHERE family_id = fam_samawa AND title = v.title);

INSERT INTO missions (family_id, title, description, category, icon, created_by, is_default, points, is_special, visible_to_child)
SELECT fam_barakah, title, description, category, icon, u_ab, true, points, is_special, true FROM (VALUES
  ('Tilawah Pagi',    'Baca 1 halaman Al-Quran setelah Subuh',   'spiritual', 'book-open', 120, false),
  ('Hafalan Keluarga','Hafalkan 1 ayat bersama setelah Maghrib', 'spiritual', 'sparkles',  150, true),
  ('Sholat Berjamaah','Sholat Maghrib atau Isya bersama',        'spiritual', 'users',     110, false),
  ('Dzikir Pagi',     'Baca dzikir pagi minimal 5 menit',        'spiritual', 'sun',        90, false)
) AS v(title, description, category, icon, points, is_special)
WHERE NOT EXISTS (SELECT 1 FROM missions WHERE family_id = fam_barakah AND title = v.title);

INSERT INTO missions (family_id, title, description, category, icon, created_by, is_default, points, is_special, visible_to_child)
SELECT fam_shaleh, title, description, category, icon, u_ibr, true, points, is_special, true FROM (VALUES
  ('Tilawah Pagi',    'Baca 1 halaman Al-Quran setelah Subuh', 'spiritual', 'book-open', 120, false),
  ('Sholat Berjamaah','Sholat Maghrib bersama di rumah',       'spiritual', 'users',     110, false),
  ('Dzikir Pagi',     'Baca dzikir pagi minimal 5 menit',      'spiritual', 'sun',        90, false)
) AS v(title, description, category, icon, points, is_special)
WHERE NOT EXISTS (SELECT 1 FROM missions WHERE family_id = fam_shaleh AND title = v.title);

INSERT INTO missions (family_id, title, description, category, icon, created_by, is_default, points, is_special, visible_to_child)
SELECT fam_nur, title, description, category, icon, u_ahm, true, points, is_special, true FROM (VALUES
  ('Tilawah Pagi',    'Baca 1 halaman Al-Quran setelah Subuh',  'spiritual', 'book-open', 120, false),
  ('Sholat Berjamaah','Sholat bersama minimal sekali hari ini', 'spiritual', 'users',     110, false)
) AS v(title, description, category, icon, points, is_special)
WHERE NOT EXISTS (SELECT 1 FROM missions WHERE family_id = fam_nur AND title = v.title);

-- ── Rewards (Samawa) ──────────────────────────────────────────────
INSERT INTO rewards (family_id, name, cost, icon, claimed, is_special, visible_to_child)
SELECT fam_samawa, name, cost, icon, false, is_special, true FROM (VALUES
  ('Pizza Night!',      1500, 'pizza',     true),
  ('Ice Cream Pack',     500, 'ice-cream', false),
  ('Movie Night',       2000, 'film',      true),
  ('Extra Screen Time',  300, 'monitor',   false)
) AS v(name, cost, icon, is_special)
WHERE NOT EXISTS (SELECT 1 FROM rewards WHERE family_id = fam_samawa AND name = v.name);

END $$;

-- ================================================================
-- EXPECTED AURA BOARD AFTER RUNNING:
--   #1 Keluarga Samawa   — 2450 pts
--   #2 Keluarga Barakah  — 1980 pts
--   #3 Keluarga Shaleh   — 1450 pts
--   #4 Keluarga Nur      —  980 pts
--
-- Keluarga Samawa members:
--   muhammaddenmasabdurrasyid@gmail.com (parent, real account)
--   sribulan@samawa.demo  → Sri Bulan  (parent)
--   dimas@samawa.demo     → Dimas      (child)
--   nimas@samawa.demo     → Nimas      (child)
--   keymas@samawa.demo    → Keymas     (child)
-- ================================================================
