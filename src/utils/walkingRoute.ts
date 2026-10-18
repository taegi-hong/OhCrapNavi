import { useState, useEffect, useRef } from 'react';
import { RestroomCandidate, UserCoordinates, WalkRouteInfo } from '../types';

// In-memory frontend cache for instantaneous switching between candidates
const routeCache = new Map<string, WalkRouteInfo>();

/**
 * Fetch real walkable pedestrian route from /api/route/walk
 */
export async function fetchWalkingRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  signal?: AbortSignal
): Promise<WalkRouteInfo> {
  const cacheKey = `${startLat.toFixed(5)},${startLng.toFixed(5)}_${endLat.toFixed(5)},${endLng.toFixed(5)}`;
  const cached = routeCache.get(cacheKey);

  const url = `/api/route/walk?startLat=${startLat}&startLng=${startLng}&endLat=${endLat}&endLng=${endLng}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    if (cached) return cached;
    throw new Error(`Failed to fetch walk route: ${res.statusText}`);
  }
  const data: WalkRouteInfo = await res.json();
  routeCache.set(cacheKey, data);
  return data;
}

/**
 * React hook for automatically syncing pedestrian walking route, real distance & ETA
 */
export function useWalkingRoute(
  userLocation: UserCoordinates,
  selectedRestroom: RestroomCandidate | null
) {
  const [walkRoute, setWalkRoute] = useState<WalkRouteInfo | null>(() => {
    if (!selectedRestroom) return null;
    const cacheKey = `${userLocation.lat.toFixed(5)},${userLocation.lng.toFixed(5)}_${selectedRestroom.lat.toFixed(5)},${selectedRestroom.lng.toFixed(5)}`;
    return routeCache.get(cacheKey) || null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!selectedRestroom) {
      setWalkRoute(null);
      return;
    }

    const startLat = userLocation.lat;
    const startLng = userLocation.lng;
    const endLat = selectedRestroom.lat;
    const endLng = selectedRestroom.lng;

    // Check cache first for instant display
    const cacheKey = `${startLat.toFixed(5)},${startLng.toFixed(5)}_${endLat.toFixed(5)},${endLng.toFixed(5)}`;
    const cached = routeCache.get(cacheKey);
    if (cached) {
      setWalkRoute(cached);
    }

    // Cancel in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    fetchWalkingRoute(startLat, startLng, endLat, endLng, controller.signal)
      .then((routeData) => {
        setWalkRoute(routeData);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.warn('Walking route fetch error:', err);
        setError(err.message || '경로 조회 실패');
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [userLocation.lat, userLocation.lng, selectedRestroom?.id, selectedRestroom?.lat, selectedRestroom?.lng]);

  // Periodic ETA refresh every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setWalkRoute((prev) => {
        if (!prev) return null;
        const now = Date.now();
        const targetDate = new Date(now + prev.walking_time_min * 60 * 1000);
        const hours = targetDate.getHours();
        const minutes = targetDate.getMinutes();
        const period = hours < 12 ? '오전' : '오후';
        const displayHours = hours % 12 === 0 ? 12 : hours % 12;
        const padMin = String(minutes).padStart(2, '0');
        const etaTimeString = `${displayHours}:${padMin}`;
        const etaText = `${period} ${displayHours}:${padMin} 도착 예정`;

        return {
          ...prev,
          eta_text: etaText,
          eta_time_string: etaTimeString,
        };
      });
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  return { walkRoute, isLoading, error };
}
