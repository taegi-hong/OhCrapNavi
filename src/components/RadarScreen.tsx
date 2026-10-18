import React, { useState, useEffect } from 'react';
import { RestroomCandidate, UserCoordinates, UrgencyLevel, WalkRouteInfo } from '../types';
import { playHapticChime, speakKoreanTTS, stopSpeech } from '../utils/speech';
import { KakaoMapView } from './KakaoMapView';
import { ALTERNATIVE_LOCATIONS } from '../data/mockRestrooms';
import { formatCoordinates } from '../utils/geolocation';

interface RadarScreenProps {
  userLocation: UserCoordinates;
  onChangeLocation: (loc: UserCoordinates) => void;
  candidateRestrooms: RestroomCandidate[];
  selectedRestroom: RestroomCandidate;
  onSelectRestroom: (r: RestroomCandidate) => void;
  urgencyLevel: UrgencyLevel;
  onToggleUrgency: () => void;
  onStartNavigation: () => void;
  onStopNavigation?: () => void;
  isNavigating?: boolean;
  stepInstruction?: string;
  voiceTtsMessage?: string;
  onOpenVoiceModal: () => void;
  lastVoicePrompt: string;
  onSearchQuery: (query: string) => void;
  onOpenPreview: (r: RestroomCandidate) => void;
  onSwitchTab: (tab: 'radar' | 'nav') => void;
  onFetchGps: () => void;
  isGpsLoading: boolean;
  gpsErrorMessage: string | null;
  kakaoAppKey?: string;
  onOpenSettings?: () => void;
  isRestroomApiLoading?: boolean;
  apiSourceInfo?: {
    endpoint: string;
    status: string;
    total: number;
    timestamp: number;
  };
  onRefreshNearby?: () => void;
  walkRoute?: WalkRouteInfo | null;
  isRouteLoading?: boolean;
}

export const RadarScreen: React.FC<RadarScreenProps> = ({
  userLocation,
  onChangeLocation,
  candidateRestrooms,
  selectedRestroom,
  onSelectRestroom,
  urgencyLevel,
  onToggleUrgency,
  onStartNavigation,
  onStopNavigation,
  isNavigating = false,
  stepInstruction = '',
  voiceTtsMessage = '',
  onOpenVoiceModal,
  onOpenPreview,
  onFetchGps,
  isGpsLoading,
  gpsErrorMessage,
  kakaoAppKey,
  onOpenSettings,
  isRestroomApiLoading,
  apiSourceInfo,
  onRefreshNearby,
  walkRoute = null,
  isRouteLoading = false,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [navStepIndex, setNavStepIndex] = useState(0);
  const [isNavMuted, setIsNavMuted] = useState(false);

  // Real pedestrian distance and walking time
  const walkDist = walkRoute ? walkRoute.distance_meters : selectedRestroom.distance_meters;
  const walkTime = walkRoute ? walkRoute.walking_time_min : selectedRestroom.walking_time_min;
  const etaTextDisplay = walkRoute?.eta_text || `도보 약 ${walkTime}분`;
  const firstInstruction =
    walkRoute?.steps?.[0]?.instruction ||
    stepInstruction ||
    `${selectedRestroom.name} 방면으로 직진 후 건물로 진입하세요.`;

  // Dynamic turn-by-turn guidance steps for the selected restroom
  const navSteps = [
    {
      distance: walkDist,
      etaText: etaTextDisplay,
      direction: 'arrow_upward',
      turnDistance: `${Math.max(25, Math.round(walkDist * 0.7))}m 직진`,
      instruction: firstInstruction,
      indoorText:
        selectedRestroom.access_notes || '건물 진입 후 로비 안내데스크 복도 방면',
    },
    {
      distance: Math.max(15, Math.round(walkDist * 0.25)),
      etaText: '도보 1분 미만',
      direction: 'turn_right',
      turnDistance: '15m 우회전',
      instruction:
        selectedRestroom.indoor_steps?.[1] ||
        `${selectedRestroom.floor_or_location_details}로 진입하세요.`,
      indoorText:
        selectedRestroom.indoor_steps?.[2] || '개방 화장실 출입문 확인 후 진입',
    },
    {
      distance: 0,
      etaText: '도착 완료',
      direction: 'check_circle',
      turnDistance: '목적지 도착',
      instruction: `목적지 ${selectedRestroom.name}에 도착했습니다. 문을 열고 진입하세요.`,
      indoorText: `비밀번호: ${selectedRestroom.has_password ? selectedRestroom.door_code || '영수증 확인' : 'FREE (없음)'}`,
    },
  ];

  const currentStep = navSteps[navStepIndex] || navSteps[0];

  // Reset navigation step when starting new navigation
  useEffect(() => {
    if (isNavigating) {
      setNavStepIndex(0);
    }
  }, [isNavigating, selectedRestroom.id]);

  const handleAdvanceStep = () => {
    playHapticChime('click');
    const nextIdx = (navStepIndex + 1) % navSteps.length;
    setNavStepIndex(nextIdx);
    if (!isNavMuted) {
      speakKoreanTTS(navSteps[nextIdx].instruction);
    }
  };

  const handleReplayTTS = () => {
    playHapticChime('click');
    speakKoreanTTS(currentStep.instruction);
  };

  const handleToggleMute = () => {
    playHapticChime('click');
    if (isNavMuted) {
      setIsNavMuted(false);
      speakKoreanTTS(currentStep.instruction);
    } else {
      setIsNavMuted(true);
      stopSpeech();
    }
  };

  const isEmergency = urgencyLevel === 'extreme' || urgencyLevel === 'high';

  const handleCopyDoorCode = () => {
    playHapticChime('click');
    setCopiedCode(true);
    if (navigator.clipboard && selectedRestroom.door_code) {
      navigator.clipboard.writeText(selectedRestroom.door_code).catch(() => {});
    }
    setTimeout(() => {
      setCopiedCode(false);
    }, 1800);
  };

  const handleSpeakGuidance = () => {
    playHapticChime('click');
    const etaMention = walkRoute?.eta_time_string ? `, ${walkRoute.eta_time_string} 도착 예정` : '';
    speakKoreanTTS(
      `${selectedRestroom.name}까지 실제 인도 보행 거리는 ${walkDist}미터, 도보 약 ${walkTime}분 소요되며${etaMention}입니다. ${selectedRestroom.access_notes}`
    );
  };

  const kakaoDirectionsUrl = `https://map.kakao.com/link/to/${encodeURIComponent(
    selectedRestroom.name
  )},${selectedRestroom.lat},${selectedRestroom.lng}`;

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden select-none bg-[#101419]">
      {/* 1. Full-Bleed Map Canvas (Filling the entire screen) */}
      <div className="absolute inset-0 w-full h-full z-0">
        <KakaoMapView
          userLocation={userLocation}
          candidateRestrooms={candidateRestrooms}
          selectedRestroom={selectedRestroom}
          onSelectRestroom={onSelectRestroom}
          kakaoAppKey={kakaoAppKey}
          onOpenSettings={onOpenSettings}
          onStartNavigation={onStartNavigation}
          isNavigating={isNavigating}
          walkRoute={walkRoute}
          isRouteLoading={isRouteLoading}
        />
      </div>

      {/* 2. Top Floating HUD: Shows Turn-By-Turn Navigation or Search Status */}
      <div className="absolute top-16 left-0 right-0 px-3 z-20 flex flex-col gap-2 pointer-events-none">
        {isNavigating ? (
          /* Live Turn-by-Turn Navigation Bar right on visible screen */
          <div className="max-w-xl mx-auto w-full pointer-events-auto animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="bg-[#0a0e13]/95 border-2 border-[#00e5ff] rounded-2xl p-3 backdrop-blur-2xl shadow-[0_10px_35px_rgba(0,229,255,0.4)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00e5ff] to-[#00b4d8] text-[#00363d] flex items-center justify-center flex-shrink-0 shadow-lg">
                  <span className="material-symbols-outlined text-[30px] font-black">
                    {currentStep.direction}
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-['Space_Grotesk'] text-[15px] font-black text-[#00e5ff]">
                      {currentStep.turnDistance}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00e5ff]/20 text-[#46ffb8] font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[11px]">schedule</span>
                      {currentStep.etaText}
                    </span>
                  </div>
                  <p className="font-['Space_Grotesk'] text-[13.5px] font-bold text-white truncate leading-tight mt-0.5">
                    {currentStep.instruction}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={handleAdvanceStep}
                  className="px-2.5 py-1.5 rounded-xl bg-[#262a30] hover:bg-[#31353b] text-[#46ffb8] text-[11px] font-bold flex items-center gap-1 border border-[#3b494c] active:scale-95 transition-all cursor-pointer shadow-md"
                  title="모의 이동 (다음 단계 시뮬레이션)"
                >
                  <span className="material-symbols-outlined text-[15px]">directions_walk</span>
                  <span className="hidden sm:inline">모의이동</span>
                </button>
                <button
                  onClick={handleReplayTTS}
                  className="w-8 h-8 rounded-xl bg-[#1c2025] hover:bg-[#262a30] text-[#00e5ff] flex items-center justify-center border border-[#31353b] active:scale-95 transition-all cursor-pointer"
                  title="음성 안내 다시 듣기"
                >
                  <span className="material-symbols-outlined text-[17px]">volume_up</span>
                </button>
                <button
                  onClick={handleToggleMute}
                  className="w-8 h-8 rounded-xl bg-[#1c2025] hover:bg-[#262a30] text-[#849396] hover:text-white flex items-center justify-center border border-[#31353b] active:scale-95 transition-all cursor-pointer"
                  title={isNavMuted ? '음소거 해제' : '음소거'}
                >
                  <span className="material-symbols-outlined text-[17px]">
                    {isNavMuted ? 'volume_off' : 'volume_up'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Normal HUD when exploring map */
          <>
            <div className="flex items-center justify-between gap-2 pointer-events-auto max-w-4xl mx-auto w-full">
              {/* GPS Info Badge */}
              <div className="flex items-center gap-1.5 bg-[#0a0e13]/90 border border-[#31353b] backdrop-blur-xl px-3 py-1.5 rounded-full shadow-2xl">
                <button
                  onClick={() => {
                    playHapticChime('click');
                    onFetchGps();
                  }}
                  className="flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                  title="GPS 갱신 (터치 시 재조회)"
                >
                  {isGpsLoading ? (
                    <span className="material-symbols-outlined text-[#00daf3] text-[16px] animate-spin">
                      sync
                    </span>
                  ) : (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        userLocation.isLiveGps
                          ? 'bg-[#46ffb8] shadow-[0_0_8px_rgba(70,255,184,0.9)] animate-pulse'
                          : 'bg-[#00e5ff]'
                      }`}
                    />
                  )}
                  <span className="material-symbols-outlined text-[#00daf3] text-[15px]">near_me</span>
                  <span className="font-['Space_Grotesk'] text-[12px] font-bold text-[#e0e2ea] truncate max-w-[140px] sm:max-w-[220px]">
                    {userLocation.address}
                  </span>
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#46ffb8] font-semibold hidden sm:inline">
                    {formatCoordinates(userLocation.lat, userLocation.lng)}
                  </span>
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#849396] font-semibold">
                    {userLocation.accuracy}
                  </span>
                </button>

                {/* Location Switcher Trigger */}
                <button
                  onClick={() => setShowLocationPicker((prev) => !prev)}
                  className="ml-1 w-6 h-6 rounded-full bg-[#1c2025] hover:bg-[#262a30] text-[#849396] hover:text-[#00daf3] flex items-center justify-center transition-colors cursor-pointer"
                  title="위치 프리셋 변경"
                >
                  <span className="material-symbols-outlined text-[14px]">tune</span>
                </button>
              </div>

              {/* Right Action Group: Emergency Toggle & Voice STT Mic */}
              <div className="flex items-center gap-2">
                {/* Urgent Mode Toggle */}
                <button
                  onClick={() => {
                    playHapticChime('emergency');
                    onToggleUrgency();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-2xl backdrop-blur-xl active:scale-95 transition-all duration-200 cursor-pointer ${
                    isEmergency
                      ? 'bg-[#df0042] text-[#fff1f1] shadow-[0_0_16px_rgba(223,0,66,0.6)]'
                      : 'bg-[#1c2025]/90 text-[#e0e2ea] border border-[#3b494c]'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[15px] ${isEmergency ? 'animate-bounce' : ''}`}>
                    {isEmergency ? 'bolt' : 'tune'}
                  </span>
                  <span className="font-['Space_Grotesk'] text-[11px] font-bold tracking-tight">
                    {isEmergency ? '🚨 급똥모드 ON' : '일반모드'}
                  </span>
                </button>

                {/* Voice STT Microphone Button */}
                <button
                  onClick={() => {
                    playHapticChime('click');
                    onOpenVoiceModal();
                  }}
                  className="w-9 h-9 rounded-full bg-[#00e5ff] text-[#00363d] flex items-center justify-center shadow-[0_0_16px_rgba(0,229,255,0.7)] active:scale-90 transition-transform cursor-pointer font-bold"
                  title="AI 음성 검색 (STT)"
                  aria-label="AI 음성 검색"
                >
                  <span className="material-symbols-outlined text-[19px]">mic</span>
                </button>
              </div>
            </div>

            {/* Real-time Public Restroom 1km API Status Badge */}
            <div className="flex items-center justify-between gap-2 pointer-events-auto max-w-4xl mx-auto w-full">
              <div className="flex items-center gap-2 bg-[#0a0e13]/90 border border-[#00e5ff]/40 backdrop-blur-xl px-3 py-1 rounded-full shadow-2xl">
                <span className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff] animate-pulse" />
                <span className="text-[11px] font-bold text-[#c3f5ff] flex items-center gap-1.5">
                  <span className="text-[#00e5ff]">공중화장실 API</span>
                  <span className="text-[#849396]">·</span>
                  <span className="text-[#46ffb8]">반경 1km</span>
                  <span className="text-[#e0e2ea] font-['Space_Grotesk'] font-extrabold">
                    ({candidateRestrooms.length}곳 실시간)
                  </span>
                </span>
                <button
                  onClick={() => {
                    playHapticChime('click');
                    onRefreshNearby?.();
                  }}
                  disabled={isRestroomApiLoading}
                  className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1c2025] hover:bg-[#262a30] text-[#00daf3] hover:text-white text-[10px] font-semibold border border-[#31353b] cursor-pointer active:scale-95 transition-all"
                  title="반경 1km 공중화장실 실시간 재조회"
                >
                  <span
                    className={`material-symbols-outlined text-[13px] ${
                      isRestroomApiLoading ? 'animate-spin text-[#00e5ff]' : ''
                    }`}
                  >
                    sync
                  </span>
                  <span>{isRestroomApiLoading ? '조회 중' : '재조회'}</span>
                </button>
              </div>
            </div>

            {/* GPS Error notice banner if any */}
            {gpsErrorMessage && (
              <div className="max-w-md mx-auto w-full px-3 py-1.5 bg-[#93000a]/90 backdrop-blur-md border border-[#df0042]/50 rounded-xl flex items-center justify-between text-[11px] text-[#ffdad6] pointer-events-auto shadow-xl">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-[#ffb4ab]">warning</span>
                  <span className="truncate">{gpsErrorMessage}</span>
                </div>
                <button
                  onClick={onFetchGps}
                  className="underline font-bold text-[#c3f5ff] ml-2 flex-shrink-0 cursor-pointer"
                >
                  재시도
                </button>
              </div>
            )}
          </>
        )}

        {/* Location Picker Modal */}
        {showLocationPicker && (
          <div className="max-w-md mx-auto w-full p-3.5 bg-[#1c2025]/95 backdrop-blur-2xl border border-[#31353b] rounded-2xl shadow-2xl flex flex-col gap-2 pointer-events-auto animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-[11px] text-[#00daf3] font-['Space_Grotesk'] font-bold uppercase">
              <span>위치 선택 (테스트 및 프리셋)</span>
              <button
                onClick={() => setShowLocationPicker(false)}
                className="text-[#849396] hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => {
                  onFetchGps();
                  setShowLocationPicker(false);
                }}
                className="text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between bg-[#00e5ff]/20 text-[#c3f5ff] font-bold border border-[#00e5ff]/40 cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#00e5ff]">my_location</span>
                  <span>실시간 내 기기 GPS 가져오기</span>
                </div>
                <span className="font-['Space_Grotesk'] text-[10px] text-[#46ffb8]">정확도 높음</span>
              </button>

              {ALTERNATIVE_LOCATIONS.map((loc) => (
                <button
                  key={loc.address}
                  onClick={() => {
                    onChangeLocation(loc);
                    setShowLocationPicker(false);
                  }}
                  className={`text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    userLocation.address === loc.address
                      ? 'bg-[#00daf3]/20 text-[#c3f5ff] font-medium border border-[#00daf3]/40'
                      : 'bg-[#262a30] text-[#e0e2ea] hover:bg-[#31353b]'
                  }`}
                >
                  <span>{loc.address}</span>
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#46ffb8]">{loc.accuracy}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2.5 Horizontal Restrooms Carousel within 1km */}
      <div className="absolute bottom-[208px] sm:bottom-[198px] left-0 right-0 px-3 z-20 pointer-events-auto flex justify-center">
        <div className="w-full max-w-lg flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {candidateRestrooms.map((r) => {
            const isSelected = r.id === selectedRestroom.id;
            return (
              <button
                key={r.id}
                onClick={() => {
                  playHapticChime('click');
                  onSelectRestroom(r);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap backdrop-blur-xl transition-all cursor-pointer flex-shrink-0 shadow-lg ${
                  isSelected
                    ? 'bg-[#00e5ff] text-[#00363d] font-black border border-white scale-105 shadow-[0_0_12px_rgba(0,229,255,0.7)]'
                    : 'bg-[#1c2025]/90 text-[#e0e2ea] border border-[#31353b] hover:bg-[#262a30]'
                }`}
              >
                <span>🚻</span>
                <span className="font-['Space_Grotesk'] font-bold">{r.distance_meters}m</span>
                <span className="truncate max-w-[110px]">{r.name}</span>
                {r.open_hours.includes('24') && (
                  <span
                    className={`text-[9px] px-1 rounded ${
                      isSelected
                        ? 'bg-[#00363d] text-[#00e5ff]'
                        : 'bg-[#00e5ff]/20 text-[#00e5ff]'
                    }`}
                  >
                    24h
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Bottom Clean Toilet Card (Simple, Direct, Action-Oriented) */}
      <div className="absolute bottom-4 left-0 right-0 px-3 z-20 pointer-events-auto flex justify-center">
        <div className="w-full max-w-lg rounded-2xl bg-[#1c2025]/95 border border-[#31353b] backdrop-blur-2xl p-4 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col gap-3">
          {/* Main Info Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-['Space_Grotesk'] text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00626e] text-[#c3f5ff]">
                  {selectedRestroom.is_open ? '✅ 개방 중' : '시간 확인 필요'}
                </span>
                <span className="font-['Space_Grotesk'] text-[10px] font-semibold text-[#849396]">
                  {selectedRestroom.open_hours}
                </span>
              </div>
              <h2 className="font-['Space_Grotesk'] text-[18px] font-bold text-[#e0e2ea] truncate leading-tight">
                {selectedRestroom.name}
              </h2>
              <p className="font-['Inter'] text-[12px] text-[#849396] truncate mt-0.5">
                {selectedRestroom.floor_or_location_details}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="px-1.5 py-0.5 rounded bg-[#46ffb8]/20 text-[#46ffb8] text-[10px] font-bold flex items-center gap-1 border border-[#46ffb8]/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#46ffb8] animate-pulse" />
                  실제 인도(보행로) 기준
                </span>
                {isRouteLoading && (
                  <span className="text-[10px] text-[#849396] flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00daf3]" />
                    경로 계산 중...
                  </span>
                )}
              </div>
            </div>

            {/* Distance & Time Badge */}
            <div className="flex flex-col items-end flex-shrink-0">
              <div className="flex items-baseline gap-1">
                <span className="font-['Space_Grotesk'] text-[24px] font-black text-[#00e5ff] leading-none">
                  {walkDist}
                </span>
                <span className="font-['Space_Grotesk'] text-[12px] font-bold text-[#00daf3]">m</span>
              </div>
              <span className="font-['Space_Grotesk'] text-[12px] font-bold text-[#46ffb8]">
                도보 약 {walkTime}분
              </span>
              <div className="mt-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00e5ff]/15 border border-[#00e5ff]/40 text-[#c3f5ff] text-[10.5px] font-bold font-['Space_Grotesk'] shadow-sm">
                <span className="material-symbols-outlined text-[12px] text-[#00e5ff]">schedule</span>
                <span>{walkRoute ? walkRoute.eta_text : '도착시간 계산 중...'}</span>
              </div>
            </div>
          </div>

          {/* Details Row: Door code & Amenities */}
          <div className="flex items-center justify-between text-[11px] bg-[#101419]/80 px-3 py-2 rounded-xl border border-[#31353b]">
            <div className="flex items-center gap-1 text-[#e0e2ea]">
              <span className="material-symbols-outlined text-[15px] text-[#00daf3]">
                {selectedRestroom.has_password ? 'key' : 'lock_open'}
              </span>
              <span>
                {selectedRestroom.has_password
                  ? `비밀번호: ${selectedRestroom.door_code || '영수증 하단'}`
                  : '비밀번호 없음 (즉시 진입)'}
              </span>
              {selectedRestroom.has_password && selectedRestroom.door_code && (
                <button
                  onClick={handleCopyDoorCode}
                  className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-[#262a30] text-[#00daf3] hover:bg-[#31353b] cursor-pointer"
                >
                  {copiedCode ? '복사됨!' : '복사'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSpeakGuidance}
                className="flex items-center gap-1 text-[#00e5ff] hover:text-[#c3f5ff] cursor-pointer"
                title="음성으로 길안내 듣기 (TTS)"
              >
                <span className="material-symbols-outlined text-[16px]">volume_up</span>
                <span className="text-[11px] font-bold">음성듣기</span>
              </button>
              <button
                onClick={() => onOpenPreview(selectedRestroom)}
                className="flex items-center gap-1 text-[#849396] hover:text-[#e0e2ea] cursor-pointer"
                title="건물 내부 진입 상세 보기"
              >
                <span className="material-symbols-outlined text-[16px]">info</span>
                <span>상세</span>
              </button>
            </div>
          </div>

          {/* Action Buttons: 1. 길안내 시작, 2. 카카오맵 길찾기 */}
          <div className="flex items-center gap-2">
            {/* Primary Action Button: 길안내 시작 */}
            <button
              onClick={() => {
                playHapticChime('nav_start');
                onStartNavigation();
              }}
              className="flex-1 h-12 rounded-xl bg-gradient-to-r from-[#00e5ff] to-[#00b4d8] text-[#00363d] font-['Space_Grotesk'] text-[15px] font-black flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.6)] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">navigation</span>
              <span>급똥내비 길안내 시작</span>
            </button>

            {/* Kakao Mobility Directions Direct Button */}
            <a
              href={kakaoDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-12 px-4 rounded-xl bg-[#fee500] hover:bg-[#fedd00] text-[#191919] font-['Space_Grotesk'] text-[13px] font-bold flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-transform cursor-pointer flex-shrink-0"
              title="카카오맵/카카오내비 앱에서 길찾기 열기"
            >
              <span className="font-black text-[15px]">K</span>
              <span className="hidden sm:inline">카카오 길찾기</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
