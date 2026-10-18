import React, { useState } from 'react';
import { RestroomCandidate } from '../types';
import { playHapticChime } from '../utils/speech';

interface IndoorWalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
  restroom: RestroomCandidate;
}

export const IndoorWalkthroughModal: React.FC<IndoorWalkthroughModalProps> = ({
  isOpen,
  onClose,
  restroom,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    playHapticChime('click');
    if (navigator.clipboard && restroom.door_code) {
      navigator.clipboard.writeText(restroom.door_code).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#1c2025] border border-[#31353b] rounded-3xl p-5 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#262a30] text-[#00e5ff] flex items-center justify-center border border-[#3b494c]">
              <span className="material-symbols-outlined text-[20px]">meeting_room</span>
            </div>
            <div className="flex flex-col">
              <span className="font-['JetBrains_Mono'] text-[10px] text-[#46ffb8] uppercase font-bold">
                실내 즉시 진입 경로 가이드
              </span>
              <span className="font-['Space_Grotesk'] text-[16px] text-[#e0e2ea] font-bold">
                {restroom.name}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#262a30] text-[#849396] hover:text-[#e0e2ea] flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Door code hero banner */}
        <div className="p-3.5 bg-[#101419] border border-[#31353b] rounded-2xl flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#849396] uppercase">
              출입문 보안 / 도어락
            </span>
            <span className="font-['JetBrains_Mono'] text-[20px] text-[#46ffb8] font-extrabold">
              {restroom.door_code}
            </span>
            <span className="text-[11px] text-[#bac9cc]">
              {restroom.has_password ? '비밀번호 입력 후 # 키 누름' : '도어락 무설정 (자유 출입)'}
            </span>
          </div>

          <button
            onClick={handleCopyCode}
            className="px-3 py-2 rounded-xl bg-[#262a30] hover:bg-[#31353b] border border-[#3b494c] text-[12px] font-['Space_Grotesk'] text-[#00e5ff] font-bold flex items-center gap-1 active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-[16px]">
              {copied ? 'check' : 'content_copy'}
            </span>
            <span>{copied ? '복사됨' : '비번 복사'}</span>
          </button>
        </div>

        {/* Step-by-step entry instructions */}
        <div className="flex flex-col gap-2">
          <span className="font-['JetBrains_Mono'] text-[11px] text-[#00daf3] uppercase font-semibold">
            단계별 로비 ➜ 화장실 진입 동선
          </span>

          <div className="flex flex-col gap-2.5">
            {restroom.indoor_steps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 bg-[#262a30] rounded-xl border border-[#3b494c]/50"
              >
                <div className="w-6 h-6 rounded-full bg-[#00e5ff] text-[#00363d] flex items-center justify-center font-['JetBrains_Mono'] font-bold text-xs flex-shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div className="flex-1 text-[13px] text-[#e0e2ea] leading-snug">
                  {step}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Facility checklist */}
        <div className="p-3 bg-[#101419] rounded-xl border border-[#31353b] grid grid-cols-2 gap-2 text-[12px]">
          <div className="flex items-center gap-1.5 text-[#bac9cc]">
            <span className="material-symbols-outlined text-[16px] text-[#46ffb8]">check_circle</span>
            <span>남녀 분리: {restroom.gender_separated ? '분리형' : '공용'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#bac9cc]">
            <span className="material-symbols-outlined text-[16px] text-[#46ffb8]">check_circle</span>
            <span>장애인 편의: {restroom.wheelchair_accessible ? '지원' : '미지원'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#bac9cc]">
            <span className="material-symbols-outlined text-[16px] text-[#46ffb8]">check_circle</span>
            <span>기저귀 교환대: {restroom.baby_facility ? '있음' : '없음'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#bac9cc]">
            <span className="material-symbols-outlined text-[16px] text-[#46ffb8]">check_circle</span>
            <span>청결도 평점: ⭐ {restroom.cleanliness_score}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full h-12 rounded-xl bg-[#00e5ff] text-[#00363d] font-bold font-['Space_Grotesk'] flex items-center justify-center active:scale-95 transition-transform"
        >
          확인 완료
        </button>
      </div>
    </div>
  );
};
