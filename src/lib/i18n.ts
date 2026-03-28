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
    parent: 'Guardian',
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
    langId: 'English (UK)',
    logout: 'Log Out',
    editAvatar: 'Change Avatar',
    // General
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
  },
  id: {
    // Mirroring English for consistency
    createFamily: 'Create Family',
    joinFamily: 'Join Family',
    familyName: 'Family name',
    yourName: 'Your name',
    role: 'Role',
    parent: 'Guardian',
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
    langId: 'English (UK)',
    logout: 'Log Out',
    editAvatar: 'Change Avatar',
    // General
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
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
