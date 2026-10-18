import React from 'react';

interface HeaderProps {
  currentTab: 'radar' | 'nav';
  isNavigating?: boolean;
  onBack?: () => void;
  onStopNav?: () => void;
  onOpenSettings?: () => void;
  onOpenInspector?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  isNavigating = false,
  onBack,
  onStopNav,
  onOpenSettings,
  onOpenInspector,
}) => {
  const logoUrl =
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCj5FO6qHnHw7T2AmRYVvMalBSvJLXHzDQ3s6KszibhqCkFwfN6XMhSyzMrWyOer-ha1EdzB6qVKMsKm_yDf4wctSdwWMscsYjdx5zozOxrgKhVIMH3LnVHXB1qseDaRGQ_yZsel4mmGkRTaXGWoQe42ZPizzTjFj7lKKJ2PkNIuB6pYarf9mbuvSzc-s--EORMdg270f1VRKacVJ0PExJJfw844N7rjDmvNZQy7tKM3Na1Z_4CSoBA9A';

  return (
    <header className="fixed top-0 left-0 right-0 w-full z-50 bg-[#0a0e13]/85 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.4)] border-b border-[#31353b]/30">
      <div className="h-14 px-4 flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {isNavigating && (
            <button
              aria-label="안내 종료"
              onClick={onStopNav}
              className="px-2.5 py-1 rounded-full bg-[#93000a]/80 text-[#ffdad6] border border-[#ffb4ab]/40 hover:bg-[#ba1a1a] transition-colors active:scale-95 text-xs font-bold flex items-center gap-1 cursor-pointer mr-1"
            >
              <span className="material-symbols-outlined text-[15px]">close</span>
              <span className="hidden sm:inline">안내종료</span>
            </button>
          )}

          <img
            alt="FlushPulse Logo"
            className="h-8 w-auto object-contain cursor-pointer"
            src={logoUrl}
            onClick={() => onBack?.()}
          />

          <div className="flex flex-col">
            <span className="font-['JetBrains_Mono'] text-[10px] uppercase tracking-widest text-[#00daf3] leading-none">
              FLUSHPULSE AI
            </span>
            <span className="font-['Space_Grotesk'] text-[18px] font-bold text-[#e0e2ea] leading-tight mt-0.5 flex items-center gap-1.5">
              <span>급똥내비</span>
              <span className={`text-[11px] font-normal px-1.5 py-0.2 rounded ${isNavigating ? 'bg-[#00e5ff] text-[#00363d] font-bold animate-pulse' : 'bg-[#262a30] text-[#bac9cc]'}`}>
                {isNavigating ? 'LIVE NAV' : 'Radar'}
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isNavigating ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00e5ff]/20 backdrop-blur-md border border-[#00e5ff]/60">
              <span className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff] animate-pulse" />
              <span className="font-['Space_Grotesk'] text-[10.5px] text-[#00e5ff] font-bold tracking-wide">
                실시간 길안내 중
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#262a30]/80 backdrop-blur-md border border-[#31353b]/50">
              <span className="w-2 h-2 rounded-full bg-[#46ffb8] shadow-[0_0_8px_rgba(70,255,184,0.8)] animate-pulse" />
              <span className="font-['JetBrains_Mono'] text-[10px] text-[#46ffb8] font-semibold uppercase tracking-wider">
                RADAR ACTIVE
              </span>
            </div>
          )}

          {/* JSON Telemetry Inspector Trigger */}
          <button
            onClick={onOpenInspector}
            title="AI JSON 스키마 관측창"
            aria-label="JSON 스키마 관측창"
            className="w-8 h-8 rounded-full bg-[#1c2025] border border-[#3b494c] text-[#00daf3] flex items-center justify-center hover:bg-[#262a30] active:scale-95 transition-transform"
          >
            <span className="font-['JetBrains_Mono'] text-[11px] font-bold">{"{ }"}</span>
          </button>

          {/* User Profile / Settings Avatar */}
          <button
            onClick={onOpenSettings}
            title="사용자 설정"
            aria-label="사용자 설정"
            className="w-8 h-8 rounded-full bg-[#c3f5ff] flex items-center justify-center text-[#00363d] hover:bg-white active:scale-95 transition-transform shadow-[0_0_8px_rgba(195,245,255,0.4)]"
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
          </button>
        </div>
      </div>
    </header>
  );
};
