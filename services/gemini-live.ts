import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { WINGMAN_SYSTEM_INSTRUCTION, MODEL_NAME, VOICE_NAME } from '../constants';
import { createBlob, decode, decodeAudioData, blobToBase64 } from '../utils/audio-utils';

export interface GeminiLiveCallbacks {
  onOpen: () => void;
  onMessage: (text: string | null) => void;
  onAudioData: (audioBuffer: AudioBuffer) => void;
  onClose: () => void;
  onError: (error: Error) => void;
}

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private mediaStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private screenInterval: number | null = null;
  
  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async connect(callbacks: GeminiLiveCallbacks) {
    // 1. Setup Audio Input
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 16000,
    });
    
    // Request Microphone
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true
      } 
    });

    // Request Screen Share for visual context
    try {
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                width: { max: 1280 },
                height: { max: 720 },
                frameRate: { max: 5 } // Low framerate is fine for documents
            },
            audio: false // We use mic audio for input
        });
    } catch (err) {
        console.warn("Screen share declined, proceeding with audio only.");
    }

    // 2. Connect to Gemini Live
    this.sessionPromise = this.ai.live.connect({
      model: MODEL_NAME,
      callbacks: {
        onopen: () => {
          callbacks.onOpen();
          this.startAudioStreaming();
          this.startScreenStreaming();
        },
        onmessage: async (message: LiveServerMessage) => {
            // Handle Text Transcription (Input & Output)
            if (message.serverContent?.outputTranscription?.text) {
                callbacks.onMessage(message.serverContent.outputTranscription.text);
            }

            // Handle Audio Output from Gemini
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                const audioBuffer = await decodeAudioData(
                    decode(base64Audio),
                    audioCtx,
                    24000,
                    1
                );
                callbacks.onAudioData(audioBuffer);
            }

            if (message.serverContent?.turnComplete) {
                // End of turn logic if needed
            }
        },
        onclose: () => callbacks.onClose(),
        onerror: (err) => callbacks.onError(new Error(err.type)),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } },
        },
        systemInstruction: WINGMAN_SYSTEM_INSTRUCTION,
        outputAudioTranscription: {}, // Crucial for getting text back to display on HUD
      },
    });

    return this.sessionPromise;
  }

  private startAudioStreaming() {
    if (!this.inputAudioContext || !this.mediaStream || !this.sessionPromise) return;

    const source = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    this.scriptProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createBlob(inputData);
      
      this.sessionPromise?.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    source.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioContext.destination);
  }

  private startScreenStreaming() {
      if (!this.screenStream || !this.sessionPromise) return;

      const track = this.screenStream.getVideoTracks()[0];
      const imageCapture = new (window as any).ImageCapture(track);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const video = document.createElement('video');
      video.srcObject = this.screenStream;
      video.muted = true;
      video.play();

      // Send a frame every 2 seconds
      this.screenInterval = window.setInterval(async () => {
          if(!ctx || video.readyState !== 4) return;
          
          canvas.width = video.videoWidth * 0.5; // Scale down for performance
          canvas.height = video.videoHeight * 0.5;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(async (blob) => {
              if (blob) {
                  const base64 = await blobToBase64(blob);
                  this.sessionPromise?.then(session => {
                      session.sendRealtimeInput({
                          media: {
                              mimeType: 'image/jpeg',
                              data: base64
                          }
                      });
                  });
              }
          }, 'image/jpeg', 0.6);

      }, 2000);
  }

  async disconnect() {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.inputAudioContext) {
      await this.inputAudioContext.close();
      this.inputAudioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.screenStream) {
        this.screenStream.getTracks().forEach(track => track.stop());
        this.screenStream = null;
    }
    if (this.screenInterval) {
        clearInterval(this.screenInterval);
        this.screenInterval = null;
    }
    // We cannot explicitly close the session object in the current SDK version easily 
    // without just abandoning the promise, but we can stop sending inputs.
    // Ideally, we would call session.close() if available.
  }
}
