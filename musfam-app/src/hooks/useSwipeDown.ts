'use client';

import { useRef, useCallback } from 'react';

/**
 * Attach swipe-down-to-close gesture to a bottom sheet.
 * Returns { sheetRef, handleTouchStart, handleTouchMove, handleTouchEnd }.
 * When the user swipes down ≥ threshold, onClose() is called.
 */
export function useSwipeDown(onClose: () => void, threshold = 80, canStartSwipe: () => boolean = () => true) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const currentY = useRef<number>(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!canStartSwipe()) {
      startY.current = null;
      currentY.current = 0;
      return;
    }
    startY.current = e.touches[0].clientY;
    currentY.current = 0;
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
    }
  }, [canStartSwipe]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta < 0) return; // don't allow upward pull
    currentY.current = delta;
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (sheetRef.current) {
      if (currentY.current >= threshold) {
        sheetRef.current.style.transition = 'transform 0.22s ease';
        sheetRef.current.style.transform = `translateY(100%)`;
        setTimeout(onClose, 220);
      } else {
        sheetRef.current.style.transition = 'transform 0.2s ease';
        sheetRef.current.style.transform = 'translateY(0)';
      }
    }
    startY.current = null;
    currentY.current = 0;
  }, [onClose, threshold]);

  return { sheetRef, handleTouchStart, handleTouchMove, handleTouchEnd };
}
