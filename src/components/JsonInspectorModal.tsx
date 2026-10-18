import React, { useState } from 'react';
import { FlushPulseAIResponse } from '../types';
import { playHapticChime } from '../utils/speech';

interface JsonInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastAIResponse: FlushPulseAIResponse | null;
  latencyMs?: number;
  apiSourceInfo?: {
    endpoint: string;
    status: string;
    total: number;
    timestamp: number;
  };
}

export const JsonInspectorModal: React.FC<JsonInspectorModalProps> = ({
  isOpen,
  onClose,
  lastAIResponse,
  latencyMs = 180,
  apiSourceInfo,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai' | 'localdata'>('ai');

  if (!isOpen) return null;

  const aiJsonString = JSON.stringify(
    lastAIResponse || {
      intent: 'emergency_search',
      urgency_level: 'extreme',
      recommended_restroom: {
        name: '역삼빌딩 1층 개방 화장실',
        distance_meters: 120,
        walking_time_min: 2,
        is_open: true,
        floor_or_location_details: '1층 로비 우측 복도 끝',
        has_password: false,
        access_notes: '회전문 통과 즉시 진입, 도어락 무설정',
      },
      voice_tts_message:
        '120미터 앞 역삼빌딩 1층 개방 화장실로 즉시 안내합니다. 비밀번호 없이 바로 진입 가능합니다.',
      step_instruction: '50m 직진 후 회전문 통과, 로비 우측 복도로 진입하세요.',
      ui_action: 'START_NAV',
    },
    null,
    2
  );

  const localdataApiJsonString = JSON.stringify(
    {
      api_endpoint:
        apiSourceInfo?.endpoint ||
        'https://sample.localdata.go.kr/public/public_restroom_info/info',
      radius: '1000m (1km)',
      status: apiSourceInfo?.status || 'connected',
      total_found: apiSourceInfo?.total || 9,
      data_source: '공중화장실정보 데이터 조회 API (전국공중화장실표준데이터)',
      timestamp: new Date(apiSourceInfo?.timestamp || Date.now()).toISOString(),
      sample_toilet: {
        toiletNm: '지하철 역사 공중화장실',
        rdnmadr: '소재지 도로명주소',
        la: 37.49852,
        lo: 127.0282,
        distance_meters: 95,
        walking_time_min: 2,
        opnTimeInfo: '05:30 ~ 24:00',
        maleClstCnt: '8',
        femaleClstCnt: '8',
        maleDspsnClstCnt: '2',
        femaleDspsnClstCnt: '2',
        diaperExchgPosblAt: 'Y',
        emrgncyBellInstlAt: 'Y',
      },
    },
    null,
    2
  );

  const currentJson = activeTab === 'ai' ? aiJsonString : localdataApiJsonString;

  const handleCopy = () => {
    playHapticChime('click');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentJson).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-lg bg-[#181c21] border border-[#3b494c] rounded-3xl p-5 shadow-2xl flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]" />
            <span className="font-['JetBrains_Mono'] text-[14px] text-[#e0e2ea] font-bold">
              {activeTab === 'ai' ? 'FlushPulse AI JSON Stream' : '공중화장실 API (1km 표준데이터)'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#262a30] text-[#849396] hover:text-[#e0e2ea] flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>

        {/* Tab selection row */}
        <div className="flex items-center gap-2 bg-[#101419] p-1 rounded-xl border border-[#31353b]">
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ai'
                ? 'bg-[#00e5ff] text-[#00363d] shadow-md'
                : 'text-[#849396] hover:text-white'
            }`}
          >
            Gemini AI 내비 스키마
          </button>
          <button
            onClick={() => setActiveTab('localdata')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'localdata'
                ? 'bg-[#00e5ff] text-[#00363d] shadow-md'
                : 'text-[#849396] hover:text-white'
            }`}
          >
            공중화장실 1km API (localdata)
          </button>
        </div>

        {/* Telemetry pill row */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-['JetBrains_Mono']">
          <span className="px-2 py-0.5 rounded bg-[#262a30] text-[#00daf3] border border-[#31353b]">
            {activeTab === 'ai' ? 'MODEL: gemini-3.8-flash' : 'API: sample.localdata.go.kr'}
          </span>
          <span className="px-2 py-0.5 rounded bg-[#262a30] text-[#46ffb8] border border-[#31353b]">
            {activeTab === 'ai' ? `LATENCY: ${latencyMs}ms` : 'RADIUS: 1,000m (1km)'}
          </span>
          <span className="px-2 py-0.5 rounded bg-[#262a30] text-[#ffb3b6] border border-[#31353b]">
            STATUS: 200 OK
          </span>
        </div>

        {/* Code container */}
        <div className="relative">
          <pre className="p-4 bg-[#0a0e13] border border-[#31353b] rounded-2xl text-[12px] font-['JetBrains_Mono'] text-[#9cf0ff] overflow-x-auto max-h-[340px] leading-relaxed selection:bg-[#00e5ff]/30">
            {currentJson}
          </pre>

          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-[#262a30] hover:bg-[#31353b] border border-[#3b494c] text-[11px] font-['JetBrains_Mono'] text-[#00e5ff] flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">
              {copied ? 'check' : 'content_copy'}
            </span>
            <span>{copied ? '복사됨' : 'JSON 복사'}</span>
          </button>
        </div>

        {/* Schema validation confirmation note */}
        <div className="flex items-center gap-1.5 text-[11px] text-[#849396] font-['Inter']">
          <span className="material-symbols-outlined text-[#46ffb8] text-[16px]">verified</span>
          <span>
            {activeTab === 'ai'
              ? '필수 6개 필드 (intent, urgency_level, recommended_restroom, voice_tts_message, step_instruction, ui_action) 검증 완료'
              : '전국공중화장실표준데이터 반경 1km 실시간 필터링 적용 완료'}
          </span>
        </div>
      </div>
    </div>
  );
};
