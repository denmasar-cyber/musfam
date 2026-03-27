'use client';

import { useState, useEffect } from 'react';

export type Lang = 'en' | 'id';

const STRINGS = {
  en: {
    // Onboarding
    createFamily: 'Create Family',
    joinFamily: 'Join Family',
    familyName: 'Family name',
    yourName: 'Your name',
    role: 'Role',
    parent: 'Parent',
    child: 'Child',
    pin: 'PIN (4 digits)',
    pinError: 'PIN must be 4 digits',
    inviteCode: 'Invite code',
    inviteCodePlaceholder: 'Enter invite code',
    createBtn: 'Create',
    joinBtn: 'Join',
    failedCreate: 'Failed to create family',
    failedJoin: 'Invalid invite code',
    // Login
    email: 'Email',
    password: 'Password',
    loginBtn: 'Log In',
    loginFailed: 'Login failed',
    wrongCredentials: 'Incorrect email or password',
    // Me page
    myProfile: 'My Profile',
    language: 'Language',
    langEn: 'English',
    langId: 'Indonesian',
    logout: 'Log Out',
    editAvatar: 'Change Avatar',
    // General
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
  },
  id: {
    // Onboarding
    createFamily: 'Buat Keluarga',
    joinFamily: 'Gabung Keluarga',
    familyName: 'Nama keluarga',
    yourName: 'Nama kamu',
    role: 'Peran',
    parent: 'Orang Tua',
    child: 'Anak',
    pin: 'PIN (4 digit)',
    pinError: 'PIN harus 4 digit',
    inviteCode: 'Kode undangan',
    inviteCodePlaceholder: 'Masukkan kode undangan',
    createBtn: 'Buat',
    joinBtn: 'Gabung',
    failedCreate: 'Gagal membuat keluarga',
    failedJoin: 'Kode undangan tidak valid',
    // Login
    email: 'Email',
    password: 'Kata sandi',
    loginBtn: 'Masuk',
    loginFailed: 'Login gagal',
    wrongCredentials: 'Email atau password salah',
    // Me page
    myProfile: 'Profil Saya',
    language: 'Bahasa',
    langEn: 'Inggris',
    langId: 'Indonesia',
    logout: 'Keluar',
    editAvatar: 'Ganti Avatar',
    // General
    loading: 'Memuat...',
    save: 'Simpan',
    cancel: 'Batal',
  },
} as const;

export type StringKey = keyof typeof STRINGS.en;

export function useLanguage() {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const stored = localStorage.getItem('musfam_lang') as Lang | null;
    if (stored === 'en' || stored === 'id') setLangState(stored);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem('musfam_lang', l);
  }

  function t(key: StringKey): string {
    return STRINGS[lang][key] ?? STRINGS.en[key];
  }

  return { lang, setLang, t };
}
