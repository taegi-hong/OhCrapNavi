import React, { useState } from 'react';
import { FlushPulseAIResponse, RestroomCandidate, UrgencyLevel, UserCoordinates } from '../types';
import { playHapticChime, speakKoreanTTS } from '../utils/speech';

interface VoiceAssistModalProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation: UserCoordinates;
  candidateRestrooms: RestroomCandidate[];
  onApplyAIResponse: (response: FlushPulseAIResponse) => void;
}

export const VoiceAssistModal: React.FC<VoiceAssistModalProps> = ({
  isOpen,
  onClose,
  userLocation,
  candidateRestrooms,
  onApplyAIResponse,
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [urgencyMode, setUrgencyMode] = useState<UrgencyLevel>('extreme');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const recognitionRef = React.useRef<any>(null);

  React.useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  if (!isOpen) return null;

  const quickPrompts = [
    {
      label: '🚨 배 아파 죽겠어! 1분 내 갈 수 있는 곳!',
      query: '배 아파 죽겠어 당장 1분 내에 갈 수 있는 제일 가까운 화장실 찾아줘!',
      urgency: 'extreme' as UrgencyLevel,
    },
    {
      label: '🔑 도어락 비밀번호 없는 곳만 찾아줘',
      query: '비밀번호 입력 없이 바로 문 열고 들어갈 수 있는 개방 화장실 어디야?',
      urgency: 'high' as UrgencyLevel,
    },
    {
      label: '♿ 휠체어 진입 가능한 화장실',
      query: '휠체어나 유모차가 바로 들어갈 수 있는 장애인 편의시설 화장실 추천해줘.',
      urgency: 'normal' as UrgencyLevel,
    },
    {
      label: '🏢 역삼빌딩 로비 진입 경로 알려줘',
      query: '역삼빌딩 화장실 내부 들어가는 구체적인 경로와 엘리베이터 위치 알려줘.',
      urgency: 'high' as UrgencyLevel,
    },
  ];

  const handleQuery = async (queryText: string, urgency: UrgencyLevel = urgencyMode) => {
    if (!queryText.trim()) return;
    playHapticChime('emergency');
    setIsLoading(true);
    setStatusNotice('급똥내비 AI가 최단 경로와 개방 여부를 분석 중입니다...');

    try {
      const res = await fetch('/api/flushpulse/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          urgency_level: urgency,
          user_coordinates: userLocation,
          candidate_restrooms: candidateRestrooms,
          current_action: 'USER_VOICE_QUERY',
        }),
      });

      if (!res.ok) {
        throw new Error('API failed');
      }

      const data: FlushPulseAIResponse = await res.json();
      onApplyAIResponse(data);
      onClose();
    } catch (err) {
      console.warn('AI Assist request fallback:', err);
      // Fallback response conforming to schema
      const fallback: FlushPulseAIResponse = {
        intent: 'emergency_search',
        urgency_level: urgency,
        recommended_restroom: {
          name: candidateRestrooms[0]?.name || '역삼빌딩 1층 개방 화장실',
          distance_meters: candidateRestrooms[0]?.distance_meters || 120,
          walking_time_min: candidateRestrooms[0]?.walking_time_min || 2,
          is_open: true,
          floor_or_location_details: '1층 로비 우측 복도 끝',
          has_password: false,
          access_notes: '회전문 통과 즉시 진입, 도어락 없음',
        },
        voice_tts_message: `${candidateRestrooms[0]?.name || '역삼빌딩 화장실'}로 즉시 안내합니다. 도보 ${
          candidateRestrooms[0]?.walking_time_min || 2
        }분 거리입니다.`,
        step_instruction: '50m 직진 후 회전문 통과, 로비 우측 복도로 진입하세요.',
        ui_action: 'START_NAV',
      };
      onApplyAIResponse(fallback);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMicListening = () => {
    playHapticChime('click');
    setStatusNotice(null);

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
      setStatusNotice('음성 인식을 중지했습니다.');
      return;
    }

    const windowObj = window as unknown as Record<string, any>;
    const SpeechRecognitionClass =
      windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setStatusNotice('이 브라우저는 마이크 음성 인식을 지원하지 않습니다. 아래 추천 음성 버튼을 터치해주세요.');
      setInputText('배 아파 죽겠어! 가장 가까운 곳 찾아줘!');
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechRecognitionClass();
      recognitionRef.current = recognition;
      recognition.lang = 'ko-KR';
      recognition.continuous = false;
      recognition.interimResults = false;

      setIsListening(true);
      setStatusNotice('말씀하세요... 실시간 음성 듣는 중 🎙️');

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (e: any) => {
        const transcript = e.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setInputText(transcript);
          setIsListening(false);
          setStatusNotice(`인식됨: "${transcript}"`);
          handleQuery(transcript, 'extreme');
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition error:', event.error);
        setIsListening(false);

        if (event.error === 'not-allowed') {
          setStatusNotice('마이크 권한이 차단되었습니다. 마이크 권한을 허용하거나 아래 긴급 버튼을 터치하세요.');
          setInputText('배 아파 죽겠어! 당장 갈 수 있는 곳 찾아줘!');
        } else if (event.error === 'no-speech') {
          setStatusNotice('음성이 감지되지 않았습니다. 다시 마이크를 누르거나 텍스트를 입력하세요.');
        } else {
          setStatusNotice(`음성 오류 (${event.error || '연결 실패'}). 아래 추천 문장을 선택해주세요.`);
          setInputText('가장 가까운 개방 화장실 찾아줘');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setIsListening(false);
      setStatusNotice('마이크를 시작할 수 없습니다. 아래 추천 버튼을 선택해주세요.');
      setInputText('배 아파 죽겠어! 가장 가까운 곳 찾아줘!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#1c2025] border border-[#31353b] rounded-3xl p-5 shadow-2xl flex flex-col gap-3.5 animate-in fade-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#00e5ff] text-[#00363d] flex items-center justify-center font-bold shadow-[0_0_12px_rgba(0,229,255,0.7)]">
              <span className="material-symbols-outlined text-[18px]">graphic_eq</span>
            </div>
            <div className="flex flex-col">
              <span className="font-['JetBrains_Mono'] text-[10px] text-[#00daf3] uppercase tracking-wider font-semibold">
                급똥내비 AI VOICE
              </span>
              <span className="font-['Space_Grotesk'] text-[16px] text-[#e0e2ea] font-bold leading-tight">
                실시간 긴급 음성 탐색 (STT)
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

        {/* Urgency Selector Toggle */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#101419] rounded-xl border border-[#31353b]">
          {(['extreme', 'high', 'normal'] as UrgencyLevel[]).map((level) => (
            <button
              key={level}
              onClick={() => {
                playHapticChime('click');
                setUrgencyMode(level);
              }}
              className={`py-1.5 px-2 rounded-lg text-[12px] font-['Space_Grotesk'] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                urgencyMode === level
                  ? level === 'extreme'
                    ? 'bg-[#df0042] text-[#fff1f1] shadow-md'
                    : level === 'high'
                    ? 'bg-[#00e5ff] text-[#00363d] shadow-md'
                    : 'bg-[#46ffb8] text-[#002114] shadow-md'
                  : 'text-[#bac9cc] hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">
                {level === 'extreme' ? 'bolt' : level === 'high' ? 'speed' : 'eco'}
              </span>
              <span>{level === 'extreme' ? '급똥 비상' : level === 'high' ? '긴급 탐색' : '일반'}</span>
            </button>
          ))}
        </div>

        {/* Mic Pulse Center Action */}
        <div className="flex flex-col items-center justify-center py-4 bg-[#101419] rounded-2xl border border-[#31353b] relative overflow-hidden">
          <div className="relative flex items-center justify-center my-2">
            {isListening && (
              <>
                <div className="w-24 h-24 rounded-full bg-[#00e5ff]/25 animate-ping absolute" />
                <div className="w-20 h-20 rounded-full bg-[#df0042]/25 animate-pulse absolute" />
              </>
            )}
            <button
              onClick={toggleMicListening}
              className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all cursor-pointer ${
                isListening
                  ? 'bg-[#df0042] text-white shadow-[0_0_24px_rgba(223,0,66,0.8)] scale-110'
                  : 'bg-gradient-to-tr from-[#00e5ff] to-[#00daf3] text-[#00363d] shadow-[0_0_20px_rgba(0,229,255,0.6)] active:scale-90'
              }`}
            >
              <span className="material-symbols-outlined text-[32px]">
                {isListening ? 'mic' : 'mic_none'}
              </span>
            </button>
          </div>

          <p className="font-['Space_Grotesk'] text-[14px] text-[#e0e2ea] font-medium mt-1">
            {isListening ? '듣고 있습니다... 말씀하세요!' : '마이크를 누르거나 아래 추천 질문 터치'}
          </p>

          {statusNotice && (
            <span className="font-['Inter'] text-[11px] text-[#ffdada] bg-[#93000a]/40 border border-[#df0042]/50 px-2.5 py-1 rounded-full mt-2 text-center max-w-[90%]">
              {statusNotice}
            </span>
          )}
        </div>

        {/* Manual text input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleQuery(inputText);
              }
            }}
            placeholder="직접 상황 입력 (예: 당장 갈 수 있는 곳!)"
            className="flex-1 h-11 px-4 rounded-xl bg-[#262a30] border border-[#3b494c] text-sm text-[#e0e2ea] focus:outline-none focus:border-[#00e5ff]"
          />
          <button
            onClick={() => handleQuery(inputText)}
            disabled={isLoading || !inputText.trim()}
            className="h-11 px-4 rounded-xl bg-[#00e5ff] text-[#00363d] font-bold text-sm flex items-center justify-center disabled:opacity-50 active:scale-95 transition-all cursor-pointer"
          >
            {isLoading ? (
              <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
            ) : (
              '전송'
            )}
          </button>
        </div>

        {/* Quick Situation Prompts */}
        <div className="flex flex-col gap-1.5">
          <span className="font-['JetBrains_Mono'] text-[11px] text-[#849396] uppercase">
            상황별 원터치 음성 명령
          </span>
          <div className="flex flex-col gap-1.5">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInputText(p.query);
                  handleQuery(p.query, p.urgency);
                }}
                disabled={isLoading}
                className="text-left px-3.5 py-2.5 rounded-xl bg-[#262a30] hover:bg-[#31353b] border border-[#3b494c]/60 text-xs text-[#e0e2ea] flex items-center justify-between active:scale-[0.99] transition-all cursor-pointer"
              >
                <span className="font-medium truncate">{p.label}</span>
                <span className="material-symbols-outlined text-[#00e5ff] text-[16px] flex-shrink-0 ml-2">
                  arrow_forward
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
