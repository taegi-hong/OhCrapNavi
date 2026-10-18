import React, { useState, useEffect, useCallback } from 'react';
import {
  CANDIDATE_RESTROOMS,
  INITIAL_USER_LOCATION,
  recalculateDistances,
} from './data/mockRestrooms';
import {
  FlushPulseAIResponse,
  RestroomCandidate,
  UrgencyLevel,
  UserCoordinates,
} from './types';
import { Header } from './components/Header';
import { RadarScreen } from './components/RadarScreen';
import { LiveNavScreen } from './components/LiveNavScreen';
import { VoiceAssistModal } from './components/VoiceAssistModal';
import { JsonInspectorModal } from './components/JsonInspectorModal';
import { IndoorWalkthroughModal } from './components/IndoorWalkthroughModal';
import { SettingsModal } from './components/SettingsModal';
import { speakKoreanTTS, stopSpeech, playHapticChime, initVoices } from './utils/speech';
import { getCurrentGpsPosition, reverseGeocodeKorean } from './utils/geolocation';
import { useWalkingRoute } from './utils/walkingRoute';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'radar' | 'nav'>('radar');
  const [userLocation, setUserLocation] = useState<UserCoordinates>(INITIAL_USER_LOCATION);
  const [isGpsLoading, setIsGpsLoading] = useState<boolean>(false);
  const [gpsErrorMessage, setGpsErrorMessage] = useState<string | null>(null);

  const [urgencyLevel, setUrgencyLevel] = useState<UrgencyLevel>('extreme');
  const [candidateRestrooms, setCandidateRestrooms] = useState<RestroomCandidate[]>(CANDIDATE_RESTROOMS);
  const [selectedRestroom, setSelectedRestroom] = useState<RestroomCandidate>(CANDIDATE_RESTROOMS[0]);

  // Real-time Walkable Sidewalk Route & ETA
  const { walkRoute, isLoading: isRouteLoading } = useWalkingRoute(userLocation, selectedRestroom);

  // Kakao App Key from environment variables (VITE_KAKAO_MAP_API_KEY) or localStorage
  const [kakaoAppKey, setKakaoAppKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const envKey =
        (import.meta as any).env?.VITE_KAKAO_MAP_API_KEY ||
        (import.meta as any).env?.VITE_KAKAO_MAP_KEY ||
        (import.meta as any).env?.VITE_KAKAO_JAVASCRIPT_KEY ||
        (import.meta as any).env?.VITE_KAKAO_APP_KEY ||
        '';
      return envKey || localStorage.getItem('kakao_app_key') || '';
    }
    return '';
  });

  // AI Guidance states
  const [stepInstruction, setStepInstruction] = useState<string>(
    '50m 직진 후 회전문 통과, 로비 우측 복도로 진입하세요.'
  );
  const [voiceTtsMessage, setVoiceTtsMessage] = useState<string>(
    '120미터 앞 역삼빌딩 1층 개방 화장실로 즉시 안내합니다. 비밀번호 없이 바로 진입 가능합니다.'
  );
  const [lastVoicePrompt, setLastVoicePrompt] = useState<string>('가장 가까운 화장실 찾아줘');
  const [lastAIResponse, setLastAIResponse] = useState<FlushPulseAIResponse | null>({
    intent: 'emergency_search',
    urgency_level: 'extreme',
    recommended_restroom: {
      name: CANDIDATE_RESTROOMS[0].name,
      distance_meters: CANDIDATE_RESTROOMS[0].distance_meters,
      walking_time_min: CANDIDATE_RESTROOMS[0].walking_time_min,
      is_open: CANDIDATE_RESTROOMS[0].is_open,
      floor_or_location_details: CANDIDATE_RESTROOMS[0].floor_or_location_details,
      has_password: CANDIDATE_RESTROOMS[0].has_password,
      access_notes: CANDIDATE_RESTROOMS[0].access_notes,
    },
    voice_tts_message:
      '120미터 앞 역삼빌딩 1층 개방 화장실로 즉시 안내합니다. 비밀번호 없이 바로 진입 가능합니다.',
    step_instruction: '50m 직진 후 회전문 통과, 로비 우측 복도로 진입하세요.',
    ui_action: 'START_NAV',
  });

  // Sync walking route distance and ETA with voice assistant messages
  useEffect(() => {
    if (walkRoute) {
      const firstStep =
        walkRoute.steps?.[0]?.instruction ||
        `${selectedRestroom.name} 방면으로 이동하세요.`;
      setStepInstruction(firstStep);
      setVoiceTtsMessage(
        `${selectedRestroom.name}까지 실제 인도 보행 거리는 ${walkRoute.distance_meters}m이며, 약 ${walkRoute.walking_time_min}분 후 ${walkRoute.eta_time_string}에 도착 예정입니다.`
      );
    }
  }, [
    walkRoute?.distance_meters,
    walkRoute?.eta_time_string,
    selectedRestroom.id,
    selectedRestroom.name,
  ]);

  // Modals
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isIndoorModalOpen, setIsIndoorModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [wheelchairOnly, setWheelchairOnly] = useState(false);

  const [isRestroomApiLoading, setIsRestroomApiLoading] = useState<boolean>(false);
  const [apiSourceInfo, setApiSourceInfo] = useState<{
    endpoint: string;
    status: string;
    total: number;
    timestamp: number;
  }>({
    endpoint: 'https://sample.localdata.go.kr/public/public_restroom_info/info',
    status: 'connected',
    total: CANDIDATE_RESTROOMS.length,
    timestamp: Date.now(),
  });

  // Fetch real-time public restrooms within 1km from localdata.go.kr API
  const fetchNearbyRestrooms = useCallback(
    async (lat: number, lng: number, silent = false) => {
      setIsRestroomApiLoading(true);
      try {
        const resp = await fetch(
          `/api/restrooms/nearby?lat=${lat}&lng=${lng}&radius=1000`
        );
        if (resp.ok) {
          const result = await resp.json();
          if (
            result?.success &&
            Array.isArray(result.restrooms) &&
            result.restrooms.length > 0
          ) {
            setCandidateRestrooms(result.restrooms);
            setApiSourceInfo({
              endpoint:
                result.api_endpoint ||
                'https://sample.localdata.go.kr/public/public_restroom_info/info',
              status: result.api_status || 'connected',
              total: result.total_found || result.restrooms.length,
              timestamp: result.timestamp || Date.now(),
            });

            setSelectedRestroom((prev) => {
              const exists = result.restrooms.find(
                (r: RestroomCandidate) => r.id === prev?.id
              );
              return exists || result.restrooms[0];
            });

            const nearest = result.restrooms[0];
            setVoiceTtsMessage(
              `${nearest.name}까지 ${nearest.distance_meters}m, 도보 ${nearest.walking_time_min}분 소요됩니다.`
            );
            setStepInstruction(
              `현재 위치에서 ${nearest.name} 방면으로 이동하세요.`
            );

            if (!silent && autoSpeak) {
              speakKoreanTTS(
                `반경 1km 공중화장실 ${result.restrooms.length}곳이 실시간 탐색되었습니다. ${nearest.name}로 안내합니다.`
              );
            }
          }
        }
      } catch (apiErr) {
        console.warn('Failed to query /api/restrooms/nearby:', apiErr);
      } finally {
        setIsRestroomApiLoading(false);
      }
    },
    [autoSpeak]
  );

  // Real GPS fetch function
  const fetchLiveGps = useCallback(async () => {
    setIsGpsLoading(true);
    setGpsErrorMessage(null);

    try {
      const pos = await getCurrentGpsPosition();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracyMeters = Math.round(pos.coords.accuracy);

      // Reverse geocode to Korean address
      const address = await reverseGeocodeKorean(lat, lng);

      const updatedCoords: UserCoordinates = {
        lat,
        lng,
        address,
        accuracy: `GPS ±${accuracyMeters}m`,
        isLiveGps: true,
        timestamp: pos.timestamp,
      };

      setUserLocation(updatedCoords);

      // Real-time query to public restroom API within 1km
      await fetchNearbyRestrooms(lat, lng, false);
    } catch (err: any) {
      console.warn('GPS fetching error:', err);
      let errorMsg = err?.message || 'GPS 수신 실패 (위치 권한을 확인해주세요)';
      if (err.code === 1) {
        errorMsg = '브라우저 위치 권한이 차단되었습니다. 주소창에서 위치 허용을 켜주세요.';
      } else if (err.code === 2) {
        errorMsg = 'GPS 신호를 수신할 수 없습니다. (실내이거나 기기 위치 비활성화)';
      } else if (err.code === 3) {
        errorMsg = 'GPS 수신 시간이 초과되었습니다. 다시 시도해주세요.';
      }
      setGpsErrorMessage(errorMsg);
    } finally {
      setIsGpsLoading(false);
    }
  }, [fetchNearbyRestrooms]);

  // Request GPS and Preload voices on initial mount + Fetch config from server
  useEffect(() => {
    initVoices().catch(() => {});
    fetchNearbyRestrooms(
      INITIAL_USER_LOCATION.lat,
      INITIAL_USER_LOCATION.lng,
      true
    );
    fetchLiveGps();

    // Dynamically retrieve configured Kakao API Key from server environment
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data?.kakaoAppKey) {
          setKakaoAppKey((prev) => prev || data.kakaoAppKey);
        }
      })
      .catch(() => {});
  }, []);

  // Save Kakao App Key (syncs to state, localStorage, and .env via backend)
  const handleSaveKakaoAppKey = (key: string) => {
    const cleanKey = key.trim();
    setKakaoAppKey(cleanKey);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kakao_app_key', cleanKey);
    }
    // Sync to .env on server
    fetch('/api/config/kakao-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: cleanKey }),
    }).catch(() => {});
  };

  // Toggle urgency (급똥 모드 ON <-> 일반 탐색 모드)
  const handleToggleUrgency = () => {
    const nextUrgency: UrgencyLevel = urgencyLevel === 'extreme' ? 'normal' : 'extreme';
    setUrgencyLevel(nextUrgency);
    if (nextUrgency === 'extreme') {
      setLastVoicePrompt('급똥이야! 1분 내 갈 수 있는 곳!');
      if (autoSpeak) {
        speakKoreanTTS('급똥 모드가 켜졌습니다. 최단거리 화장실을 즉시 안내합니다.');
      }
    } else {
      setLastVoicePrompt('주변 개방 화장실 탐색');
    }
  };

  // Start Navigation Action
  const handleStartNavigation = () => {
    setCurrentTab('nav');
    if (autoSpeak) {
      speakKoreanTTS(voiceTtsMessage || stepInstruction);
    }
  };

  // Exit Navigation Action
  const handleExitNavigation = () => {
    stopSpeech();
    setCurrentTab('radar');
  };

  // Apply response from Gemini AI Assist
  const handleApplyAIResponse = (response: FlushPulseAIResponse) => {
    setLastAIResponse(response);
    setUrgencyLevel(response.urgency_level);
    setStepInstruction(response.step_instruction);
    setVoiceTtsMessage(response.voice_tts_message);

    // Find or update matching candidate restroom
    const matched = candidateRestrooms.find(
      (r) =>
        r.name.includes(response.recommended_restroom.name) ||
        response.recommended_restroom.name.includes(r.name)
    );

    if (matched) {
      setSelectedRestroom(matched);
    } else {
      // create updated target
      const newRestroom: RestroomCandidate = {
        id: `restroom-${Date.now()}`,
        name: response.recommended_restroom.name,
        lat: userLocation.lat + 0.0008,
        lng: userLocation.lng + 0.0008,
        distance_meters: response.recommended_restroom.distance_meters,
        walking_time_min: response.recommended_restroom.walking_time_min,
        is_open: response.recommended_restroom.is_open,
        floor_or_location_details: response.recommended_restroom.floor_or_location_details,
        door_code: response.recommended_restroom.has_password ? '7721#' : 'FREE',
        has_password: response.recommended_restroom.has_password,
        access_notes: response.recommended_restroom.access_notes,
        indoor_steps: [
          '건물 주 출입구로 진입하세요.',
          response.recommended_restroom.floor_or_location_details,
          response.recommended_restroom.access_notes,
        ],
        cleanliness_score: 4.8,
        stalls_total: 4,
        stalls_available: 3,
        queue_count: 0,
        gender_separated: true,
        wheelchair_accessible: true,
        baby_facility: true,
        open_hours: '24시간 개방',
        verified: true,
        radar_x: 28,
        radar_y: 26,
      };
      setSelectedRestroom(newRestroom);
    }

    if (response.ui_action === 'START_NAV') {
      setCurrentTab('nav');
      if (autoSpeak) {
        speakKoreanTTS(response.voice_tts_message);
      }
    } else {
      if (autoSpeak) {
        speakKoreanTTS(response.voice_tts_message);
      }
    }
  };

  // Reroute to next candidate
  const handleReroute = () => {
    const currentIndex = candidateRestrooms.findIndex((r) => r.id === selectedRestroom.id);
    const nextIndex = (currentIndex + 1) % candidateRestrooms.length;
    const nextRestroom = candidateRestrooms[nextIndex];
    setSelectedRestroom(nextRestroom);

    const newInstruction = `${nextRestroom.distance_meters}m 직진 후 ${nextRestroom.name} ${nextRestroom.floor_or_location_details}로 진입하세요.`;
    const newVoice = `대체 화장실인 ${nextRestroom.name}으로 경로를 재설정했습니다. 도보 ${nextRestroom.walking_time_min}분 소요됩니다.`;

    setStepInstruction(newInstruction);
    setVoiceTtsMessage(newVoice);

    setLastAIResponse({
      intent: 'emergency_search',
      urgency_level: urgencyLevel,
      recommended_restroom: {
        name: nextRestroom.name,
        distance_meters: nextRestroom.distance_meters,
        walking_time_min: nextRestroom.walking_time_min,
        is_open: nextRestroom.is_open,
        floor_or_location_details: nextRestroom.floor_or_location_details,
        has_password: nextRestroom.has_password,
        access_notes: nextRestroom.access_notes,
      },
      voice_tts_message: newVoice,
      step_instruction: newInstruction,
      ui_action: 'REROUTE',
    });

    if (autoSpeak) {
      speakKoreanTTS(newVoice);
    }
  };

  // Search by text query
  const handleSearchQuery = async (queryText: string) => {
    setLastVoicePrompt(queryText);
    playHapticChime('emergency');

    try {
      const res = await fetch('/api/flushpulse/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          urgency_level: urgencyLevel,
          user_coordinates: userLocation,
          candidate_restrooms: candidateRestrooms,
          current_action: 'SEARCH',
        }),
      });

      if (res.ok) {
        const data: FlushPulseAIResponse = await res.json();
        handleApplyAIResponse(data);
      }
    } catch {
      // Fallback: match by search query or select first
      const matched = candidateRestrooms.find((r) =>
        r.name.toLowerCase().includes(queryText.toLowerCase())
      );
      if (matched) {
        setSelectedRestroom(matched);
      }
    }
  };

  const handleOpenPreview = (r: RestroomCandidate) => {
    setSelectedRestroom(r);
    setIsIndoorModalOpen(true);
  };

  const handleChangeLocationPreset = (loc: UserCoordinates) => {
    setUserLocation(loc);
    fetchNearbyRestrooms(loc.lat, loc.lng, false);
  };

  return (
    <div className="w-full h-[100dvh] bg-[#101419] text-[#e0e2ea] flex flex-col relative overflow-hidden">
      <div className="w-full h-full flex flex-col relative bg-[#101419] overflow-hidden">
        {/* Top Fixed Header */}
        <Header
          currentTab={currentTab}
          onBack={handleExitNavigation}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenInspector={() => setIsInspectorOpen(true)}
        />

        {/* Screens */}
        {currentTab === 'radar' ? (
          <RadarScreen
            userLocation={userLocation}
            onChangeLocation={handleChangeLocationPreset}
            candidateRestrooms={
              wheelchairOnly
                ? candidateRestrooms.filter((r) => r.wheelchair_accessible)
                : candidateRestrooms
            }
            selectedRestroom={selectedRestroom}
            onSelectRestroom={(r) => setSelectedRestroom(r)}
            urgencyLevel={urgencyLevel}
            onToggleUrgency={handleToggleUrgency}
            onStartNavigation={handleStartNavigation}
            onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
            lastVoicePrompt={lastVoicePrompt}
            onSearchQuery={handleSearchQuery}
            onOpenPreview={handleOpenPreview}
            onSwitchTab={(tab) => {
              if (tab === 'nav') handleStartNavigation();
              else setCurrentTab('radar');
            }}
            onFetchGps={fetchLiveGps}
            isGpsLoading={isGpsLoading}
            gpsErrorMessage={gpsErrorMessage}
            kakaoAppKey={kakaoAppKey}
            onOpenSettings={() => setIsSettingsOpen(true)}
            isRestroomApiLoading={isRestroomApiLoading}
            apiSourceInfo={apiSourceInfo}
            onRefreshNearby={() =>
              fetchNearbyRestrooms(userLocation.lat, userLocation.lng, false)
            }
            walkRoute={walkRoute}
            isRouteLoading={isRouteLoading}
          />
        ) : (
          <LiveNavScreen
            restroom={selectedRestroom}
            stepInstruction={stepInstruction}
            voiceTtsMessage={voiceTtsMessage}
            onExitNav={handleExitNavigation}
            onReroute={handleReroute}
            onOpenIndoorWalkthrough={() => setIsIndoorModalOpen(true)}
            walkRoute={walkRoute}
          />
        )}

        {/* Conversational Voice Search Modal */}
        <VoiceAssistModal
          isOpen={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
          userLocation={userLocation}
          candidateRestrooms={candidateRestrooms}
          onApplyAIResponse={handleApplyAIResponse}
        />

        {/* Structured JSON Schema Inspector Modal */}
        <JsonInspectorModal
          isOpen={isInspectorOpen}
          onClose={() => setIsInspectorOpen(false)}
          lastAIResponse={lastAIResponse}
          apiSourceInfo={apiSourceInfo}
        />

        {/* Indoor Building Entry Walkthrough Modal */}
        <IndoorWalkthroughModal
          isOpen={isIndoorModalOpen}
          onClose={() => setIsIndoorModalOpen(false)}
          restroom={selectedRestroom}
        />

        {/* Preferences and Settings Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          autoSpeak={autoSpeak}
          onToggleAutoSpeak={() => setAutoSpeak((v) => !v)}
          wheelchairOnly={wheelchairOnly}
          onToggleWheelchairOnly={() => setWheelchairOnly((v) => !v)}
          kakaoAppKey={kakaoAppKey}
          onSaveKakaoAppKey={handleSaveKakaoAppKey}
        />
      </div>
    </div>
  );
}
