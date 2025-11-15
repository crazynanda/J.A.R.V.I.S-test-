
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Orb } from './components/Orb';
import { ChatInterface } from './components/ChatInterface';
import { SuggestedPrompts } from './components/SuggestedPrompts';
import { type ChatMessage } from './types';
import { getAiResponse, getAiSpeech } from './services/geminiService';
import { VoiceToggle } from './components/VoiceToggle';

// --- Audio Utility Functions ---
// Decodes a base64 string into a Uint8Array.
function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// Decodes raw PCM audio data into an AudioBuffer for playback.
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

// Plays base64 encoded audio using the Web Audio API and manages the audio source.
async function playAudio(
    base64Audio: string,
    audioContext: AudioContext,
    sourceRef: React.MutableRefObject<AudioBufferSourceNode | null>
): Promise<void> {
    try {
        const decodedBytes = decode(base64Audio);
        const audioBuffer = await decodeAudioData(decodedBytes, audioContext, 24000, 1);
        
        // Stop any currently playing audio before starting a new one.
        if (sourceRef.current) {
            sourceRef.current.stop();
            sourceRef.current.disconnect();
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();

        // When playback finishes, clear the reference.
        source.onended = () => {
            if (sourceRef.current === source) {
                sourceRef.current = null;
            }
        };

        // Store the new source node.
        sourceRef.current = source;
    } catch (error) {
        console.error("Error playing audio:", error);
        sourceRef.current = null; // Ensure ref is cleared on error.
    }
}
// --- End Audio Utility Functions ---

const App: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { author: 'ai', text: "Hello. I'm J.A.R.V.I.S, your personal AI assistant. How can I help you organize your day?" }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [isVoiceOutputEnabled, setIsVoiceOutputEnabled] = useState(true);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    // Function to stop any currently playing audio.
    const stopAudio = useCallback(() => {
        if (audioSourceRef.current) {
            try {
                audioSourceRef.current.stop();
            } catch (e) {
                // Ignore errors if the source has already been stopped
            }
            audioSourceRef.current.disconnect();
            audioSourceRef.current = null;
        }
    }, []);

    // Initialize AudioContext on component mount and handle browser autoplay policies.
    useEffect(() => {
        if (!audioContextRef.current) {
            try {
                const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                audioContextRef.current = new AudioContext({ sampleRate: 24000 });
            } catch (error) {
                console.error("Could not create AudioContext:", error);
                setIsVoiceOutputEnabled(false); // Disable if not supported
            }
        }
        
        const resumeAudio = () => {
            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume();
            }
            window.removeEventListener('click', resumeAudio, true);
        };
        window.addEventListener('click', resumeAudio, true);

        return () => {
            window.removeEventListener('click', resumeAudio, true);
            stopAudio(); // Cleanup audio on unmount
        };
    }, [stopAudio]);

    const handleSendMessage = useCallback(async (text: string) => {
        if (!text.trim()) return;

        stopAudio(); // Stop any previous speech when a new message is sent.

        const userMessage: ChatMessage = { author: 'user', text };
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        try {
            // 1. Get the AI's text response first.
            const aiResponseText = await getAiResponse(text, messages);
            
            let audioPromise: Promise<string | null> = Promise.resolve(null);

            // 2. If voice is enabled, start fetching the audio *before* showing the text.
            if (isVoiceOutputEnabled && audioContextRef.current) {
                audioPromise = getAiSpeech(aiResponseText).catch(speechError => {
                    console.error("Failed to get AI speech:", speechError);
                    return null; // Don't let a speech failure block the message.
                });
            }

            // 3. Wait for the audio to be fetched.
            const base64Audio = await audioPromise;

            // 4. Now that we have both, update the UI and play audio simultaneously.
            const aiMessage: ChatMessage = { author: 'ai', text: aiResponseText };
            setMessages(prev => [...prev, aiMessage]);

            if (base64Audio && audioContextRef.current) {
                await playAudio(base64Audio, audioContextRef.current, audioSourceRef);
            }

        } catch (error) {
            console.error("Error getting AI response:", error);
            const errorMessage: ChatMessage = {
                author: 'ai',
                text: "I'm sorry, I encountered an error. Please try again later."
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [messages, isVoiceOutputEnabled, stopAudio]);

    const handleToggleVoice = useCallback(() => {
        const wasEnabled = isVoiceOutputEnabled;
        const willBeEnabled = !wasEnabled;
        
        // If turning voice off, stop any currently playing audio.
        if (wasEnabled && !willBeEnabled) {
            stopAudio();
        }
        setIsVoiceOutputEnabled(willBeEnabled);
    }, [isVoiceOutputEnabled, stopAudio]);

    return (
        <div className="flex flex-col h-screen bg-slate-900 text-slate-100 p-4 md:p-6 overflow-hidden">
            <header className="flex-shrink-0 flex items-center justify-center text-center py-4 relative">
                 <div className="absolute top-2 right-2">
                    <VoiceToggle 
                        isEnabled={isVoiceOutputEnabled} 
                        onToggle={handleToggleVoice} 
                        disabled={!audioContextRef.current}
                    />
                </div>
                <div className="flex flex-col items-center">
                    <Orb isLoading={isLoading} />
                    <h1 className="text-2xl md:text-3xl font-bold mt-4 text-slate-200 tracking-tight">J.A.R.V.I.S</h1>
                    <p className="text-sm md:text-base text-slate-400">Your personal Jarvis for life.</p>
                </div>
            </header>
            
            <main className="flex-1 flex flex-col min-h-0">
                <ChatInterface messages={messages} isLoading={isLoading} onSendMessage={handleSendMessage} />
            </main>

            <footer className="flex-shrink-0 pt-4">
                <SuggestedPrompts onPromptClick={handleSendMessage} disabled={isLoading}/>
            </footer>
        </div>
    );
};

export default App;
