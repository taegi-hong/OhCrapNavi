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
  const [showRecommendModal, setShowRecommendModal] = useState(false);
  const [recommendSortTab, setRecommendSortTab] = useState<'smart' | 'clean' | 'distance'>('smart');
  const [navStepIndex, setNavStepIndex] = useState(0);
  const [isNavMuted, setIsNavMuted] = useState(false);
  const [isCardCollapsed, setIsCardCollapsed] = useState(false);

  // Top 5 cleanest & closest restrooms calculation
  const topRecommendedRestrooms = React.useMemo(() => {
    const list = [...candidateRestrooms];
    if (recommendSortTab === 'clean') {
      return list
        .sort((a, b) => (b.cleanliness_score || 0) - (a.cleanliness_score || 0) || a.distance_meters - b.distance_meters)
        .slice(0, 5);
    } else if (recommendSortTab === 'distance') {
      return list.sort((a, b) => a.distance_meters - b.distance_meters).slice(0, 5);
    } else {
      // Smart balance: high cleanliness + close distance + open status
      return list
        .sort((a, b) => {
          const scoreA =
            (a.cleanliness_score || 4.0) * 16 -
            (a.distance_meters / 15) +
            (a.is_open ? 8 : 0) +
            (!a.has_password ? 4 : 0);
          const scoreB =
            (b.cleanliness_score || 4.0) * 16 -
            (b.distance_meters / 15) +
            (b.is_open ? 8 : 0) +
            (!b.has_password ? 4 : 0);
          return scoreB - scoreA;
        })
        .slice(0, 5);
    }
  }, [candidateRestrooms, recommendSortTab]);

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
            {/* Minimalist Integrated Location & Status Chip (Leaves 100% of the map clear) */}
            <div className="flex items-center justify-between gap-2 pointer-events-auto max-w-lg mx-auto w-full px-1">
              <div className="flex items-center gap-2 bg-[#0a0e13]/90 border border-[#31353b]/90 backdrop-blur-xl px-3 py-1.5 rounded-full shadow-lg max-w-[calc(100%-44px)]">
                {/* GPS Location & Accuracy */}
                <button
                  onClick={() => {
                    playHapticChime('click');
                    onFetchGps();
                  }}
                  className="flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform min-w-0"
                  title="GPS 갱신 (터치 시 재조회)"
                >
                  {isGpsLoading ? (
                    <span className="material-symbols-outlined text-[#00daf3] text-[15px] animate-spin">
                      sync
                    </span>
                  ) : (
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        userLocation.isLiveGps
                          ? 'bg-[#46ffb8] shadow-[0_0_8px_rgba(70,255,184,0.9)] animate-pulse'
                          : 'bg-[#00e5ff]'
                      }`}
                    />
                  )}
                  <span className="material-symbols-outlined text-[#00daf3] text-[14px] flex-shrink-0">near_me</span>
                  <span className="font-['Space_Grotesk'] text-[12px] font-bold text-[#e0e2ea] truncate max-w-[120px] sm:max-w-[200px]">
                    {userLocation.address}
                  </span>
                  <span className="font-['JetBrains_Mono'] text-[9.5px] text-[#849396] font-semibold flex-shrink-0 hidden sm:inline">
                    {userLocation.accuracy}
                  </span>
                </button>

                <span className="text-[#3b494c] flex-shrink-0">·</span>

                {/* Restroom count */}
                <span className="text-[11px] font-bold text-[#c3f5ff] flex items-center gap-1 flex-shrink-0">
                  <span className="text-[#00e5ff]">1km</span>
                  <span className="text-[#46ffb8] font-['Space_Grotesk'] font-extrabold">
                    {candidateRestrooms.length}곳
                  </span>
                </span>

                {/* Refresh API button */}
                <button
                  onClick={() => {
                    playHapticChime('click');
                    onRefreshNearby?.();
                  }}
                  disabled={isRestroomApiLoading}
                  className="w-5 h-5 rounded-full bg-[#1c2025] hover:bg-[#262a30] text-[#00daf3] flex items-center justify-center cursor-pointer active:scale-95 transition-all flex-shrink-0"
                  title="반경 1km 공중화장실 실시간 재조회"
                >
                  <span
                    className={`material-symbols-outlined text-[12px] ${
                      isRestroomApiLoading ? 'animate-spin text-[#00e5ff]' : ''
                    }`}
                  >
                    sync
                  </span>
                </button>
              </div>

              {/* Top 5 Recommended Restroom List Trigger Button */}
              <button
                onClick={() => {
                  playHapticChime('click');
                  setShowRecommendModal((prev) => !prev);
                  setShowLocationPicker(false);
                }}
                className={`h-8 px-2.5 rounded-full border backdrop-blur-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95 flex-shrink-0 ${
                  showRecommendModal
                    ? 'bg-[#00e5ff] text-[#00363d] border-white font-bold shadow-[0_0_12px_rgba(0,229,255,0.8)]'
                    : 'bg-[#0a0e13]/90 border-[#31353b]/90 text-[#00daf3] hover:text-white hover:border-[#00e5ff]/50'
                }`}
                title="가장 가깝고 깨끗한 화장실 Top 5 추천"
              >
                <span className="material-symbols-outlined text-[15px] text-[#ffc107]">star</span>
                <span className="text-[11.5px] font-['Space_Grotesk'] font-bold text-[#e0e2ea]">Top 5</span>
              </button>
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

        {/* Top 5 Closest & Cleanest Restrooms Modal */}
        {showRecommendModal && (
          <div className="max-w-md mx-auto w-full p-3.5 bg-[#1c2025]/98 backdrop-blur-2xl border border-[#31353b] rounded-2xl shadow-2xl flex flex-col gap-2.5 pointer-events-auto animate-in fade-in duration-150 max-h-[75vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#31353b]/70 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-base">✨</span>
                <span className="font-['Space_Grotesk'] text-[13.5px] font-bold text-[#e0e2ea]">
                  가장 가깝고 깨끗한 화장실 Top 5
                </span>
              </div>
              <button
                onClick={() => setShowRecommendModal(false)}
                className="w-6 h-6 rounded-md bg-[#262a30] hover:bg-[#31353b] text-[#849396] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Filter Tabs (Smart, Clean, Distance) */}
            <div className="flex items-center gap-1 bg-[#101419]/90 p-1 rounded-xl border border-[#31353b]/60">
              <button
                onClick={() => {
                  playHapticChime('click');
                  setRecommendSortTab('smart');
                }}
                className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  recommendSortTab === 'smart'
                    ? 'bg-[#00e5ff] text-[#00363d] shadow-sm'
                    : 'text-[#849396] hover:text-[#e0e2ea]'
                }`}
              >
                <span>⭐</span>
                <span>종합 추천</span>
              </button>
              <button
                onClick={() => {
                  playHapticChime('click');
                  setRecommendSortTab('clean');
                }}
                className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  recommendSortTab === 'clean'
                    ? 'bg-[#00e5ff] text-[#00363d] shadow-sm'
                    : 'text-[#849396] hover:text-[#e0e2ea]'
                }`}
              >
                <span>🧼</span>
                <span>청결 우선</span>
              </button>
              <button
                onClick={() => {
                  playHapticChime('click');
                  setRecommendSortTab('distance');
                }}
                className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  recommendSortTab === 'distance'
                    ? 'bg-[#00e5ff] text-[#00363d] shadow-sm'
                    : 'text-[#849396] hover:text-[#e0e2ea]'
                }`}
              >
                <span>⚡</span>
                <span>최단 거리</span>
              </button>
            </div>

            {/* Top 5 List */}
            <div className="flex flex-col gap-1.5 overflow-y-auto no-scrollbar max-h-[48vh] pr-0.5">
              {topRecommendedRestrooms.map((r, index) => {
                const isSelected = r.id === selectedRestroom.id;
                // Medal badges for top 3
                const rankBadges = [
                  'bg-gradient-to-r from-[#ffd700] to-[#ffaa00] text-[#3e2b00]',
                  'bg-gradient-to-r from-[#e0e2ea] to-[#b0b3b8] text-[#1c2025]',
                  'bg-gradient-to-r from-[#cd7f32] to-[#a05a2c] text-white',
                  'bg-[#262a30] text-[#849396]',
                  'bg-[#262a30] text-[#849396]',
                ];

                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      playHapticChime('click');
                      onSelectRestroom(r);
                      setShowRecommendModal(false);
                    }}
                    className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-[#00e5ff]/15 border-[#00e5ff] shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                        : 'bg-[#101419]/70 border-[#31353b]/80 hover:bg-[#262a30] hover:border-[#00daf3]/50'
                    }`}
                  >
                    {/* Left: Rank & Info */}
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {/* Rank Badge */}
                      <span
                        className={`text-[10px] font-black font-['Space_Grotesk'] w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm ${
                          rankBadges[index] || 'bg-[#262a30] text-[#849396]'
                        }`}
                      >
                        {index + 1}
                      </span>

                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-['Space_Grotesk'] text-[13.5px] font-bold text-[#e0e2ea] truncate leading-tight">
                            {r.name}
                          </h4>
                          {r.is_open && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-[#00626e]/70 text-[#c3f5ff] flex-shrink-0">
                              개방중
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-[#849396] truncate mt-0.5">
                          {r.floor_or_location_details}
                        </p>

                        <div className="flex items-center gap-2 mt-1 text-[10.5px]">
                          {/* Cleanliness score */}
                          <span className="text-[#ffc107] font-bold flex items-center gap-0.5">
                            <span>⭐</span>
                            <span>{r.cleanliness_score ? r.cleanliness_score.toFixed(1) : '4.5'}</span>
                            <span className="text-[9px] text-[#849396] ml-0.5">
                              {r.cleanliness_score >= 4.8 ? '(매우 청결)' : r.cleanliness_score >= 4.5 ? '(청결)' : ''}
                            </span>
                          </span>

                          <span className="text-[#3b494c]">·</span>

                          {/* Password info */}
                          <span className={r.has_password ? 'text-[#e0e2ea]' : 'text-[#46ffb8] font-semibold'}>
                            {r.has_password ? '🔑 비번' : '🔓 비번 없음'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Distance & Walk Time */}
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="font-['Space_Grotesk'] text-[15px] font-black text-[#00e5ff] leading-none">
                        {r.distance_meters}m
                      </span>
                      <span className="font-['Space_Grotesk'] text-[11px] font-bold text-[#46ffb8] mt-0.5">
                        도보 {r.walking_time_min}분
                      </span>
                      <span className="text-[10px] text-[#00daf3] font-bold mt-1 px-1.5 py-0.5 rounded bg-[#00daf3]/10 border border-[#00daf3]/30">
                        선택
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer Sub-action: Toggle Location preset for testing if needed */}
            <div className="pt-1 border-t border-[#31353b]/50 flex items-center justify-between text-[10px] text-[#849396]">
              <span>💡 실시간 거리 및 청결 평점 기반 순위</span>
              <button
                onClick={() => {
                  setShowLocationPicker(true);
                  setShowRecommendModal(false);
                }}
                className="hover:text-[#00daf3] underline cursor-pointer"
              >
                위치 테스트 프리셋
              </button>
            </div>
          </div>
        )}

        {/* Location Picker Modal (Kept for testing/presets) */}
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

      {/* 3. Bottom Dock Container (Restroom Carousel + Details Card stacked cleanly) */}
      <div className="absolute bottom-2 left-0 right-0 px-2.5 z-20 pointer-events-auto flex flex-col items-center gap-1 max-w-lg mx-auto">
        {/* Horizontal Restrooms Carousel within 1km (Slimmer & Compact) */}
        {!isCardCollapsed && (
          <div className="w-full flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {candidateRestrooms.map((r) => {
              const isSelected = r.id === selectedRestroom.id;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    playHapticChime('click');
                    onSelectRestroom(r);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] whitespace-nowrap backdrop-blur-xl transition-all cursor-pointer flex-shrink-0 shadow-sm ${
                    isSelected
                      ? 'bg-[#00e5ff] text-[#00363d] font-black border border-white scale-102 shadow-[0_0_8px_rgba(0,229,255,0.7)]'
                      : 'bg-[#1c2025]/90 text-[#c3cad0] border border-[#31353b] hover:bg-[#262a30]'
                  }`}
                >
                  <span>🚻</span>
                  <span className="font-['Space_Grotesk'] font-bold">{r.distance_meters}m</span>
                  <span className="truncate max-w-[90px]">{r.name}</span>
                  {r.open_hours.includes('24') && (
                    <span
                      className={`text-[8.5px] px-1 rounded ${
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
        )}

        {/* Bottom Clean Toilet Card (Ultra-Compact, Essential Info Only) */}
        <div className="w-full rounded-2xl bg-[#1c2025]/95 border border-[#31353b] backdrop-blur-2xl px-3 py-2 sm:px-3.5 sm:py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.75)] flex flex-col gap-1.5 transition-all">
          {isCardCollapsed ? (
            /* Minimized Bar: Maximum Map Visibility (~40px) */
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  playHapticChime('click');
                  setIsCardCollapsed(false);
                }}
                className="flex items-center gap-2 min-w-0 text-left flex-1 cursor-pointer"
              >
                <span className="text-sm">🚻</span>
                <span className="font-['Space_Grotesk'] text-[13.5px] font-bold text-[#e0e2ea] truncate">
                  {selectedRestroom.name}
                </span>
                <span className="font-['Space_Grotesk'] text-[12px] font-extrabold text-[#00e5ff] flex-shrink-0">
                  {walkDist}m ({walkTime}분)
                </span>
              </button>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => {
                    playHapticChime('nav_start');
                    onStartNavigation();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#00e5ff] to-[#00b4d8] text-[#00363d] font-['Space_Grotesk'] text-[12px] font-black flex items-center gap-1 shadow-md active:scale-95 transition-transform cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">navigation</span>
                  <span>안내</span>
                </button>
                <button
                  onClick={() => {
                    playHapticChime('click');
                    setIsCardCollapsed(false);
                  }}
                  className="w-7 h-7 rounded-lg bg-[#262a30] hover:bg-[#31353b] text-[#849396] hover:text-[#e0e2ea] flex items-center justify-center cursor-pointer transition-colors"
                  title="카드 펼치기"
                >
                  <span className="material-symbols-outlined text-[18px]">expand_less</span>
                </button>
              </div>
            </div>
          ) : (
            /* Expanded Compact Card: Clean, High-information density, Low vertical footprint */
            <>
              {/* Row 1: Header (Title, Distance/ETA, and Collapse Toggle) */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="font-['Space_Grotesk'] text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-[#00626e]/80 text-[#c3f5ff] flex-shrink-0">
                    {selectedRestroom.is_open ? '개방중' : '확인'}
                  </span>
                  <h2 className="font-['Space_Grotesk'] text-[15px] sm:text-[16px] font-bold text-[#e0e2ea] truncate leading-tight">
                    {selectedRestroom.name}
                  </h2>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-baseline gap-1">
                    <span className="font-['Space_Grotesk'] text-[18px] font-black text-[#00e5ff] leading-none">
                      {walkDist}
                    </span>
                    <span className="font-['Space_Grotesk'] text-[11px] font-bold text-[#00daf3]">m</span>
                    <span className="text-[11px] text-[#46ffb8] font-bold font-['Space_Grotesk'] ml-0.5">
                      약 {walkTime}분
                    </span>
                  </div>
                  {/* Minimize Card Button */}
                  <button
                    onClick={() => {
                      playHapticChime('click');
                      setIsCardCollapsed(true);
                    }}
                    className="w-6 h-6 rounded-md bg-[#262a30]/80 hover:bg-[#31353b] text-[#849396] hover:text-[#e0e2ea] flex items-center justify-center cursor-pointer transition-colors"
                    title="지도 더 넓게 보기 (접기)"
                  >
                    <span className="material-symbols-outlined text-[18px]">expand_more</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Location details, Password, Audio/Detail icons in a single slim line */}
              <div className="flex items-center justify-between text-[11px] text-[#849396] min-w-0 gap-1.5 border-t border-[#31353b]/50 pt-1">
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <span className="text-[#c3cad0] truncate font-medium max-w-[130px] sm:max-w-[200px]">
                    {selectedRestroom.floor_or_location_details || '상세 위치 확인 필요'}
                  </span>
                  <span className="text-[#3b494c]">·</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="material-symbols-outlined text-[13px] text-[#00daf3]">
                      {selectedRestroom.has_password ? 'key' : 'lock_open'}
                    </span>
                    <span className={selectedRestroom.has_password ? 'text-[#ffc107] font-semibold' : 'text-[#46ffb8] font-semibold'}>
                      {selectedRestroom.has_password
                        ? `${selectedRestroom.door_code || '영수증 하단'}`
                        : '비번 없음'}
                    </span>
                    {selectedRestroom.has_password && selectedRestroom.door_code && (
                      <button
                        onClick={handleCopyDoorCode}
                        className="text-[9.5px] px-1 py-0.2 rounded bg-[#262a30] text-[#00daf3] hover:bg-[#31353b] cursor-pointer"
                      >
                        {copiedCode ? '복사됨' : '복사'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={handleSpeakGuidance}
                    className="p-1 rounded hover:bg-[#262a30] text-[#00e5ff] cursor-pointer transition-colors"
                    title="음성 안내 듣기"
                  >
                    <span className="material-symbols-outlined text-[15px]">volume_up</span>
                  </button>
                  <button
                    onClick={() => onOpenPreview(selectedRestroom)}
                    className="p-1 rounded hover:bg-[#262a30] text-[#849396] hover:text-[#e0e2ea] cursor-pointer transition-colors"
                    title="건물 내부 진입 상세 보기"
                  >
                    <span className="material-symbols-outlined text-[15px]">info</span>
                  </button>
                </div>
              </div>

              {/* Row 3: Action Buttons (Compact height: h-10) */}
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  onClick={() => {
                    playHapticChime('nav_start');
                    onStartNavigation();
                  }}
                  className="flex-1 h-10 rounded-xl bg-gradient-to-r from-[#00e5ff] to-[#00b4d8] text-[#00363d] font-['Space_Grotesk'] text-[14px] font-black flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,229,255,0.5)] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">navigation</span>
                  <span>급똥내비 길안내 시작</span>
                </button>

                <a
                  href={kakaoDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 px-3.5 rounded-xl bg-[#fee500] hover:bg-[#fedd00] text-[#191919] font-['Space_Grotesk'] text-[12.5px] font-bold flex items-center justify-center gap-1 shadow-md active:scale-95 transition-transform cursor-pointer flex-shrink-0"
                  title="카카오맵/카카오내비 앱에서 길찾기 열기"
                >
                  <span className="font-black text-[14px]">K</span>
                  <span>길찾기</span>
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
