import { UserCoordinates } from '../types';
import { INITIAL_USER_LOCATION } from '../data/mockRestrooms';

export type GpsStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'timeout';

/**
 * Formats latitude and longitude cleanly for display
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latStr = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lngStr}`;
}

/**
 * Reverse geocodes coordinates to a human-readable Korean address.
 * Tries Kakao Geocoder first if loaded, then falls back to OpenStreetMap Nominatim or formatted coordinate label.
 */
export async function reverseGeocodeKorean(lat: number, lng: number): Promise<string> {
  // 1. Try Kakao Geocoder if available on window
  try {
    const kakao = (window as any).kakao;
    if (kakao && kakao.maps && kakao.maps.services && kakao.maps.services.Geocoder) {
      const geocoder = new kakao.maps.services.Geocoder();
      const kakaoAddress = await new Promise<string | null>((resolve) => {
        geocoder.coord2Address(lng, lat, (result: any[], status: any) => {
          if (status === kakao.maps.services.Status.OK && result && result.length > 0) {
            const road = result[0].road_address?.address_name;
            const jibun = result[0].address?.address_name;
            resolve(road || jibun || null);
          } else {
            resolve(null);
          }
        });
      });
      if (kakaoAddress) {
        return kakaoAddress;
      }
    }
  } catch (err) {
    console.warn('Kakao geocoder check skipped:', err);
  }

  // 2. Try OpenStreetMap Nominatim fetch with timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: { 'Accept-Language': 'ko' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const parts = [
          data.address.borough || data.address.city_district || data.address.suburb,
          data.address.road || data.address.quarter || data.address.neighbourhood,
        ].filter(Boolean);
        if (parts.length > 0) {
          return `${parts.join(' ')} 부근`;
        }
      }
      if (data && data.display_name) {
        const first = data.display_name.split(',')[0];
        return `${first} 부근`;
      }
    }
  } catch {
    // Fall back to coordinate string
  }

  // 3. Fallback to coordinate string with precision
  return `GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

/**
 * Requests real device GPS position with high accuracy and automatic fallback
 */
export function getCurrentGpsPosition(): Promise<{
  coords: { latitude: number; longitude: number; accuracy: number };
  timestamp: number;
}> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      reject(new Error('이 브라우저는 GPS 위치 조회를 지원하지 않습니다.'));
      return;
    }

    // Try high accuracy first (5 sec timeout)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
          timestamp: pos.timestamp,
        });
      },
      (highErr) => {
        // Fallback to low accuracy / cellular / wifi triangulation (faster)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              coords: {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
              },
              timestamp: pos.timestamp,
            });
          },
          (lowErr) => {
            if (lowErr.code === lowErr.PERMISSION_DENIED) {
              reject(new Error('GPS 위치 권한이 차단되었습니다. 위치 권한을 허용해주세요.'));
            } else if (lowErr.code === lowErr.POSITION_UNAVAILABLE) {
              reject(new Error('현재 위치 정보를 수신할 수 없습니다. 잠시 후 다시 시도해주세요.'));
            } else {
              reject(new Error('GPS 위치 수신 시간 초과. 다시 시도해주세요.'));
            }
          },
          {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 10000,
          }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  });
}
