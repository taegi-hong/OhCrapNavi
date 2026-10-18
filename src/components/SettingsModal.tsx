import React, { useState } from 'react';
import { playHapticChime, speakKoreanTTS } from '../utils/speech';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
  wheelchairOnly: boolean;
  onToggleWheelchairOnly: () => void;
  kakaoAppKey: string;
  onSaveKakaoAppKey: (key: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  autoSpeak,
  onToggleAutoSpeak,
  wheelchairOnly,
  onToggleWheelchairOnly,
  kakaoAppKey,
  onSaveKakaoAppKey,
}) => {
  const [inputKey, setInputKey] = useState(kakaoAppKey);
  const [testSpeechStatus, setTestSpeechStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestTTS = () => {
    playHapticChime('nav_start');
    setTestSpeechStatus('음성 출력 중...');
    speakKoreanTTS(
      '급똥내비 음성 안내 시스템 정상 작동 중입니다. 스피커 볼륨을 확인해주세요.',
      () => setTestSpeechStatus('말하는 중 🔊'),
      () => {
        setTestSpeechStatus('출력 성공 ✅');
        setTimeout(() => setTestSpeechStatus(null), 2000);
      },
      () => {
        setTestSpeechStatus('음성 오류 (소리 권한 확인 필요) ⚠️');
      }
    );
  };

  const handleSave = () => {
    playHapticChime('click');
    onSaveKakaoAppKey(inputKey.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#1c2025] border border-[#31353b] rounded-3xl p-5 shadow-2xl flex flex-col gap-4 animate-in fade-in duration-150 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#00e5ff] text-[#00363d] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </div>
            <span className="font-['Space_Grotesk'] text-[16px] font-bold text-[#e0e2ea]">
              급똥내비 환경설정
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#262a30] text-[#849396] hover:text-white flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Public Restroom Data API Setting */}
          <div className="flex flex-col gap-2 p-3 bg-[#262a30] rounded-xl border border-[#00e5ff]/40 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff] animate-pulse" />
                <span className="text-[13px] font-bold text-[#e0e2ea]">
                  공중화장실정보 데이터 조회 API
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[#00e5ff]/20 text-[#00e5ff] text-[10px] font-bold">
                반경 1km 실시간
              </span>
            </div>

            <p className="text-[11px] text-[#849396] leading-relaxed">
              행정안전부 및 공공데이터포털(localdata.go.kr) 전국공중화장실표준데이터 실시간 연동 중입니다. 현재 내 위치 기준 반경 1,000m 내 화장실 정보가 지도와 레이더에 즉시 반영됩니다.
            </p>

            <div className="p-2 rounded-lg bg-[#101419] border border-[#31353b] flex flex-col gap-1 text-[10.5px]">
              <span className="text-[#849396]">연동 엔드포인트</span>
              <span className="text-[#00e5ff] font-['JetBrains_Mono'] break-all select-all">
                https://sample.localdata.go.kr/public/public_restroom_info/info
              </span>
            </div>
          </div>
          {/* Kakao Map JavaScript App Key */}
          <div className="flex flex-col gap-2 p-3 bg-[#262a30] rounded-xl border border-[#3b494c]/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#fee500] shadow-[0_0_8px_#fee500]" />
                <span className="text-[13px] font-bold text-[#e0e2ea]">
                  카카오맵(Kakao) 앱 키 (.env 연동)
                </span>
              </div>
              <a
                href="https://developers.kakao.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#00daf3] hover:underline flex items-center gap-0.5"
              >
                <span>발급 콘솔</span>
                <span className="material-symbols-outlined text-[12px]">open_in_new</span>
              </a>
            </div>

            <p className="text-[11px] text-[#849396] leading-relaxed">
              지도는 키 없이도 <strong>변기 마커 및 경로가 100% 정상 작동</strong>합니다. 카카오 공식 지도 SDK 타일로 전환하려면{' '}
              <code className="px-1 py-0.5 rounded bg-[#101419] text-[#00e5ff]">.env</code>의{' '}
              <strong className="text-white">VITE_KAKAO_MAP_API_KEY</strong> 또는 아래에 JavaScript 키를 등록하세요.
            </p>

            <input
              type="text"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="예: 7a8b9c... (32자리 JavaScript 키)"
              className="w-full h-10 px-3 rounded-lg bg-[#101419] border border-[#31353b] text-xs font-['JetBrains_Mono'] text-[#9cf0ff] focus:outline-none focus:border-[#fee500]"
            />

            {/* Kakao Web Domain Registration Helper */}
            <div className="p-2.5 rounded-lg bg-[#101419] border border-[#31353b]/80 flex flex-col gap-1 text-[10.5px]">
              <div className="flex items-center justify-between text-[#bac9cc]">
                <span className="font-semibold text-[#fee500]">카카오 콘솔 Web 도메인 등록 필요</span>
                <button
                  type="button"
                  onClick={() => {
                    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
                    navigator.clipboard.writeText(currentOrigin);
                    playHapticChime('click');
                  }}
                  className="px-2 py-0.5 rounded bg-[#262a30] hover:bg-[#31353b] text-[#00e5ff] text-[10px] font-bold cursor-pointer"
                >
                  도메인 복사
                </button>
              </div>
              <span className="text-[#849396] break-all font-['JetBrains_Mono']">
                {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}
              </span>
              <span className="text-[9.5px] text-[#55696d]">
                카카오 콘솔 &gt; 플랫폼 &gt; Web 플랫폼에 위 도메인을 등록해야 지도가 정상 표시됩니다.
              </span>
            </div>
          </div>

          {/* Auto speak TTS toggle & Audio test */}
          <div className="flex flex-col gap-2 p-3 bg-[#262a30] rounded-xl border border-[#3b494c]/60">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-[#e0e2ea]">AI 음성 자동 안내 (TTS)</span>
                <span className="text-[11px] text-[#849396]">화장실 탐색 시 한국어 음성 즉시 재생</span>
              </div>
              <button
                onClick={() => {
                  playHapticChime('click');
                  onToggleAutoSpeak();
                }}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-1 cursor-pointer ${
                  autoSpeak ? 'bg-[#00e5ff]' : 'bg-[#31353b]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-[#00363d] transition-transform ${
                    autoSpeak ? 'translate-x-6' : 'translate-x-0 bg-white'
                  }`}
                />
              </button>
            </div>

            {/* Test TTS Button */}
            <div className="pt-2 border-t border-[#31353b]/60 flex items-center justify-between">
              <button
                onClick={handleTestTTS}
                className="px-3 py-1.5 rounded-lg bg-[#1c2025] hover:bg-[#31353b] border border-[#3b494c] text-xs font-semibold text-[#00daf3] flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">volume_up</span>
                <span>음성 안내 사운드 테스트</span>
              </button>
              {testSpeechStatus && (
                <span className="text-[11px] font-['JetBrains_Mono'] text-[#46ffb8]">
                  {testSpeechStatus}
                </span>
              )}
            </div>
          </div>

          {/* Barrier free wheelchair priority */}
          <div className="flex items-center justify-between p-3 bg-[#262a30] rounded-xl border border-[#3b494c]/60">
            <div className="flex flex-col">
              <span className="text-[13px] font-medium text-[#e0e2ea]">배리어프리 / 휠체어 우선</span>
              <span className="text-[11px] text-[#849396]">엘리베이터 및 장애인 편의시설 필터</span>
            </div>
            <button
              onClick={() => {
                playHapticChime('click');
                onToggleWheelchairOnly();
              }}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-1 cursor-pointer ${
                wheelchairOnly ? 'bg-[#46ffb8]' : 'bg-[#31353b]'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-[#002114] transition-transform ${
                  wheelchairOnly ? 'translate-x-6' : 'translate-x-0 bg-white'
                }`}
              />
            </button>
          </div>

          {/* Model telemetry badge */}
          <div className="p-3 bg-[#101419] rounded-xl border border-[#31353b] flex flex-col gap-1 text-[11px]">
            <div className="flex items-center justify-between text-[#bac9cc]">
              <span>연동 AI 모델</span>
              <span className="font-['JetBrains_Mono'] text-[#00daf3]">gemini-3.8-flash</span>
            </div>
            <div className="flex items-center justify-between text-[#bac9cc]">
              <span>지도 엔진</span>
              <span className="font-['JetBrains_Mono'] text-[#fee500]">카카오맵 (Kakao Mobility)</span>
            </div>
            <div className="flex items-center justify-between text-[#bac9cc]">
              <span>음성 엔진</span>
              <span className="font-['JetBrains_Mono'] text-[#46ffb8]">Web Speech API (STT / TTS)</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full h-11 rounded-xl bg-[#00e5ff] text-[#00363d] font-bold text-sm cursor-pointer active:scale-95 transition-transform"
        >
          저장 및 적용
        </button>
      </div>
    </div>
  );
};
