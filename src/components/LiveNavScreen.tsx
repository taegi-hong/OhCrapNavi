import React, { useState, useEffect } from 'react';
import { RestroomCandidate, WalkRouteInfo } from '../types';
import { speakKoreanTTS, stopSpeech, playHapticChime } from '../utils/speech';

interface LiveNavScreenProps {
  restroom: RestroomCandidate;
  stepInstruction: string;
  voiceTtsMessage: string;
  onExitNav: () => void;
  onReroute: () => void;
  onOpenIndoorWalkthrough: () => void;
  walkRoute?: WalkRouteInfo | null;
}

export const LiveNavScreen: React.FC<LiveNavScreenProps> = ({
  restroom,
  stepInstruction,
  voiceTtsMessage,
  onExitNav,
  onReroute,
  onOpenIndoorWalkthrough,
  walkRoute = null,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const initialDist = walkRoute ? walkRoute.distance_meters : restroom.distance_meters;
  const [distanceRemaining, setDistanceRemaining] = useState(initialDist);
  const [navStepIndex, setNavStepIndex] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (walkRoute) {
      setDistanceRemaining(walkRoute.distance_meters);
    }
  }, [walkRoute?.distance_meters]);

  const walkDist = walkRoute ? walkRoute.distance_meters : restroom.distance_meters;
  const walkTime = walkRoute ? walkRoute.walking_time_min : restroom.walking_time_min;
  const etaTextDisplay = walkRoute?.eta_text || `도보 약 ${walkTime}분`;
  const firstInstruction =
    walkRoute?.steps?.[0]?.instruction ||
    stepInstruction ||
    `“${walkDist}m 직진 후 회전문 통과, 로비 우측 복도로 진입하세요.”`;

  // Progressive navigation step cues
  const navSteps = [
    {
      distance: walkDist,
      etaText: etaTextDisplay,
      direction: 'turn_slight_right',
      turnDistance: `${Math.max(25, Math.round(walkDist * 0.7))}m`,
      instruction: firstInstruction,
      indoorText:
        restroom.access_notes || '회전문 ➜ 엘리베이터 우측 복도 끝 ➜ 첫 번째 출입문',
    },
    {
      distance: Math.max(15, Math.round(walkDist * 0.25)),
      etaText: '도보 1분 미만',
      direction: 'turn_right',
      turnDistance: '15m',
      instruction: '“회전문 통과 후 우측 1층 안내데스크 옆 복도로 진입하세요.”',
      indoorText: '엘리베이터 우측 복도 끝 ➜ 첫 번째 출입문',
    },
    {
      distance: 5,
      etaText: '도착 완료',
      direction: 'check_circle',
      turnDistance: '도착',
      instruction: '“목적지 화장실에 도착했습니다. 문을 열고 진입하세요.”',
      indoorText: '화장실 도착 · 도어락 무설정 개방 상태',
    },
  ];

  const currentStep = navSteps[navStepIndex] || navSteps[0];

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => {
      setToastMessage((prev) => (prev === text ? null : prev));
    }, 2400);
  };

  // Speak TTS on mount or when instruction changes
  useEffect(() => {
    if (!isMuted) {
      const speechText = voiceTtsMessage || currentStep.instruction.replace(/[“”]/g, '');
      speakKoreanTTS(speechText);
    }
    return () => {
      stopSpeech();
    };
  }, [navStepIndex, isMuted, voiceTtsMessage]);

  const handleSpeakerToggle = () => {
    playHapticChime('click');
    if (isMuted) {
      setIsMuted(false);
      showToast('AI 음성 가이드 작동 중 (스피커)');
      speakKoreanTTS(currentStep.instruction.replace(/[“”]/g, ''));
    } else {
      setIsMuted(true);
      stopSpeech();
      showToast('AI 음성 안내가 음소거되었습니다.');
    }
  };

  const handleReplayAudio = () => {
    playHapticChime('click');
    showToast(currentStep.instruction);
    if (!isMuted) {
      speakKoreanTTS(currentStep.instruction.replace(/[“”]/g, ''));
    }
  };

  const handleAdvanceSimulation = () => {
    playHapticChime('click');
    const nextIdx = (navStepIndex + 1) % navSteps.length;
    setNavStepIndex(nextIdx);
    setDistanceRemaining(navSteps[nextIdx].distance);
    showToast(`모의 이동: ${navSteps[nextIdx].distance}m 남음`);
  };

  return (
    <div className="flex-1 flex flex-col relative w-full pt-16 pb-12 bg-[#101419] h-[100dvh] overflow-y-auto max-w-2xl mx-auto select-none">
      <div className="flex flex-col w-full relative pb-6">
        {/* Perspective Vector Map Viewport (Cybernetic AR Navigation) */}
        <div className="relative w-full h-[380px] bg-[#0a0e13] overflow-hidden flex items-center justify-center border-b border-[#1c2025]">
          {/* Depth Radial Gradient Background */}
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#00e5ff]/20 via-[#0a0e13] to-[#0a0e13]" />

          {/* 3D Perspective Road Canvas with SVG laser track */}
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 480">
            <defs>
              {/* Laser glow filters */}
              <filter height="160%" id="laser-glow" width="160%" x="-30%" y="-30%">
                <feGaussianBlur result="blur1" stdDeviation="6" />
                <feGaussianBlur result="blur2" stdDeviation="2" />
                <feMerge>
                  <feMergeNode in="blur1" />
                  <feMergeNode in="blur2" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter height="180%" id="target-glow" width="180%" x="-40%" y="-40%">
                <feGaussianBlur result="blur" stdDeviation="8" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Gradient track */}
              <linearGradient id="beam-gradient" x1="0%" x2="0%" y1="100%" y2="0%">
                <stop offset="0%" stopColor="#00daf3" stopOpacity="1" />
                <stop offset="55%" stopColor="#00e5ff" stopOpacity="0.95" />
                <stop offset="85%" stopColor="#46ffb8" stopOpacity="1" />
                <stop offset="100%" stopColor="#ffdada" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {/* Perspective Grid Lines */}
            <line opacity="0.35" stroke="#31353b" strokeDasharray="4 6" strokeWidth="1" x1="-50" x2="160" y1="480" y2="120" />
            <line opacity="0.45" stroke="#31353b" strokeWidth="1.2" x1="80" x2="180" y1="480" y2="120" />
            <line opacity="0.3" stroke="#31353b" strokeDasharray="6 8" strokeWidth="1.5" x1="200" x2="200" y1="480" y2="120" />
            <line opacity="0.45" stroke="#31353b" strokeWidth="1.2" x1="320" x2="220" y1="480" y2="120" />
            <line opacity="0.35" stroke="#31353b" strokeDasharray="4 6" strokeWidth="1" x1="450" x2="240" y1="480" y2="120" />

            {/* Cross street vectors */}
            <line opacity="0.3" stroke="#31353b" strokeWidth="1" x1="100" x2="300" y1="360" y2="360" />
            <line opacity="0.4" stroke="#31353b" strokeWidth="1" x1="135" x2="265" y1="260" y2="260" />
            <line opacity="0.5" stroke="#31353b" strokeWidth="1" x1="160" x2="240" y1="180" y2="180" />

            {/* Glowing AR Laser Track (Route: straight then turn right into entrance) */}
            <path
              d="M 200 460 L 200 240 Q 200 210 225 200 L 290 185"
              fill="none"
              filter="url(#laser-glow)"
              opacity="0.18"
              stroke="#00daf3"
              strokeWidth="16"
            />
            <path
              d="M 200 460 L 200 240 Q 200 210 225 200 L 290 185"
              fill="none"
              filter="url(#laser-glow)"
              stroke="url(#beam-gradient)"
              strokeLinecap="round"
              strokeWidth="4.5"
            />

            {/* Animated Pulse Ring on Laser End / Target Entrance */}
            <circle
              className="animate-ping"
              cx="290"
              cy="185"
              fill="none"
              opacity="0.4"
              r="24"
              stroke="#46ffb8"
              strokeWidth="2"
              style={{ transformOrigin: '290px 185px' }}
            />
            <circle
              cx="290"
              cy="185"
              fill="#00e29e"
              fillOpacity="0.25"
              filter="url(#target-glow)"
              r="14"
              stroke="#46ffb8"
              strokeWidth="2"
            />
            <circle cx="290" cy="185" fill="#c3f5ff" r="5" />

            {/* Live User Pointer Pin (Heading arrow) */}
            <g transform="translate(200, 420)">
              <circle className="animate-pulse" cx="0" cy="0" fill="#00daf3" fillOpacity="0.2" r="18" />
              <circle cx="0" cy="0" fill="#00daf3" fillOpacity="0.4" r="10" />
              <polygon fill="#c3f5ff" points="0,-12 9,8 0,3 -9,8" />
            </g>
          </svg>

          {/* Top Telemetry Status Stream & AI Capsule Floating Anchor */}
          <div className="absolute top-3 left-3 right-3 flex flex-col gap-1.5 z-20">
            {/* Topmost Live State Tag */}
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-1.5 bg-[#31353b]/80 border border-[#3b494c]/50 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#46ffb8] animate-ping" />
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#a7ffd2] tracking-wider uppercase font-semibold">
                  GPS FIXED · 3D AR ACTIVE
                </span>
              </div>

              <button
                aria-label="음성 가이드 음소거 토글"
                onClick={handleSpeakerToggle}
                className={`flex items-center gap-1 backdrop-blur-md px-2.5 py-1 rounded-full border border-[#3b494c] active:scale-95 transition-all shadow-sm ${
                  isMuted ? 'bg-[#262a30] text-[#849396]' : 'bg-[#262a30]/90 text-[#c3f5ff]'
                }`}
                id="speaker-toggle"
              >
                <span className="material-symbols-outlined text-[15px]">
                  {isMuted ? 'volume_off' : 'volume_up'}
                </span>
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#e0e2ea] font-medium">
                  {isMuted ? '음소거됨' : '스피커 켜짐'}
                </span>
              </button>
            </div>

            {/* AI Conversational HUD Guidance Capsule */}
            <div className="w-full bg-[#262a30]/95 border border-[#3b494c]/70 backdrop-blur-xl rounded-2xl p-3 shadow-xl flex items-start gap-2.5">
              {/* Sonic Voice Orb visualizer */}
              <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-[#00e5ff]/30 blur-sm animate-pulse" />
                <div className="relative w-10 h-10 rounded-full bg-[#0a0e13] border border-[#00daf3]/50 flex items-center justify-center overflow-hidden">
                  {/* Dynamic equalizer waveform visual */}
                  <div className="flex items-center justify-center gap-[2.5px] h-5">
                    <span className="w-[3px] bg-[#00daf3] rounded-full animate-bounce h-4" style={{ animationDelay: '0.1s' }} />
                    <span className="w-[3px] bg-[#c3f5ff] rounded-full animate-bounce h-6" style={{ animationDelay: '0.3s' }} />
                    <span className="w-[3px] bg-[#46ffb8] rounded-full animate-bounce h-5" style={{ animationDelay: '0.2s' }} />
                    <span className="w-[3px] bg-[#00e5ff] rounded-full animate-bounce h-3" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              </div>

              {/* Speech Transcription & Next Turn Instruction */}
              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#00daf3] font-semibold uppercase">
                    급똥내비 AI VOICE HUD
                  </span>
                  <span className="text-[#3b494c] font-['JetBrains_Mono'] text-[10px]">|</span>
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#00e29e] font-medium">
                    신속 최단경로
                  </span>
                </div>
                <p className="font-['Space_Grotesk'] text-[16px] text-[#e0e2ea] leading-snug tracking-tight break-keep font-semibold">
                  {currentStep.instruction}
                </p>
              </div>

              {/* Next Turn Vector Glyph Badge */}
              <div className="w-12 h-12 rounded-xl bg-[#0a0e13] border border-[#31353b] flex flex-col items-center justify-center flex-shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-[#00e5ff] text-[22px]">
                  {currentStep.direction}
                </span>
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#00daf3] leading-none mt-0.5 font-bold">
                  {currentStep.turnDistance}
                </span>
              </div>
            </div>
          </div>

          {/* Spatial Holographic Labels pinned to perspective coordinates */}
          <div className="absolute top-[138px] right-4 z-10 flex flex-col items-start pointer-events-none">
            <div
              className="bg-[#31353b]/95 border border-[#46ffb8]/50 backdrop-blur-md px-2.5 py-1.5 rounded-xl shadow-lg flex items-center gap-2 animate-bounce"
              style={{ animationDuration: '2.4s' }}
            >
              <div className="w-6 h-6 rounded-full bg-[#00eda6] text-[#003824] flex items-center justify-center text-xs font-bold shadow-sm">
                🚽
              </div>
              <div className="flex flex-col">
                <span className="font-['Space_Grotesk'] text-[12px] text-[#a7ffd2] font-bold leading-none">
                  {restroom.name.includes('1층') ? '1층 화장실 입구' : `${restroom.name.split(' ')[0]} 화장실`}
                </span>
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#bac9cc] leading-tight mt-0.5">
                  개방형 · {restroom.has_password ? `도어락 (${restroom.door_code})` : '비밀번호 불필요'}
                </span>
              </div>
            </div>
            <div className="w-[2px] h-6 bg-[#00eda6]/60 ml-4" />
          </div>

          {/* Intermediate Street Waypoint Badges */}
          <div className="absolute bottom-20 left-4 pointer-events-none flex items-center gap-1.5 bg-[#181c21]/80 border border-[#31353b] backdrop-blur-sm px-2 py-0.5 rounded-full">
            <span className="material-symbols-outlined text-[13px] text-[#849396]">location_on</span>
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#bac9cc]">테헤란로 4길 방면</span>
          </div>

          <div className="absolute bottom-28 right-8 pointer-events-none flex items-center gap-1 bg-[#262a30]/80 border border-[#3b494c] px-2 py-0.5 rounded-full">
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#00daf3]">50m 지점</span>
            <span className="material-symbols-outlined text-[12px] text-[#00e5ff]">arrow_forward</span>
          </div>

          {/* Repeat Audio Replay Floating Trigger */}
          <button
            aria-label="안내 음성 다시 듣기"
            onClick={handleReplayAudio}
            className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 bg-[#31353b]/90 border border-[#3b494c] active:bg-[#36393f] backdrop-blur-md px-3 py-2 rounded-full text-[#e0e2ea] shadow-md active:scale-95 transition-transform cursor-pointer"
            id="btn-replay-audio"
          >
            <span className="material-symbols-outlined text-[18px] text-[#00e5ff]">replay</span>
            <span className="font-['Inter'] text-[12px] text-[#c3f5ff] font-medium">안내 다시 듣기</span>
          </button>
        </div>

        {/* Indoor Transition Mini-HUD (Building Entry Preview) */}
        <div className="px-4 mt-2.5 z-10">
          <button
            onClick={onOpenIndoorWalkthrough}
            className="w-full bg-[#181c21] border border-[#31353b] hover:border-[#00e5ff]/50 rounded-2xl p-3 shadow-md flex items-center gap-2.5 text-left active:scale-[0.99] transition-all cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-[#31353b] flex items-center justify-center flex-shrink-0 text-[#00e5ff]">
              <span className="material-symbols-outlined text-[20px]">meeting_room</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#46ffb8] uppercase font-semibold">
                  실내 즉시 진입 경로
                </span>
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#849396]">|</span>
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#bac9cc]">
                  {restroom.has_password ? `도어락: ${restroom.door_code}` : '도어락 해제 상태'}
                </span>
              </div>
              <p className="font-['Inter'] text-[12px] text-[#e0e2ea] truncate mt-0.5">
                {currentStep.indoorText}
              </p>
            </div>
            <span className="material-symbols-outlined text-[#849396] text-[18px]">chevron_right</span>
          </button>
        </div>

        {/* Bottom Urgency Cockpit Dashboard (Thumb-Zone Floating Command Deck) */}
        <div className="px-4 mt-3 flex flex-col gap-2.5 z-10">
          {/* Main Urgency Metrics Matrix */}
          <div className="w-full bg-[#1c2025] border border-[#31353b] rounded-2xl p-4 shadow-xl flex flex-col gap-3">
            {/* Top Row: Distance + Emergency Time Tag */}
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1">
                <span className="font-['Space_Grotesk'] text-[44px] text-[#00e5ff] leading-none tracking-tight font-bold">
                  {distanceRemaining}
                </span>
                <span className="font-['Space_Grotesk'] text-[18px] text-[#00daf3] font-bold">m</span>
                <span className="ml-2 font-['Inter'] text-[12px] text-[#bac9cc]">남은 거리</span>
              </div>

              {/* Emergency Urgency Time Pill */}
              <div className="flex items-center gap-1.5 bg-[#df0042] px-3.5 py-1.5 rounded-full shadow-md animate-pulse">
                <span className="material-symbols-outlined text-[#fff1f1] text-[16px]">timer</span>
                <span className="font-['Space_Grotesk'] text-[14px] text-[#fff1f1] font-bold leading-none">
                  {currentStep.etaText}
                </span>
              </div>
            </div>

            {/* Facility Operational Telemetry Row */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              {/* Status Verified Box */}
              <div className="bg-[#262a30] border border-[#3b494c]/60 rounded-xl p-2.5 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#00eda6] flex-shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#bac9cc]">출입 상태</span>
                  <span className="font-['Inter'] text-[12px] text-[#a7ffd2] font-semibold truncate">
                    {restroom.is_open ? '현재 전면 개방' : '운영 확인 필요'}
                  </span>
                </div>
              </div>

              {/* Barrier Free & Type Box */}
              <div className="bg-[#262a30] border border-[#3b494c]/60 rounded-xl p-2.5 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#9cf0ff]">accessible</span>
                <div className="flex flex-col min-w-0">
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#bac9cc]">편의 시설</span>
                  <span className="font-['Inter'] text-[12px] text-[#e0e2ea] font-semibold truncate">
                    {restroom.gender_separated ? '남녀분리' : '공용'} ·{' '}
                    {restroom.wheelchair_accessible ? '장애인용' : '일반'}
                  </span>
                </div>
              </div>
            </div>

            {/* Tactical Instant Action Cockpit Buttons (Thumb kinetic zone) */}
            <div className="grid grid-cols-5 gap-2 mt-1">
              {/* Primary Search Alternative (3 cols) */}
              <button
                onClick={() => {
                  playHapticChime('click');
                  onReroute();
                }}
                className="col-span-3 min-h-[52px] bg-[#31353b] hover:bg-[#36393f] active:bg-[#262a30] text-[#c3f5ff] rounded-xl px-3 flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md border border-[#3b494c] cursor-pointer"
                id="btn-re-route"
              >
                <span className="material-symbols-outlined text-[#00e5ff] text-[20px]">swap_calls</span>
                <span className="font-['Space_Grotesk'] text-[15px] text-[#c3f5ff] font-semibold">
                  다른 화장실 재검색
                </span>
              </button>

              {/* Exit Navigation (2 cols) */}
              <button
                onClick={() => {
                  playHapticChime('click');
                  onExitNav();
                }}
                className="col-span-2 min-h-[52px] bg-[#0a0e13] hover:bg-[#181c21] active:bg-[#262a30] text-[#ffb4ab] border border-[#93000a]/40 rounded-xl px-3 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                id="btn-exit-nav"
              >
                <span className="material-symbols-outlined text-[#ffb4ab] text-[20px]">close</span>
                <span className="font-['Inter'] text-[14px] text-[#ffb4ab] font-medium">안내 종료</span>
              </button>
            </div>

            {/* Kakao Navi Direct Launch & Simulation test helper */}
            <div className="flex items-center justify-between pt-2 border-t border-[#31353b]/40 text-[11px] text-[#849396]">
              <a
                href={`https://map.kakao.com/link/to/${encodeURIComponent(restroom.name)},${restroom.lat},${restroom.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#fee500] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                title="카카오맵/카카오내비 앱으로 바로 길안내"
              >
                <span className="w-2 h-2 rounded-full bg-[#fee500]" />
                <span>카카오맵으로 길안내 연동</span>
                <span className="material-symbols-outlined text-[13px]">open_in_new</span>
              </a>

              <button
                onClick={handleAdvanceSimulation}
                className="text-[#00daf3] hover:underline font-['JetBrains_Mono'] cursor-pointer flex items-center gap-1"
              >
                <span>모의 이동</span>
                <span className="material-symbols-outlined text-[13px]">fast_forward</span>
              </button>
            </div>
          </div>

          {/* Quick Feedback Micro-Toast Container */}
          <div
            className={`transition-opacity duration-300 w-full text-center py-1 ${
              toastMessage ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <span className="font-['JetBrains_Mono'] text-[12px] text-[#00daf3] bg-[#262a30]/95 border border-[#3b494c] px-3.5 py-1.5 rounded-full shadow-lg inline-block">
              {toastMessage || '실시간 최적화 경로를 재연산 중입니다...'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
