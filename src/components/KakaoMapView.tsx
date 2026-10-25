import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { RestroomCandidate, UserCoordinates, WalkRouteInfo } from '../types';
import { playHapticChime } from '../utils/speech';

interface KakaoMapViewProps {
  userLocation: UserCoordinates;
  candidateRestrooms: RestroomCandidate[];
  selectedRestroom: RestroomCandidate;
  onSelectRestroom: (r: RestroomCandidate) => void;
  kakaoAppKey?: string;
  onOpenSettings?: () => void;
  onStartNavigation?: () => void;
  isNavigating?: boolean;
  walkRoute?: WalkRouteInfo | null;
  isRouteLoading?: boolean;
}

// Crisp White & Cyan Toilet Graphic SVG (변기 이미지)
export const TOILET_ICON_SVG = `
<svg viewBox="0 0 48 48" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Tank Lid -->
  <rect x="8" y="5" width="32" height="4" rx="2" fill="#E2E8F0" stroke="#0F172A" stroke-width="2"/>
  <!-- Water Tank -->
  <rect x="10" y="7" width="28" height="15" rx="3" fill="#FFFFFF" stroke="#0F172A" stroke-width="2.5"/>
  <!-- Flush Handle -->
  <circle cx="33" cy="12" r="2.5" fill="#00E5FF" stroke="#0F172A" stroke-width="1.5"/>
  <!-- Bowl Rim & Seat -->
  <path d="M11 22h26v3c0 7.5-5.8 13.5-13 13.5S11 32.5 11 25v-3z" fill="#FFFFFF" stroke="#0F172A" stroke-width="2.5"/>
  <!-- Inside Water Hole -->
  <ellipse cx="24" cy="26" rx="9" ry="4.5" fill="#00E5FF" fill-opacity="0.3" stroke="#0F172A" stroke-width="1.8"/>
  <!-- Base Foot -->
  <path d="M17 38.5h14v3.5a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-3.5z" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
</svg>
`;

type MapTheme = 'modern' | 'dark' | 'satellite';

export const KakaoMapView: React.FC<KakaoMapViewProps> = ({
  userLocation,
  candidateRestrooms,
  selectedRestroom,
  onSelectRestroom,
  kakaoAppKey,
  onOpenSettings,
  isNavigating = false,
  walkRoute = null,
  isRouteLoading = false,
}) => {
  const kakaoContainerRef = useRef<HTMLDivElement>(null);
  const leafletContainerRef = useRef<HTMLDivElement>(null);

  const [engine, setEngine] = useState<'kakao' | 'leaflet'>('leaflet');
  const [isKakaoReady, setIsKakaoReady] = useState(false);
  const [mapTheme, setMapTheme] = useState<MapTheme>('modern');

  // References for Kakao Maps JS SDK
  const kakaoMapRef = useRef<any>(null);
  const kakaoOverlaysRef = useRef<any[]>([]);
  const kakaoUserOverlayRef = useRef<any>(null);
  const kakaoPolylineRef = useRef<any>(null);
  const kakaoRouteGlowRef = useRef<any>(null);
  const kakaoRouteBadgeRef = useRef<any>(null);
  const kakaoCircleRef = useRef<any>(null);

  // References for Leaflet engine
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletTileLayerRef = useRef<L.TileLayer | null>(null);
  const leafletMarkersRef = useRef<L.LayerGroup | null>(null);
  const leafletRouteRef = useRef<L.Polyline | null>(null);
  const leafletRouteGlowRef = useRef<L.Polyline | null>(null);
  const leafletRouteFlowRef = useRef<L.Polyline | null>(null);
  const leafletRouteBadgeRef = useRef<L.Marker | null>(null);
  const leafletUserMarkerRef = useRef<L.Marker | null>(null);
  const leafletCircleRef = useRef<L.Circle | null>(null);

  // Kakao Navigation & Web Directions Links (Kakao Mobility Developers API)
  const kakaoDirectionsWebUrl = `https://map.kakao.com/link/to/${encodeURIComponent(
    selectedRestroom.name
  )},${selectedRestroom.lat},${selectedRestroom.lng}`;

  const kakaoNaviAppScheme = `kakaonavi://navigate?name=${encodeURIComponent(
    selectedRestroom.name
  )}&x=${selectedRestroom.lng}&y=${selectedRestroom.lat}&coord_type=wgs84`;

  // -------------------------------------------------------------
  // 1. DYNAMIC SCRIPT LOADER FOR KAKAO MAPS JS SDK (WHEN KEY PROVIDED)
  // -------------------------------------------------------------
  useEffect(() => {
    const cleanKey = kakaoAppKey?.trim();
    if (!cleanKey) {
      setEngine('leaflet');
      setIsKakaoReady(false);
      return;
    }

    const kakaoWindow = (window as any).kakao;
    if (kakaoWindow && kakaoWindow.maps) {
      kakaoWindow.maps.load(() => {
        setIsKakaoReady(true);
        setEngine('kakao');
      });
      return;
    }

    const scriptId = 'kakao-maps-sdk';
    const oldScript = document.getElementById(scriptId);
    if (oldScript) {
      oldScript.remove();
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${cleanKey}&autoload=false&libraries=services,clusterer,drawing`;
    script.async = true;

    script.onload = () => {
      const kw = (window as any).kakao;
      if (kw && kw.maps) {
        kw.maps.load(() => {
          setIsKakaoReady(true);
          setEngine('kakao');
        });
      } else {
        setEngine('leaflet');
      }
    };

    script.onerror = () => {
      // Graceful fallback to Leaflet without crashing or showing error blocker
      console.info('Kakao Maps SDK load error - using high-resolution fallback map');
      setEngine('leaflet');
      setIsKakaoReady(false);
    };

    document.head.appendChild(script);
  }, [kakaoAppKey]);

  // -------------------------------------------------------------
  // 2. KAKAO MAP INITIALIZATION
  // -------------------------------------------------------------
  useEffect(() => {
    if (engine !== 'kakao' || !isKakaoReady) return;
    const container = kakaoContainerRef.current;
    if (!container) return;

    const kakao = (window as any).kakao;
    if (!kakao || !kakao.maps) return;

    if (!kakaoMapRef.current) {
      const options = {
        center: new kakao.maps.LatLng(userLocation.lat, userLocation.lng),
        level: 3,
      };
      const map = new kakao.maps.Map(container, options);
      kakaoMapRef.current = map;

      setTimeout(() => map.relayout(), 100);
      setTimeout(() => map.relayout(), 400);

      const resizeObserver = new ResizeObserver(() => {
        if (kakaoMapRef.current) {
          kakaoMapRef.current.relayout();
        }
      });
      resizeObserver.observe(container);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [engine, isKakaoReady]);

  // -------------------------------------------------------------
  // 3. KAKAO MAP MARKERS & ROUTE UPDATE
  // -------------------------------------------------------------
  useEffect(() => {
    if (engine !== 'kakao' || !isKakaoReady || !kakaoMapRef.current) return;
    const kakao = (window as any).kakao;
    if (!kakao || !kakao.maps) return;
    const map = kakaoMapRef.current;

    // Clear existing overlays & polylines
    kakaoOverlaysRef.current.forEach((o) => o.setMap(null));
    kakaoOverlaysRef.current = [];
    if (kakaoUserOverlayRef.current) {
      kakaoUserOverlayRef.current.setMap(null);
      kakaoUserOverlayRef.current = null;
    }
    if (kakaoRouteGlowRef.current) {
      kakaoRouteGlowRef.current.setMap(null);
      kakaoRouteGlowRef.current = null;
    }
    if (kakaoPolylineRef.current) {
      kakaoPolylineRef.current.setMap(null);
      kakaoPolylineRef.current = null;
    }
    if (kakaoRouteBadgeRef.current) {
      kakaoRouteBadgeRef.current.setMap(null);
      kakaoRouteBadgeRef.current = null;
    }

    // User Location Pin Overlay
    const userDiv = document.createElement('div');
    userDiv.style.pointerEvents = 'none';
    userDiv.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -50%); pointer-events:none;">
        <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
          <div style="position:absolute; inset:0; border-radius:9999px; background:rgba(0,229,255,0.4); animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="width:20px; height:20px; border-radius:9999px; background:#00e5ff; border:3px solid #ffffff; box-shadow:0 0 14px rgba(0,229,255,0.9); display:flex; align-items:center; justify-content:center;">
            <div style="width:6px; height:6px; border-radius:9999px; background:#0a0e13;"></div>
          </div>
        </div>
        <div style="margin-top:2px; font-family:'Space Grotesk',sans-serif; font-size:10px; font-weight:800; color:#c3f5ff; background:rgba(10,14,19,0.92); border:1px solid #31353b; padding:2px 7px; border-radius:9999px; box-shadow:0 2px 8px rgba(0,0,0,0.6); white-space:nowrap;">
          내 위치
        </div>
      </div>
    `;

    const userOverlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(userLocation.lat, userLocation.lng),
      content: userDiv,
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: 1000,
    });
    userOverlay.setMap(map);
    kakaoUserOverlayRef.current = userOverlay;

    // Toilet Markers (변기 이미지)
    candidateRestrooms.forEach((r) => {
      const isSelected = r.id === selectedRestroom.id;
      const markerDiv = document.createElement('div');
      markerDiv.style.cursor = 'pointer';

      let innerHtml = '';
      if (isSelected) {
        const distLabel = walkRoute ? `인도 ${walkRoute.distance_meters}m` : `${r.distance_meters}m`;
        const timeLabel = walkRoute ? `${walkRoute.walking_time_min}분` : `${r.walking_time_min}분`;
        const etaLabel = walkRoute?.eta_time_string ? ` · ${walkRoute.eta_time_string} 도착` : '';

        innerHtml = `
          <div style="display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%); cursor:pointer;">
            <div style="display:flex; align-items:center; gap:4px; background:#00e5ff; color:#00363d; padding:4px 10px; border-radius:9999px; box-shadow:0 0 20px rgba(0,229,255,0.9); font-family:'Space Grotesk',sans-serif; font-size:12px; font-weight:800; white-space:nowrap; border:1.5px solid #ffffff;">
              <span>⚡ ${distLabel} · ${timeLabel}${etaLabel}</span>
            </div>
            <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:6px solid #00e5ff; margin-bottom:1px;"></div>
            
            <div style="width:48px; height:48px; border-radius:9999px; background:linear-gradient(135deg, #ffffff, #e0f7fa); border:3px solid #00e5ff; display:flex; align-items:center; justify-content:center; box-shadow:0 6px 20px rgba(0,229,255,0.7), 0 2px 8px rgba(0,0,0,0.5); padding:6px; transform:scale(1.08);">
              ${TOILET_ICON_SVG}
            </div>
            <span style="font-family:'Space Grotesk',sans-serif; font-size:11px; font-weight:800; color:#ffffff; background:#0f172a; border:1px solid #00e5ff; padding:2px 8px; border-radius:6px; margin-top:3px; box-shadow:0 2px 6px rgba(0,0,0,0.8); white-space:nowrap;">
              ${r.name.split(' ')[0]}
            </span>
          </div>
        `;
      } else {
        innerHtml = `
          <div style="display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%); cursor:pointer; opacity:0.92;">
            <div style="width:36px; height:36px; border-radius:9999px; background:#ffffff; border:2.5px solid #46ffb8; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.4); padding:4px;">
              ${TOILET_ICON_SVG}
            </div>
            <span style="font-family:'Space Grotesk',sans-serif; font-size:10px; font-weight:700; color:#c3f5ff; background:rgba(15,23,42,0.92); border:1px solid #334155; padding:1px 6px; border-radius:9999px; margin-top:2px; box-shadow:0 2px 4px rgba(0,0,0,0.6); white-space:nowrap;">
              ${r.distance_meters}m
            </span>
          </div>
        `;
      }

      markerDiv.innerHTML = innerHtml;
      markerDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        playHapticChime('click');
        onSelectRestroom(r);
      });

      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(r.lat, r.lng),
        content: markerDiv,
        xAnchor: 0.5,
        yAnchor: 1.0,
        zIndex: isSelected ? 300 : 50,
      });

      overlay.setMap(map);
      kakaoOverlaysRef.current.push(overlay);
    });

    // Real Walkable Pedestrian Route Coordinates
    const routePoints: [number, number][] =
      walkRoute?.coordinates && walkRoute.coordinates.length > 1
        ? walkRoute.coordinates
        : [
            [userLocation.lat, userLocation.lng],
            [
              (userLocation.lat + selectedRestroom.lat) / 2 + 0.00004,
              (userLocation.lng + selectedRestroom.lng) / 2,
            ],
            [selectedRestroom.lat, selectedRestroom.lng],
          ];

    const linePath = routePoints.map(([lat, lng]) => new kakao.maps.LatLng(lat, lng));

    // 1) Outer Neon Glow Polyline
    const glowPolyline = new kakao.maps.Polyline({
      path: linePath,
      strokeWeight: isNavigating ? 14 : 10,
      strokeColor: '#00e5ff',
      strokeOpacity: 0.35,
      strokeStyle: 'solid',
    });
    glowPolyline.setMap(map);
    kakaoRouteGlowRef.current = glowPolyline;

    // 2) Primary Walkable Sidewalk Polyline
    const polyline = new kakao.maps.Polyline({
      path: linePath,
      strokeWeight: isNavigating ? 7 : 5,
      strokeColor: '#00e5ff',
      strokeOpacity: 0.98,
      strokeStyle: 'solid',
    });
    polyline.setMap(map);
    kakaoPolylineRef.current = polyline;

    // 3) Floating Walk Route Info Badge on Map Midpoint
    const midIdx = Math.floor(routePoints.length / 2);
    const midCoord = routePoints[midIdx] || [userLocation.lat, userLocation.lng];
    const displayDist = walkRoute ? `${walkRoute.distance_meters}m` : `${selectedRestroom.distance_meters}m`;
    const displayTime = walkRoute ? `${walkRoute.walking_time_min}분` : `${selectedRestroom.walking_time_min}분`;
    const displayEta = walkRoute?.eta_time_string || '';

    const badgeDiv = document.createElement('div');
    badgeDiv.innerHTML = `
      <div style="background: rgba(10, 14, 19, 0.94); border: 1.5px solid #00e5ff; box-shadow: 0 0 16px rgba(0, 229, 255, 0.8), 0 4px 12px rgba(0,0,0,0.8); border-radius: 9999px; padding: 4px 10px; color: #ffffff; font-family: 'Space Grotesk', sans-serif; font-size: 11px; font-weight: 800; display: flex; align-items: center; gap: 6px; white-space: nowrap; pointer-events: none; transform: translateY(-12px);">
        <span style="font-size: 13px;">🚶</span>
        <span style="color: #00e5ff; font-weight: 900;">인도 ${displayDist}</span>
        <span style="color: #46ffb8;">도보 ${displayTime}</span>
        ${displayEta ? `<span style="color: #849396;">·</span><span style="color: #ffffff; background: rgba(0, 229, 255, 0.2); padding: 1px 6px; border-radius: 6px; border: 1px solid rgba(0, 229, 255, 0.4);">⏰ ${displayEta} 도착</span>` : ''}
      </div>
    `;

    const routeBadge = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(midCoord[0], midCoord[1]),
      content: badgeDiv,
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: 260,
    });
    routeBadge.setMap(map);
    kakaoRouteBadgeRef.current = routeBadge;

    // 1km (1,000m) Radius Circle
    if (kakaoCircleRef.current) {
      kakaoCircleRef.current.setMap(null);
    }
    const kakaoCircle = new kakao.maps.Circle({
      center: new kakao.maps.LatLng(userLocation.lat, userLocation.lng),
      radius: 1000,
      strokeWeight: 1.5,
      strokeColor: '#00e5ff',
      strokeOpacity: 0.6,
      strokeStyle: 'dash',
      fillColor: '#00daf3',
      fillOpacity: 0.03,
    });
    kakaoCircle.setMap(map);
    kakaoCircleRef.current = kakaoCircle;

    // Fit Bounds along actual walk route
    const bounds = new kakao.maps.LatLngBounds();
    routePoints.forEach(([lat, lng]) => bounds.extend(new kakao.maps.LatLng(lat, lng)));
    const [pt, pr, pb, pl] = isNavigating ? [140, 40, 220, 40] : [90, 90, 90, 90];
    map.setBounds(bounds, pt, pr, pb, pl);
  }, [engine, isKakaoReady, userLocation, candidateRestrooms, selectedRestroom, onSelectRestroom, isNavigating, walkRoute]);

  // Helper for ultra-crisp modern map tile themes (clean, high resolution, no watermarks)
  const getTileConfig = (theme: MapTheme) => {
    switch (theme) {
      case 'dark':
        // Esri Dark Gray Canvas - Sleek Cyberpunk Night Map
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          subdomains: ['a', 'b', 'c', 'd'],
          maxZoom: 19,
        };
      case 'satellite':
        // Esri World Imagery - Ultra HD Satellite Map
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          subdomains: ['a', 'b', 'c', 'd'],
          maxZoom: 19,
        };
      case 'modern':
      default:
        // Modern High-Contrast Vector Style Humanitarian OSM (Korean POIs, roads, buildings)
        return {
          url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
          subdomains: ['a', 'b'],
          maxZoom: 19,
        };
    }
  };

  // -------------------------------------------------------------
  // 4. LEAFLET MAP INITIALIZATION (FULL SCREEN & IMMEDIATE)
  // -------------------------------------------------------------
  useEffect(() => {
    if (engine === 'kakao' && isKakaoReady) return;
    const container = leafletContainerRef.current;
    if (!container) return;

    if (!leafletMapRef.current) {
      const map = L.map(container, {
        center: [userLocation.lat, userLocation.lng],
        zoom: 17,
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
      });

      const tileCfg = getTileConfig(mapTheme);
      leafletTileLayerRef.current = L.tileLayer(tileCfg.url, {
        maxZoom: tileCfg.maxZoom,
        subdomains: tileCfg.subdomains,
        crossOrigin: true,
        detectRetina: true,
      }).addTo(map);

      leafletMarkersRef.current = L.layerGroup().addTo(map);
      leafletMapRef.current = map;

      // Ensure proper sizing immediately and upon animations
      const t1 = setTimeout(() => map.invalidateSize(), 30);
      const t2 = setTimeout(() => map.invalidateSize(), 150);
      const t3 = setTimeout(() => map.invalidateSize(), 500);

      const resizeObserver = new ResizeObserver(() => {
        if (leafletMapRef.current) {
          leafletMapRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(container);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        resizeObserver.disconnect();
      };
    } else {
      leafletMapRef.current.invalidateSize();
    }
  }, [engine, isKakaoReady]);

  // Dynamic Theme Switching (Modern HD / Dark Cyber / Satellite)
  useEffect(() => {
    if (engine === 'kakao' && kakaoMapRef.current && (window as any).kakao?.maps) {
      const kakao = (window as any).kakao;
      if (mapTheme === 'satellite') {
        kakaoMapRef.current.setMapTypeId(kakao.maps.MapTypeId.HYBRID);
      } else {
        kakaoMapRef.current.setMapTypeId(kakao.maps.MapTypeId.ROADMAP);
      }
    } else if (engine === 'leaflet' && leafletMapRef.current) {
      if (leafletTileLayerRef.current) {
        leafletTileLayerRef.current.remove();
      }
      const tileCfg = getTileConfig(mapTheme);
      leafletTileLayerRef.current = L.tileLayer(tileCfg.url, {
        maxZoom: tileCfg.maxZoom,
        subdomains: tileCfg.subdomains,
        crossOrigin: true,
        detectRetina: true,
      }).addTo(leafletMapRef.current);
    }
  }, [mapTheme, engine]);

  // -------------------------------------------------------------
  // 5. LEAFLET MARKERS & ROUTE UPDATE (WITH TOILET ICONS)
  // -------------------------------------------------------------
  useEffect(() => {
    if (engine !== 'leaflet') return;
    const map = leafletMapRef.current;
    const markersLayer = leafletMarkersRef.current;
    if (!map || !markersLayer) return;

    map.invalidateSize();

    // User pin
    if (leafletUserMarkerRef.current) {
      leafletUserMarkerRef.current.remove();
    }

    const userHtml = `
      <div style="display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -50%); pointer-events:none;">
        <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
          <div style="position:absolute; inset:0; border-radius:9999px; background:rgba(0,229,255,0.4); animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="width:20px; height:20px; border-radius:9999px; background:#00e5ff; border:3px solid #ffffff; box-shadow:0 0 14px rgba(0,229,255,0.9); display:flex; align-items:center; justify-content:center;">
            <div style="width:6px; height:6px; border-radius:9999px; background:#0a0e13;"></div>
          </div>
        </div>
        <div style="margin-top:2px; font-family:'Space Grotesk',sans-serif; font-size:10px; font-weight:800; color:#c3f5ff; background:rgba(10,14,19,0.92); border:1px solid #31353b; padding:2px 7px; border-radius:9999px; box-shadow:0 2px 8px rgba(0,0,0,0.6); white-space:nowrap;">
          내 위치
        </div>
      </div>
    `;

    const userIcon = L.divIcon({
      html: userHtml,
      className: 'user-location-pin',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    leafletUserMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
      icon: userIcon,
      zIndexOffset: 1000,
    }).addTo(map);

    // Toilet markers (변기 이미지)
    markersLayer.clearLayers();

    candidateRestrooms.forEach((r) => {
      const isSelected = r.id === selectedRestroom.id;
      let markerHtml = '';

      if (isSelected) {
        const distLabel = walkRoute ? `인도 ${walkRoute.distance_meters}m` : `${r.distance_meters}m`;
        const timeLabel = walkRoute ? `${walkRoute.walking_time_min}분` : `${r.walking_time_min}분`;
        const etaLabel = walkRoute?.eta_time_string ? ` · ${walkRoute.eta_time_string} 도착` : '';

        markerHtml = `
          <div style="display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%); cursor:pointer;">
            <div style="display:flex; align-items:center; gap:4px; background:#00e5ff; color:#00363d; padding:4px 10px; border-radius:9999px; box-shadow:0 0 20px rgba(0,229,255,0.9); font-family:'Space Grotesk',sans-serif; font-size:12px; font-weight:800; white-space:nowrap; border:1.5px solid #ffffff;">
              <span>⚡ ${distLabel} · ${timeLabel}${etaLabel}</span>
            </div>
            <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:6px solid #00e5ff; margin-bottom:1px;"></div>
            
            <div style="width:48px; height:48px; border-radius:9999px; background:linear-gradient(135deg, #ffffff, #e0f7fa); border:3px solid #00e5ff; display:flex; align-items:center; justify-content:center; box-shadow:0 6px 20px rgba(0,229,255,0.7), 0 2px 8px rgba(0,0,0,0.5); padding:6px; transform:scale(1.08);">
              ${TOILET_ICON_SVG}
            </div>
            <span style="font-family:'Space Grotesk',sans-serif; font-size:11px; font-weight:800; color:#ffffff; background:#0f172a; border:1px solid #00e5ff; padding:2px 8px; border-radius:6px; margin-top:3px; box-shadow:0 2px 6px rgba(0,0,0,0.8); white-space:nowrap;">
              ${r.name.split(' ')[0]}
            </span>
          </div>
        `;
      } else {
        markerHtml = `
          <div style="display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%); cursor:pointer; opacity:0.92;">
            <div style="width:36px; height:36px; border-radius:9999px; background:#ffffff; border:2.5px solid #46ffb8; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.4); padding:4px;">
              ${TOILET_ICON_SVG}
            </div>
            <span style="font-family:'Space Grotesk',sans-serif; font-size:10px; font-weight:700; color:#c3f5ff; background:rgba(15,23,42,0.92); border:1px solid #334155; padding:1px 6px; border-radius:9999px; margin-top:2px; box-shadow:0 2px 4px rgba(0,0,0,0.6); white-space:nowrap;">
              ${r.distance_meters}m
            </span>
          </div>
        `;
      }

      const icon = L.divIcon({
        html: markerHtml,
        className: `toilet-marker-${r.id}`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([r.lat, r.lng], {
        icon,
        zIndexOffset: isSelected ? 600 : 200,
      });

      marker.on('click', () => {
        playHapticChime('click');
        onSelectRestroom(r);
      });

      marker.addTo(markersLayer);
    });

    // Clear existing polylines & badges
    if (leafletRouteGlowRef.current) {
      leafletRouteGlowRef.current.remove();
      leafletRouteGlowRef.current = null;
    }
    if (leafletRouteRef.current) {
      leafletRouteRef.current.remove();
      leafletRouteRef.current = null;
    }
    if (leafletRouteFlowRef.current) {
      leafletRouteFlowRef.current.remove();
      leafletRouteFlowRef.current = null;
    }
    if (leafletRouteBadgeRef.current) {
      leafletRouteBadgeRef.current.remove();
      leafletRouteBadgeRef.current = null;
    }

    const routeLatlngs: [number, number][] =
      walkRoute?.coordinates && walkRoute.coordinates.length > 1
        ? walkRoute.coordinates
        : [
            [userLocation.lat, userLocation.lng],
            [
              (userLocation.lat + selectedRestroom.lat) / 2 + 0.00004,
              (userLocation.lng + selectedRestroom.lng) / 2,
            ],
            [selectedRestroom.lat, selectedRestroom.lng],
          ];

    // 1) Outer Neon Glow Polyline
    leafletRouteGlowRef.current = L.polyline(routeLatlngs, {
      color: '#00e5ff',
      weight: isNavigating ? 14 : 10,
      opacity: 0.35,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    // 2) Primary Walkable Sidewalk Polyline
    leafletRouteRef.current = L.polyline(routeLatlngs, {
      color: '#00e5ff',
      weight: isNavigating ? 7 : 5,
      opacity: 0.98,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    // 3) Animated Flow Pulse Polyline (Directional Live Navigation)
    leafletRouteFlowRef.current = L.polyline(routeLatlngs, {
      color: '#ffffff',
      weight: 3.5,
      opacity: 0.95,
      dashArray: '8, 12',
      className: 'walk-route-flow',
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    // 4) Floating Walk Route Info Badge on Map Midpoint
    const midIdx = Math.floor(routeLatlngs.length / 2);
    const midCoord = routeLatlngs[midIdx] || [userLocation.lat, userLocation.lng];
    const displayDist = walkRoute ? `${walkRoute.distance_meters}m` : `${selectedRestroom.distance_meters}m`;
    const displayTime = walkRoute ? `${walkRoute.walking_time_min}분` : `${selectedRestroom.walking_time_min}분`;
    const displayEta = walkRoute?.eta_time_string || '';

    const badgeHtml = `
      <div style="background: rgba(10, 14, 19, 0.94); border: 1.5px solid #00e5ff; box-shadow: 0 0 16px rgba(0, 229, 255, 0.8), 0 4px 12px rgba(0,0,0,0.8); border-radius: 9999px; padding: 4px 10px; color: #ffffff; font-family: 'Space Grotesk', sans-serif; font-size: 11px; font-weight: 800; display: flex; align-items: center; gap: 6px; white-space: nowrap; pointer-events: none; transform: translate(-50%, -50%);">
        <span style="font-size: 13px;">🚶</span>
        <span style="color: #00e5ff; font-weight: 900;">인도 ${displayDist}</span>
        <span style="color: #46ffb8;">도보 ${displayTime}</span>
        ${displayEta ? `<span style="color: #849396;">·</span><span style="color: #ffffff; background: rgba(0, 229, 255, 0.2); padding: 1px 6px; border-radius: 6px; border: 1px solid rgba(0, 229, 255, 0.4);">⏰ ${displayEta} 도착</span>` : ''}
      </div>
    `;

    const badgeIcon = L.divIcon({
      className: 'leaflet-route-badge',
      html: badgeHtml,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    leafletRouteBadgeRef.current = L.marker([midCoord[0], midCoord[1]], {
      icon: badgeIcon,
      interactive: false,
      zIndexOffset: 800,
    }).addTo(map);

    // 1km (1,000m) Radius Circle
    if (leafletCircleRef.current) {
      leafletCircleRef.current.remove();
    }
    leafletCircleRef.current = L.circle([userLocation.lat, userLocation.lng], {
      radius: 1000,
      color: '#00e5ff',
      weight: 1.5,
      dashArray: '5, 8',
      opacity: 0.6,
      fillColor: '#00daf3',
      fillOpacity: 0.03,
    }).addTo(map);

    // Auto bounds fitting along actual walk route
    const bounds = L.latLngBounds(routeLatlngs);
    const paddingVal: [number, number] = isNavigating ? [140, 40] : [90, 90];
    map.fitBounds(bounds, { padding: paddingVal, maxZoom: isNavigating ? 19 : 18 });
  }, [engine, userLocation, candidateRestrooms, selectedRestroom, onSelectRestroom, isNavigating, walkRoute]);

  // Recenter handler
  const handleRecenter = useCallback(() => {
    playHapticChime('click');
    if (engine === 'kakao' && kakaoMapRef.current && (window as any).kakao?.maps) {
      const kakao = (window as any).kakao;
      kakaoMapRef.current.panTo(new kakao.maps.LatLng(userLocation.lat, userLocation.lng));
      kakaoMapRef.current.setLevel(3);
    } else if (leafletMapRef.current) {
      leafletMapRef.current.invalidateSize();
      leafletMapRef.current.setView([userLocation.lat, userLocation.lng], 17, { animate: true });
    }
  }, [engine, userLocation]);

  // Zoom handlers (supports both Kakao and modern Leaflet)
  const handleZoomIn = useCallback(() => {
    playHapticChime('click');
    if (engine === 'kakao' && kakaoMapRef.current) {
      const currentLevel = kakaoMapRef.current.getLevel();
      kakaoMapRef.current.setLevel(Math.max(1, currentLevel - 1), { animate: true });
    } else if (leafletMapRef.current) {
      leafletMapRef.current.zoomIn();
    }
  }, [engine]);

  const handleZoomOut = useCallback(() => {
    playHapticChime('click');
    if (engine === 'kakao' && kakaoMapRef.current) {
      const currentLevel = kakaoMapRef.current.getLevel();
      kakaoMapRef.current.setLevel(Math.min(14, currentLevel + 1), { animate: true });
    } else if (leafletMapRef.current) {
      leafletMapRef.current.zoomOut();
    }
  }, [engine]);

  // Kakao Navi Scheme / Web launch
  const handleLaunchKakaoNavi = () => {
    playHapticChime('click');
    window.location.href = kakaoNaviAppScheme;
    setTimeout(() => {
      window.open(kakaoDirectionsWebUrl, '_blank', 'noopener,noreferrer');
    }, 400);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#101419] select-none">
      {/* 1. Kakao Map Canvas (Visible when Kakao Map engine is active) */}
      <div
        ref={kakaoContainerRef}
        id="kakao-map-container"
        className={`w-full h-full absolute inset-0 z-0 ${
          engine === 'kakao' ? 'block' : 'hidden'
        }`}
        style={{ minHeight: '100%', minWidth: '100%' }}
      />

      {/* 2. Full-Screen Map Canvas (Ultra-crisp modern HD map with toilet markers) */}
      <div
        ref={leafletContainerRef}
        id="leaflet-fallback-container"
        className={`w-full h-full absolute inset-0 z-0 ${
          engine === 'leaflet' ? 'block' : 'hidden'
        }`}
        style={{ minHeight: '100%', minWidth: '100%' }}
      />

      {/* Map Theme Switcher Pill (Top-Left, comfortably below top navigation HUD) */}
      <div className="absolute left-3 top-[112px] z-20 flex items-center bg-[#0a0e13]/92 backdrop-blur-xl border border-white/10 rounded-full p-1 shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
        <button
          onClick={() => {
            playHapticChime('click');
            setMapTheme('modern');
          }}
          className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition-all cursor-pointer ${
            mapTheme === 'modern'
              ? 'bg-[#00e5ff] text-[#00272e] shadow-[0_0_10px_rgba(0,229,255,0.7)]'
              : 'text-slate-300 hover:text-white'
          }`}
          title="카카오/모던 벡터 HD 지도"
        >
          모던 HD
        </button>
        <button
          onClick={() => {
            playHapticChime('click');
            setMapTheme('dark');
          }}
          className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition-all cursor-pointer ${
            mapTheme === 'dark'
              ? 'bg-[#00e5ff] text-[#00272e] shadow-[0_0_10px_rgba(0,229,255,0.7)]'
              : 'text-slate-300 hover:text-white'
          }`}
          title="사이버 다크 야간 지도"
        >
          다크
        </button>
        <button
          onClick={() => {
            playHapticChime('click');
            setMapTheme('satellite');
          }}
          className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition-all cursor-pointer ${
            mapTheme === 'satellite'
              ? 'bg-[#00e5ff] text-[#00272e] shadow-[0_0_10px_rgba(0,229,255,0.7)]'
              : 'text-slate-300 hover:text-white'
          }`}
          title="고해상도 위성 지도"
        >
          위성
        </button>
      </div>

      {/* Modern Zoom & Recenter Control Stack (Top-Right, comfortably below top HUD) */}
      <div className="absolute right-3 top-[112px] z-20 flex flex-col items-center bg-[#0a0e13]/92 backdrop-blur-xl border border-white/10 rounded-2xl p-1 shadow-[0_4px_16px_rgba(0,0,0,0.6)] gap-1">
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white/80 hover:text-[#00e5ff] hover:bg-white/5 active:scale-90 transition-all cursor-pointer"
          title="지도 확대"
          aria-label="확대"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
        </button>
        <div className="w-4 h-[1px] bg-white/10" />
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white/80 hover:text-[#00e5ff] hover:bg-white/5 active:scale-90 transition-all cursor-pointer"
          title="지도 축소"
          aria-label="축소"
        >
          <span className="material-symbols-outlined text-[18px]">remove</span>
        </button>
        <div className="w-4 h-[1px] bg-white/10" />
        <button
          onClick={handleRecenter}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-[#00e5ff] hover:bg-[#00e5ff]/10 active:scale-90 transition-all cursor-pointer"
          title="내 위치로 이동"
          aria-label="내 위치 이동"
        >
          <span className="material-symbols-outlined text-[18px]">my_location</span>
        </button>
      </div>
    </div>
  );
};
