'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * usePullToRefresh hook.
 * Detects pull-down gesture on a scrollable container.
 * Returns { pulling, refreshing, pullDistance, containerRef, handleTouchStart, handleTouchMove, handleTouchEnd }.
 */
export function usePullToRefresh(onRefresh: () => Promise<void>, threshold = 80) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const isAtTop = useRef<boolean>(true);

  const handleTouchStart = useCallback((e: React.TouchEvent | TouchEvent) => {
    // Only start if we are at the top of the scroll
    const scrollElem = containerRef.current;
    if (scrollElem && scrollElem.scrollTop <= 0) {
      isAtTop.current = true;
      startY.current = 'touches' in e ? e.touches[0].clientY : (e as any).clientY;
    } else {
      isAtTop.current = false;
      startY.current = null;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent | TouchEvent) => {
    if (!isAtTop.current || startY.current === null || refreshing) return;

    const currentY = 'touches' in e ? e.touches[0].clientY : (e as any).clientY;
    const delta = currentY - startY.current;

    if (delta > 0) {
      // Pulling down
      setPulling(true);
      // Dampen the pull effect
      const dampedDistance = Math.pow(delta, 0.85);
      setPullDistance(Math.min(dampedDistance, threshold + 40));
      
      // Prevent scrolling while pulling
      if (delta > 10 && e.cancelable) e.preventDefault();
    } else {
      setPulling(false);
      setPullDistance(0);
    }
  }, [refreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling || refreshing) {
      setPulling(false);
      setPullDistance(0);
      startY.current = null;
      return;
    }

    if (pullDistance >= threshold) {
      setRefreshing(true);
      setPulling(false);
      setPullDistance(threshold); // Hold it at threshold during refresh
      
      try {
        await onRefresh();
      } catch (err) {
        console.error("Refresh failed:", err);
      } finally {
        // Aesthetic delay for the finish transition
        setTimeout(() => {
            setRefreshing(false);
            setPullDistance(0);
        }, 600);
      }
    } else {
      setPulling(false);
      setPullDistance(0);
    }
    
    startY.current = null;
  }, [pulling, refreshing, pullDistance, threshold, onRefresh]);

  return {
    pulling,
    refreshing,
    pullDistance,
    containerRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  };
}
