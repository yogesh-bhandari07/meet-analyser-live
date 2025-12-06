import React, { useState, useRef, useEffect } from 'react';
import HUD from './components/HUD';
import { GeminiLiveService } from './services/gemini-live';
import { WingmanMessage, WingmanAlertType } from './types';
import { v4 as uuidv4 } from 'uuid';

// Helper to generate UUIDs
const generateId = () => Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState<WingmanMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const serviceRef = useRef<GeminiLiveService | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  // Parse incoming text for alerts
  const processIncomingText = (text: string) => {
    // Accumulate text or process line by line. 
    // Since we get chunks, we need to be careful. 
    // For simplicity in this demo, we assume the model speaks in fairly complete thoughts/sentences.
    
    // Check for tags
    let type = WingmanAlertType.INFO;
    let cleanText = text;

    if (text.includes('🔴') || text.includes('[RISK ALERT]')) {
      type = WingmanAlertType.RISK;
      cleanText = text.replace(/🔴|\[RISK ALERT\]/g, '').trim();
    } else if (text.includes('🟡') || text.includes('[BLUFF DETECTED]')) {
      type = WingmanAlertType.BLUFF;
      cleanText = text.replace(/🟡|\[BLUFF DETECTED\]/g, '').trim();
    } else if (text.includes('🟢') || text.includes('[OPPORTUNITY]')) {
      type = WingmanAlertType.OPPORTUNITY;
      cleanText = text.replace(/🟢|\[OPPORTUNITY\]/g, '').trim();
    } else if (text.includes('🔵') || text.includes('[COUNTER-SCRIPT]')) {
      type = WingmanAlertType.COUNTER;
      cleanText = text.replace(/🔵|\[COUNTER-SCRIPT\]/g, '').trim();
    }

    // Only add message if it has substantial content
    if (cleanText.length > 5) {
      const newMessage: WingmanMessage = {
        id: generateId(),
        type,
        text: cleanText,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, newMessage]);
    }
  };

  const handleStart = async () => {
    setError(null);
    if (!process.env.API_KEY) {
      setError("API Key not found in environment.");
      return;
    }

    try {
      serviceRef.current = new GeminiLiveService(process.env.API_KEY);
      
      // Setup audio output context for playing back Wingman's voice
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000
      });
      nextStartTimeRef.current = audioContextRef.current.currentTime;

      await serviceRef.current.connect({
        onOpen: () => {
          setIsActive(true);
          setMessages([{
            id: generateId(),
            type: WingmanAlertType.INFO,
            text: "Wingman Activated. Listening & Watching...",
            timestamp: Date.now()
          }]);
        },
        onMessage: (text) => {
          if (text) {
             processIncomingText(text);
          }
        },
        onAudioData: (audioBuffer) => {
           // Play the audio
           if (!audioContextRef.current) return;
           
           const ctx = audioContextRef.current;
           const source = ctx.createBufferSource();
           source.buffer = audioBuffer;
           source.connect(ctx.destination);
           
           // Schedule playback
           const now = ctx.currentTime;
           // Ensure we don't schedule in the past
           const start = Math.max(now, nextStartTimeRef.current);
           source.start(start);
           nextStartTimeRef.current = start + audioBuffer.duration;
        },
        onClose: () => {
          setIsActive(false);
        },
        onError: (err) => {
          setError(err.message);
          setIsActive(false);
        }
      });

    } catch (e: any) {
      setError(e.message || "Failed to connect");
      setIsActive(false);
    }
  };

  const handleStop = async () => {
    if (serviceRef.current) {
      await serviceRef.current.disconnect();
      serviceRef.current = null;
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    setIsActive(false);
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[120px]"></div>
      </div>

      {/* Main Control Card */}
      {!isActive ? (
        <div className="z-10 w-full max-w-lg glass-panel p-8 rounded-2xl border border-gray-700 shadow-2xl">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="p-4 bg-gray-800 rounded-full border border-gray-700 shadow-inner">
              <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            
            <div>
              <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-2">
                The Wingman
              </h1>
              <p className="text-gray-400 text-lg">
                Your AI Negotiation Co-Pilot
              </p>
            </div>

            <div className="space-y-4 w-full">
              <div className="bg-gray-800/50 p-4 rounded-lg text-left text-sm text-gray-400 border border-gray-700">
                <p className="font-semibold text-gray-300 mb-2">Instructions:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Allow Microphone access for audio analysis.</li>
                  <li>Select the <strong>Window</strong> or <strong>Screen</strong> showing the contract.</li>
                  <li>Keep this tab open in the background.</li>
                  <li>Watch the HUD overlay for live strategy.</li>
                </ul>
              </div>
            </div>

            {error && (
              <div className="w-full bg-red-900/30 border border-red-500/50 text-red-200 p-3 rounded text-sm">
                Error: {error}
              </div>
            )}

            <button
              onClick={handleStart}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] transform hover:scale-[1.02]"
            >
              Activate Protocol
            </button>
          </div>
        </div>
      ) : (
        <div className="z-10 fixed top-4 left-4">
             <button
              onClick={handleStop}
              className="px-6 py-2 bg-red-600/80 hover:bg-red-500 text-white font-semibold rounded-lg backdrop-blur transition-colors border border-red-400/30"
            >
              Terminate Session
            </button>
        </div>
      )}

      {/* The Overlay */}
      <HUD messages={messages} isActive={isActive} />
    </div>
  );
};

export default App;
