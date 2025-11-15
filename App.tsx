
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Orb } from './components/Orb';
import { ChatInterface } from './components/ChatInterface';
import { type ChatMessage, type ServiceIntegration } from './types';
import { getAiResponse, getAiSpeech, getAiResponseAfterConsent } from './services/geminiService';
import { getDeviceEmailAccounts } from './services/mockDataService';
import { VoiceToggle } from './components/VoiceToggle';
import { ConnectionsModal } from './components/ConnectionsModal';
import { ConnectionsIcon } from './components/icons';
import { INITIAL_INTEGRATIONS } from './constants';

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
        
        if (sourceRef.current) {
            sourceRef.current.stop();
            sourceRef.current.disconnect();
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();

        source.onended = () => {
            if (sourceRef.current === source) {
                sourceRef.current = null;
            }
        };
        sourceRef.current = source;
    } catch (error) {
        console.error("Error playing audio:", error);
        sourceRef.current = null;
    }
}
// --- End Audio Utility Functions ---

const App: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { author: 'ai', text: "Hello. I'm J.A.R.V.I.S, your personal AI assistant. How can I help you organize your day?" }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [isVoiceOutputEnabled, setIsVoiceOutputEnabled] = useState(true);
    const [isConnectionsModalOpen, setIsConnectionsModalOpen] = useState(false);
    const [integrations, setIntegrations] = useState<ServiceIntegration[]>(INITIAL_INTEGRATIONS);
    const [isInitializing, setIsInitializing] = useState(true);

    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    // Unchanged from before
    const stopAudioInternal = useCallback(() => {
        if (audioSourceRef.current) {
            try {
                audioSourceRef.current.stop();
            } catch (e) {
                // Ignore errors
            }
            audioSourceRef.current.disconnect();
            audioSourceRef.current = null;
        }
    }, []);

    useEffect(() => {
        // ... audio context initialization as before ...
        if (!audioContextRef.current) {
            try {
                const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                audioContextRef.current = new AudioContext({ sampleRate: 24000 });
            } catch (error) {
                console.error("Could not create AudioContext:", error);
                setIsVoiceOutputEnabled(false);
            }
        }
        
        const resumeAudio = () => {
            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume();
            }
            window.removeEventListener('click', resumeAudio, true);
        };
        window.addEventListener('click', resumeAudio, true);

        // Simulate real-time discovery of device accounts
        const initializeApp = async () => {
            setIsInitializing(true);
            try {
                const discoveredAccounts = await getDeviceEmailAccounts();
                setIntegrations(prevIntegrations =>
                    prevIntegrations.map(int => {
                        if (int.id === 'email') {
                            return {
                                ...int,
                                accounts: discoveredAccounts.map(acc => ({ id: acc.id, connected: false }))
                            };
                        }
                        return int;
                    })
                );
            } catch (error) {
                console.error("Failed to discover device accounts:", error);
            } finally {
                setIsInitializing(false);
            }
        };

        initializeApp();

        return () => {
            window.removeEventListener('click', resumeAudio, true);
            stopAudioInternal();
        };
    }, [stopAudioInternal]);

    const playAiSpeech = useCallback(async (text: string) => {
        if (!isVoiceOutputEnabled || !audioContextRef.current) return;
        try {
            const base64Audio = await getAiSpeech(text);
            if (base64Audio && audioContextRef.current) {
                await playAudio(base64Audio, audioContextRef.current, audioSourceRef);
            }
        } catch (error) {
            console.error("Failed to play AI speech:", error);
        }
    }, [isVoiceOutputEnabled]);

    const handleSendMessage = useCallback(async (text: string) => {
        if (!text.trim()) return;
        stopAudioInternal();
        const userMessage: ChatMessage = { author: 'user', text };
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        try {
            const aiResponse = await getAiResponse(text, messages, integrations);
            const aiMessage: ChatMessage = { 
                author: 'ai', 
                text: aiResponse.text,
                requiresConsent: aiResponse.requiresConsent,
                action: aiResponse.action,
            };
            setMessages(prev => [...prev, aiMessage]);
            
            // Only speak non-consent messages
            if (!aiResponse.requiresConsent) {
                await playAiSpeech(aiResponse.text);
            }
        } catch (error) {
            console.error("Error getting AI response:", error);
            const errorMessage: ChatMessage = { author: 'ai', text: "I'm sorry, I encountered an error." };
            setMessages(prev => [...prev, errorMessage]);
            await playAiSpeech(errorMessage.text);
        } finally {
            setIsLoading(false);
        }
    }, [messages, integrations, stopAudioInternal, playAiSpeech]);

    const handleConsent = useCallback(async (messageToApprove: ChatMessage) => {
        if (!messageToApprove.action) return;
        stopAudioInternal();
        setMessages(prev => prev.map(m => m === messageToApprove ? { ...m, consentGranted: true, text: `${m.text}\n\n*Access granted. Proceeding...*` } : m));
        setIsLoading(true);

        const historyUpToConsentRequest = messages.slice(0, messages.indexOf(messageToApprove) + 1);

        try {
            const aiResponse = await getAiResponseAfterConsent(messageToApprove.action, historyUpToConsentRequest, integrations);
            const aiMessage: ChatMessage = { author: 'ai', text: aiResponse.text };
            setMessages(prev => [...prev, aiMessage]);
            await playAiSpeech(aiResponse.text);
        } catch (error) {
            console.error("Error getting AI response after consent:", error);
            const errorMessage: ChatMessage = { author: 'ai', text: "Thank you. However, I encountered an error while proceeding." };
            setMessages(prev => [...prev, errorMessage]);
            await playAiSpeech(errorMessage.text);
        } finally {
            setIsLoading(false);
        }
    }, [messages, integrations, stopAudioInternal, playAiSpeech]);

    const handleToggleVoice = useCallback(() => {
        setIsVoiceOutputEnabled(prev => {
            if (prev) stopAudioInternal();
            return !prev;
        });
    }, [stopAudioInternal]);

    const handleToggleIntegration = useCallback((id: string, accountId?: string) => {
        setIntegrations(prev => prev.map(int => {
            if (int.id !== id) return int;

            // Handle services with multiple accounts, like email
            if (accountId && int.accounts) {
                const newAccounts = int.accounts.map(acc => 
                    acc.id === accountId ? { ...acc, connected: !acc.connected } : acc
                );
                const isAnyAccountConnected = newAccounts.some(acc => acc.connected);
                return { ...int, accounts: newAccounts, connected: isAnyAccountConnected };
            }

            // Handle simple toggle for other services
            return { ...int, connected: !int.connected };
        }));
    }, []);

    return (
        <div className="flex flex-col h-screen bg-slate-900 text-slate-100 p-4 md:p-6 overflow-hidden">
            <header className="flex-shrink-0 flex items-center justify-center text-center py-4 relative">
                <div className="absolute top-2 left-2 flex items-center gap-2">
                     <button
                        onClick={() => setIsConnectionsModalOpen(true)}
                        className="p-2 rounded-full text-slate-400 hover:text-cyan-400 hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-wait"
                        aria-label="Manage Connections"
                        title="Manage Connections"
                        disabled={isInitializing}
                    >
                        <ConnectionsIcon />
                    </button>
                </div>
                <div className="absolute top-2 right-2">
                    <VoiceToggle isEnabled={isVoiceOutputEnabled} onToggle={handleToggleVoice} disabled={!audioContextRef.current} />
                </div>
                <div className="flex flex-col items-center">
                    <Orb isLoading={isLoading} />
                    <h1 className="text-2xl md:text-3xl font-bold mt-4 text-slate-200 tracking-tight">J.A.R.V.I.S</h1>
                    <p className="text-sm md:text-base text-slate-400">Your personal Jarvis for life.</p>
                </div>
            </header>
            
            <main className="flex-1 flex flex-col min-h-0">
                <ChatInterface messages={messages} isLoading={isLoading} onSendMessage={handleSendMessage} onConsent={handleConsent} />
            </main>
            
            <ConnectionsModal 
                isOpen={isConnectionsModalOpen} 
                onClose={() => setIsConnectionsModalOpen(false)}
                integrations={integrations}
                onToggle={handleToggleIntegration}
            />
        </div>
    );
};

export default App;
