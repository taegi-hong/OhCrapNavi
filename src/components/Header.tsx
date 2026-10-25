import React from 'react';
import { UrgencyLevel } from '../types';
import { playHapticChime } from '../utils/speech';

interface HeaderProps {
  currentTab: 'radar' | 'nav';
  isNavigating?: boolean;
  onBack?: () => void;
  onStopNav?: () => void;
  onOpenSettings?: () => void;
  onOpenInspector?: () => void;
  urgencyLevel?: UrgencyLevel;
  onToggleUrgency?: () => void;
  onOpenVoiceModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  isNavigating = false,
  onBack,
  onStopNav,
  onOpenSettings,
  onOpenInspector,
  urgencyLevel = 'extreme',
  onToggleUrgency,
  onOpenVoiceModal,
}) => {
  const logoUrl =
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCj5FO6qHnHw7T2AmRYVvMalBSvJLXHzDQ3s6KszibhqCkFwfN6XMhSyzMrWyOer-ha1EdzB6qVKMsKm_yDf4wctSdwWMscsYjdx5zozOxrgKhVIMH3LnVHXB1qseDaRGQ_yZsel4mmGkRTaXGWoQe42ZPizzTjFj7lKKJ2PkNIuB6pYarf9mbuvSzc-s--EORMdg270f1VRKacVJ0PExJJfw844N7rjDmvNZQy7tKM3Na1Z_4CSoBA9A';

  const isEmergency = urgencyLevel === 'extreme' || urgencyLevel === 'high';

  return (
    <header className="fixed top-0 left-0 right-0 w-full z-50 bg-[#0a0e13]/90 backdrop-blur-xl pt-safe shadow-[0_2px_12px_rgba(0,0,0,0.5)] border-b border-[#31353b]/40">
      <div className="h-14 px-3 sm:px-4 flex items-center justify-between w-full max-w-7xl mx-auto">
        {/* Left: Logo & Brand */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isNavigating && (
            <button
              aria-label="안내 종료"
              onClick={onStopNav}
              className="px-2 py-1 rounded-full bg-[#93000a]/90 text-[#ffdad6] border border-[#ffb4ab]/40 hover:bg-[#ba1a1a] transition-colors active:scale-95 text-[11px] font-bold flex items-center gap-1 cursor-pointer mr-0.5"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
              <span className="hidden sm:inline">종료</span>
            </button>
          )}

          <img
            alt="FlushPulse Logo"
            className="h-7 w-auto object-contain cursor-pointer active:scale-95 transition-transform"
            src={logoUrl}
            onClick={() => onBack?.()}
          />

          <div className="flex flex-col">
            <span className="font-['JetBrains_Mono'] text-[9px] uppercase tracking-widest text-[#00daf3] leading-none">
              FLUSHPULSE
            </span>
            <span className="font-['Space_Grotesk'] text-[16px] sm:text-[17px] font-bold text-[#e0e2ea] leading-tight flex items-center gap-1.5">
              <span>급똥내비</span>
              <span
                className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded ${
                  isNavigating
                    ? 'bg-[#00e5ff] text-[#00363d] animate-pulse'
                    : 'bg-[#262a30] text-[#bac9cc]'
                }`}
              >
                {isNavigating ? 'LIVE NAV' : 'Radar'}
              </span>
            </span>
          </div>
        </div>

        {/* Right: Emergency Toggle, Voice Search & Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Urgent Mode Toggle Pill (Compact in Header) */}
          {onToggleUrgency && (
            <button
              onClick={() => {
                playHapticChime('emergency');
                onToggleUrgency();
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full shadow-md backdrop-blur-md active:scale-95 transition-all cursor-pointer whitespace-nowrap text-xs font-bold ${
                isEmergency
                  ? 'bg-[#df0042] text-white shadow-[0_0_12px_rgba(223,0,66,0.6)]'
                  : 'bg-[#1c2025] text-[#bac9cc] border border-[#3b494c] hover:text-white'
              }`}
              title="급똥모드 토글"
            >
              <span className={`material-symbols-outlined text-[14px] ${isEmergency ? 'animate-bounce text-yellow-300' : ''}`}>
                bolt
              </span>
              <span>{isEmergency ? '🚨 급똥 ON' : '일반모드'}</span>
            </button>
          )}

          {/* Voice Search STT Mic Button */}
          {onOpenVoiceModal && (
            <button
              onClick={() => {
                playHapticChime('click');
                onOpenVoiceModal();
              }}
              className="w-8 h-8 rounded-full bg-[#00e5ff] text-[#00363d] flex items-center justify-center shadow-[0_0_12px_rgba(0,229,255,0.6)] active:scale-90 transition-transform cursor-pointer font-bold flex-shrink-0"
              title="AI 음성 검색 (STT)"
              aria-label="AI 음성 검색"
            >
              <span className="material-symbols-outlined text-[18px]">mic</span>
            </button>
          )}

          {/* JSON Telemetry Inspector Trigger */}
          <button
            onClick={onOpenInspector}
            title="AI JSON 스키마 관측창"
            aria-label="JSON 스키마 관측창"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#1c2025] border border-[#3b494c] text-[#00daf3] flex items-center justify-center hover:bg-[#262a30] active:scale-95 transition-transform flex-shrink-0"
          >
            <span className="font-['JetBrains_Mono'] text-[10px] sm:text-[11px] font-bold">{"{ }"}</span>
          </button>

          {/* User Profile / Settings Avatar */}
          <button
            onClick={onOpenSettings}
            title="설정 및 카카오맵 키"
            aria-label="설정"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#262a30] border border-[#3b494c] text-[#c3f5ff] flex items-center justify-center hover:bg-[#31353b] active:scale-95 transition-transform flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[16px] sm:text-[18px]">settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
