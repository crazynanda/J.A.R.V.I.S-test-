
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Blob } from '@google/genai';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

type TranscriptionEntry = {
    author: 'user' | 'ai';
    text: string;
};

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';


// --- Audio Utility Functions ---
function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}
// --- End Audio Utility Functions ---

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const LiveConversationModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [transcription, setTranscription] = useState<TranscriptionEntry[]>([]);
    const [error, setError] = useState<string | null>(null);

    const liveSessionRef = useRef<any>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRefs = useRef<{ input: AudioContext | null, output: AudioContext | null, processor: ScriptProcessorNode | null }>({ input: null, output: null, processor: null });
    const audioPlaybackRefs = useRef<{ queue: AudioBufferSourceNode[], nextStartTime: number }>({ queue: [], nextStartTime: 0 });

    const stopConversation = () => {
        if (liveSessionRef.current) {
            liveSessionRef.current.close();
            liveSessionRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (audioContextRefs.current.input) {
            audioContextRefs.current.input.close();
            audioContextRefs.current.input = null;
        }
         if (audioContextRefs.current.output) {
            audioPlaybackRefs.current.queue.forEach(source => source.stop());
            audioPlaybackRefs.current.queue = [];
            audioContextRefs.current.output.close();
            audioContextRefs.current.output = null;
        }
        if (audioContextRefs.current.processor) {
            audioContextRefs.current.processor.disconnect();
            audioContextRefs.current.processor = null;
        }
        setStatus('disconnected');
    };

    const handleClose = () => {
        stopConversation();
        onClose();
    };

    useEffect(() => {
        if (!isOpen) {
            stopConversation();
            return;
        }

        let currentInputTranscription = '';
        let currentOutputTranscription = '';

        const startConversation = async () => {
            setStatus('connecting');
            setError(null);
            setTranscription([]);
            
            try {
                // Initialize Audio Contexts
                const InputAudioContext = window.AudioContext || (window as any).webkitAudioContext;
                const OutputAudioContext = window.AudioContext || (window as any).webkitAudioContext;
                audioContextRefs.current.input = new InputAudioContext({ sampleRate: 16000 });
                audioContextRefs.current.output = new OutputAudioContext({ sampleRate: 24000 });
                audioPlaybackRefs.current.nextStartTime = 0;
                
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaStreamRef.current = stream;
                
                const sessionPromise = ai.live.connect({
                    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                    callbacks: {
                        onopen: () => {
                            setStatus('connected');
                            const source = audioContextRefs.current.input!.createMediaStreamSource(stream);
                            const processor = audioContextRefs.current.input!.createScriptProcessor(4096, 1, 1);
                            audioContextRefs.current.processor = processor;
                            
                            processor.onaudioprocess = (audioProcessingEvent) => {
                                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                                const pcmBlob = createBlob(inputData);
                                sessionPromise.then((session) => {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                });
                            };

                            source.connect(processor);
                            processor.connect(audioContextRefs.current.input!.destination);
                        },
                        onmessage: async (message: LiveServerMessage) => {
                            // --- Transcription Handling ---
                            if (message.serverContent?.outputTranscription) {
                                currentOutputTranscription += message.serverContent.outputTranscription.text;
                            }
                            if (message.serverContent?.inputTranscription) {
                                currentInputTranscription += message.serverContent.inputTranscription.text;
                            }
                             if (message.serverContent?.turnComplete) {
                                if (currentInputTranscription.trim()) {
                                    setTranscription(prev => [...prev, { author: 'user', text: currentInputTranscription.trim() }]);
                                }
                                 if (currentOutputTranscription.trim()) {
                                    setTranscription(prev => [...prev, { author: 'ai', text: currentOutputTranscription.trim() }]);
                                }
                                currentInputTranscription = '';
                                currentOutputTranscription = '';
                            }
                            
                            // --- Audio Playback Handling ---
                            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                            if (audioData) {
                                const outputCtx = audioContextRefs.current.output;
                                if (outputCtx) {
                                    const nextStartTime = Math.max(audioPlaybackRefs.current.nextStartTime, outputCtx.currentTime);
                                    const audioBuffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
                                    
                                    const source = outputCtx.createBufferSource();
                                    source.buffer = audioBuffer;
                                    source.connect(outputCtx.destination);
                                    source.start(nextStartTime);

                                    audioPlaybackRefs.current.nextStartTime = nextStartTime + audioBuffer.duration;
                                    audioPlaybackRefs.current.queue.push(source);
                                }
                            }
                        },
                        onerror: (e: ErrorEvent) => {
                            console.error('Live session error:', e);
                            setError("Connection error. Please try again.");
                            setStatus('error');
                            stopConversation();
                        },
                        onclose: () => {
                            setStatus('disconnected');
                        },
                    },
                    config: {
                        responseModalities: [Modality.AUDIO],
                        outputAudioTranscription: {},
                        inputAudioTranscription: {},
                        speechConfig: {
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                        },
                    },
                });
                liveSessionRef.current = await sessionPromise;

            } catch (err) {
                 console.error("Failed to start conversation:", err);
                 if (err instanceof Error && err.name === 'NotAllowedError') {
                    setError("Microphone access was denied. Please enable it in your browser settings.");
                 } else {
                    setError("Could not access microphone.");
                 }
                 setStatus('error');
            }
        };

        startConversation();

        return () => {
            stopConversation();
        };
    }, [isOpen]);

    if (!isOpen) return null;
    
    const StatusIndicator = () => {
        let color = 'bg-slate-500';
        let text = 'Disconnected';
        let pulse = false;

        switch (status) {
            case 'connecting': color = 'bg-yellow-500'; text = 'Connecting...'; pulse = true; break;
            case 'connected': color = 'bg-green-500'; text = 'Connected - Listening...'; pulse = true; break;
            case 'error': color = 'bg-red-500'; text = 'Error'; break;
        }

        return (
             <div className="flex items-center gap-2 text-sm text-slate-300">
                <div className={`w-3 h-3 rounded-full ${color} ${pulse ? 'animate-pulse' : ''}`}></div>
                <span>{text}</span>
            </div>
        )
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" role="dialog" aria-modal="true" >
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col">
                <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
                    <h2 className="text-lg font-bold text-slate-200">Live Conversation</h2>
                    <StatusIndicator />
                </header>

                <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                    {transcription.length === 0 && status !== 'error' && (
                        <div className="text-center text-slate-400 pt-10">
                            <p>Once connected, start speaking.</p>
                            <p className="text-sm">Your conversation will be transcribed here.</p>
                        </div>
                    )}
                    {error && (
                        <div className="text-center text-red-400 pt-10">
                            <p className="font-semibold">An Error Occurred</p>
                            <p className="text-sm">{error}</p>
                        </div>
                    )}
                    {transcription.map((entry, index) => (
                        <div key={index} className={`flex ${entry.author === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`px-4 py-2 rounded-lg max-w-lg ${entry.author === 'user' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                                {entry.text}
                            </div>
                        </div>
                    ))}
                </div>

                <footer className="p-4 border-t border-slate-700 flex-shrink-0 flex justify-center">
                    <button onClick={handleClose} className="bg-red-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-red-700 transition-colors">
                        Leave Conversation
                    </button>
                </footer>
            </div>
        </div>
    );
};
