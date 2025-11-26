
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Orb } from './components/Orb';
import { ChatInterface } from './components/ChatInterface';
import { ChatHistoryPanel } from './components/ChatHistoryPanel';
import { type ChatMessage, type ServiceIntegration, type ChatSession, type User } from './types';
import { getAiResponse, getAiSpeech, getAiResponseAfterConsent } from './services/geminiService';
import { getDeviceEmailAccounts, signInWithGoogle, signOut } from './services/mockDataService';
import { VoiceToggle } from './components/VoiceToggle';
import { ConnectionsModal } from './components/ConnectionsModal';
import { ConnectionsIcon, HistoryIcon, GoogleIcon, ConversationModeIcon } from './components/icons';
import { INITIAL_INTEGRATIONS } from './constants';
import { LiveConversationModal } from './components/LiveConversationModal';

// --- Local Storage Keys ---
const CHAT_SESSIONS_KEY = 'jarvis-chat-sessions';
const VOICE_ENABLED_KEY = 'jarvis-voice-enabled';
const USER_MEMORY_KEY = 'jarvis-user-memory';

// --- Audio Utility Functions ---

// Decodes raw PCM audio data into an AudioBuffer for playback.
// Optimized: Processes in chunks to yield to the main thread, keeping UI responsive.
async function decodeAudioData(
    arrayBuffer: ArrayBuffer,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(arrayBuffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    // Process in chunks to prevent blocking the UI thread on large responses
    const chunkSize = 50000; 
    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i += chunkSize) {
            const end = Math.min(i + chunkSize, frameCount);
            for (let j = i; j < end; j++) {
                // Convert PCM Int16 to Float32
                channelData[j] = dataInt16[j * numChannels + channel] / 32768.0;
            }
            // Yield to the main thread to allow UI updates (typing, clicking)
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    return buffer;
}

// Plays base64 encoded audio using the Web Audio API and manages the audio source.
async function playAudio(
    base64Audio: string,
    audioContext: AudioContext,
    sourceRef: React.MutableRefObject<AudioBufferSourceNode | null>,
    onEnded?: () => void
): Promise<void> {
    try {
        // Optimization: Use fetch to decode base64 string to ArrayBuffer off the main thread
        // This avoids the CPU-heavy `atob` and manual loop for the initial decode
        const response = await fetch(`data:audio/pcm;base64,${base64Audio}`);
        const arrayBuffer = await response.arrayBuffer();

        const audioBuffer = await decodeAudioData(arrayBuffer, audioContext, 24000, 1);
        
        if (sourceRef.current) {
            try {
                sourceRef.current.stop();
            } catch (e) { /* ignore if already stopped */ }
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
            if (onEnded) onEnded();
        };
        sourceRef.current = source;
    } catch (error) {
        console.error("Error playing audio:", error);
        sourceRef.current = null;
        if (onEnded) onEnded(); // Ensure flow continues even on error
    }
}
// --- End Audio Utility Functions ---

// Helper to split text into manageable chunks for speech
function splitTextIntoChunks(text: string): string[] {
    // Clean up basic markdown which might confuse TTS or sound weird
    const cleanText = text.replace(/\*{1,2}/g, '');
    // Split by sentence ending punctuation (., !, ?) keeping the punctuation attached
    const result = cleanText.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g);
    return result ? result.map(s => s.trim()).filter(s => s.length > 0) : [cleanText];
}

const App: React.FC = () => {
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isVoiceOutputEnabled, setIsVoiceOutputEnabled] = useState(() => {
        try {
            const saved = localStorage.getItem(VOICE_ENABLED_KEY);
            return saved !== 'false'; // Default to true if not found or not 'false'
        } catch (error) {
            console.error('Failed to load voice setting:', error);
            return true;
        }
    });
    const [isConnectionsModalOpen, setIsConnectionsModalOpen] = useState(false);
    const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
    const [integrations, setIntegrations] = useState<ServiceIntegration[]>(INITIAL_INTEGRATIONS);
    const [isInitializing, setIsInitializing] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    // Renamed from isVeoKeyNeeded to covers both Veo and Imagen
    const [isProjectKeyNeeded, setIsProjectKeyNeeded] = useState(false);
    const [isLiveModeOpen, setIsLiveModeOpen] = useState(false);
    const [userMemory, setUserMemory] = useState<string[]>([]);

    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const profileRef = useRef<HTMLDivElement>(null);
    
    // Track the current speech generation request to handle cancellation
    const speechGenerationRef = useRef(0);

    // Load sessions and memory from localStorage on initial render
    useEffect(() => {
        try {
            const savedSessions = localStorage.getItem(CHAT_SESSIONS_KEY);
            if (savedSessions) {
                const sessions = JSON.parse(savedSessions) as ChatSession[];
                if (sessions.length > 0) {
                    setChatSessions(sessions);
                    // Set the most recently updated chat as active
                    setActiveChatId(sessions.sort((a, b) => b.lastUpdated - a.lastUpdated)[0].id);
                } else {
                    handleNewChat(); // Create a new chat if storage is empty
                }
            } else {
                handleNewChat(); // Create a new chat if no storage found
            }

            const savedMemory = localStorage.getItem(USER_MEMORY_KEY);
            if (savedMemory) {
                setUserMemory(JSON.parse(savedMemory));
            }
        } catch (error)
        {
            console.error('Failed to load chat history or memory:', error);
            handleNewChat(); // Start fresh if loading fails
        }
    }, []);

    // Save sessions to localStorage whenever they change
    useEffect(() => {
        // Avoid clearing storage on the initial empty state
        if (isInitializing && chatSessions.length === 0) return;
        try {
             if (chatSessions.length > 0) {
                localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(chatSessions));
            } else {
                // If there are no sessions, remove the key from storage
                localStorage.removeItem(CHAT_SESSIONS_KEY);
            }
        } catch (error) {
            console.error('Failed to save chat history:', error);
        }
    }, [chatSessions, isInitializing]);

    // Save memory to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem(USER_MEMORY_KEY, JSON.stringify(userMemory));
        } catch (error) {
            console.error('Failed to save user memory:', error);
        }
    }, [userMemory]);

    const activeChat = useMemo(() => {
        return chatSessions.find(chat => chat.id === activeChatId);
    }, [chatSessions, activeChatId]);

    const stopAudioInternal = useCallback(() => {
        speechGenerationRef.current += 1; // Invalidate any pending generation loops
        if (audioSourceRef.current) {
            try {
                audioSourceRef.current.stop();
            } catch (e) { /* Ignore errors if already stopped */ }
            audioSourceRef.current.disconnect();
            audioSourceRef.current = null;
        }
    }, []);
    
    useEffect(() => {
        try {
            localStorage.setItem(VOICE_ENABLED_KEY, String(isVoiceOutputEnabled));
        } catch (error) {
            console.error('Failed to save voice setting:', error);
        }
    }, [isVoiceOutputEnabled]);

    useEffect(() => {
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

        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

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
                // @ts-ignore
                if (window.aistudio && await window.aistudio.hasSelectedApiKey() === false) {
                    setIsProjectKeyNeeded(true);
                }
            } catch (error) {
                console.error("Failed to discover device accounts:", error);
            } finally {
                setIsInitializing(false);
            }
        };

        initializeApp();

        return () => {
            window.removeEventListener('click', resumeAudio, true);
            document.removeEventListener('mousedown', handleClickOutside);
            stopAudioInternal();
        };
    }, [stopAudioInternal]);

    const playAiSpeech = useCallback(async (text: string) => {
        if (!isVoiceOutputEnabled || !audioContextRef.current) return;
        
        // 1. Invalidate previous loops
        speechGenerationRef.current += 1;
        const currentGenId = speechGenerationRef.current;

        // 2. Split text into sentence chunks to minimize initial latency
        const chunks = splitTextIntoChunks(text);

        // 3. Sequential Playback Loop
        // This function plays chunk[i], and when done, triggers playLoop(i+1)
        const playLoop = async (index: number) => {
            if (index >= chunks.length) return;
            // Check if user cancelled/stopped during previous playback
            if (speechGenerationRef.current !== currentGenId) return;

            const chunkText = chunks[index];
            try {
                // Fetch audio for this specific chunk
                const base64Audio = await getAiSpeech(chunkText);
                
                // Check cancellation after async fetch
                if (speechGenerationRef.current !== currentGenId) return;

                if (base64Audio && audioContextRef.current) {
                    // Wrap playAudio in a Promise to await its completion
                    await new Promise<void>((resolve) => {
                         playAudio(base64Audio, audioContextRef.current!, audioSourceRef, resolve);
                    });
                } else {
                     // If fetch failed, skip to next immediately
                     playLoop(index + 1);
                     return;
                }
            } catch (error) {
                console.error("Failed to play speech chunk:", error);
                // Try next chunk even if this one failed
                playLoop(index + 1);
                return;
            }

            // Immediately start next chunk after current one finishes
            playLoop(index + 1);
        };

        // Start the chain
        playLoop(0);

    }, [isVoiceOutputEnabled]);
    
    const updateActiveChat = (updater: (prevMessages: ChatMessage[]) => ChatMessage[], chatId: string | null = activeChatId) => {
        setChatSessions(prevSessions =>
            prevSessions.map(session =>
                session.id === chatId
                    ? { ...session, messages: updater(session.messages), lastUpdated: Date.now() }
                    : session
            )
        );
    };

    const handleSendMessage = useCallback(async (text: string, media?: { type: 'image' | 'video' | 'audio', data: string }, options?: {aspectRatio?: string}) => {
        if (!text.trim() && !media) return;
        if (!activeChat) return;

        stopAudioInternal();
        const userMessage: ChatMessage = { author: 'user', text };
        if (media) {
            userMessage[media.type] = media.data;
        }
        updateActiveChat(prev => [...prev, userMessage]);
        setIsLoading(true);

        try {
            // Pass the current userMemory to the service to inject into the AI's system prompt
            const aiResponse = await getAiResponse(text, media, options, activeChat.messages, integrations, userMemory);
            const aiMessage: ChatMessage = { 
                author: 'ai', 
                text: aiResponse.text,
                generatedImage: aiResponse.generatedImage,
                generatedVideo: aiResponse.generatedVideo,
                groundingSources: aiResponse.groundingSources,
                requiresConsent: aiResponse.requiresConsent,
                action: aiResponse.action,
                requiresBillingProject: aiResponse.requiresBillingProject
            };
            
            if (aiResponse.requiresBillingProject) {
                setIsProjectKeyNeeded(true);
            }
            
            // Update Long-Term Memory if the AI learned new facts
            if (aiResponse.learnedFacts && aiResponse.learnedFacts.length > 0) {
                setUserMemory(prev => {
                    const newMemory = [...prev, ...(aiResponse.learnedFacts || [])];
                    // Remove duplicates just in case
                    return [...new Set(newMemory)];
                });
            }

            updateActiveChat(prev => [...prev, aiMessage]);
            
            if (!aiResponse.requiresConsent && !aiResponse.generatedImage && !aiResponse.generatedVideo && !aiResponse.requiresBillingProject) {
                // Do not await the speech generation so the UI unblocks immediately
                // The new playAiSpeech handles chunking internally
                playAiSpeech(aiResponse.text);
            }
        } catch (error: any) {
            console.error("Error getting AI response:", error);
            let errorText = "I'm sorry, I encountered an error.";
            if (error?.status === 503 || error?.code === 503 || error?.message?.includes('overloaded')) {
                errorText = "The AI service is currently overloaded. Please try again in a moment.";
            } else if (error?.status === 429 || error?.code === 429) {
                 errorText = "I'm receiving too many requests right now. Please wait a moment.";
            }
            const errorMessage: ChatMessage = { author: 'ai', text: errorText };
            updateActiveChat(prev => [...prev, errorMessage]);
            // Do not await error speech either
            playAiSpeech(errorMessage.text);
        } finally {
            setIsLoading(false);
        }
    }, [activeChat, integrations, stopAudioInternal, playAiSpeech, activeChatId, userMemory]);

    const handleConsent = useCallback(async (messageToApprove: ChatMessage) => {
        if (!messageToApprove.action || !activeChat) return;
        stopAudioInternal();
        
        updateActiveChat(prev => prev.map(m => m === messageToApprove ? { ...m, consentGranted: true, text: `${m.text}\n\n*Access granted. Proceeding...*` } : m));
        setIsLoading(true);

        const historyUpToConsentRequest = activeChat.messages.slice(0, activeChat.messages.indexOf(messageToApprove) + 1);

        try {
            const aiResponse = await getAiResponseAfterConsent(messageToApprove.action, historyUpToConsentRequest, integrations);
            const aiMessage: ChatMessage = { author: 'ai', text: aiResponse.text };
            updateActiveChat(prev => [...prev, aiMessage]);
            // Do not await the speech generation so the UI unblocks immediately
            playAiSpeech(aiResponse.text);
        } catch (error: any) {
            console.error("Error getting AI response after consent:", error);
            let errorText = "Thank you. However, I encountered an error while proceeding.";
             if (error?.status === 503 || error?.code === 503 || error?.message?.includes('overloaded')) {
                errorText = "The system is busy right now. Please try granting permission again in a moment.";
            }
            const errorMessage: ChatMessage = { author: 'ai', text: errorText };
            updateActiveChat(prev => [...prev, errorMessage]);
            // Do not await error speech
            playAiSpeech(errorMessage.text);
        } finally {
            setIsLoading(false);
        }
    }, [activeChat, integrations, stopAudioInternal, playAiSpeech, activeChatId]);

    const handleToggleVoice = useCallback(() => {
        setIsVoiceOutputEnabled(prev => {
            if (prev) stopAudioInternal();
            return !prev;
        });
    }, [stopAudioInternal]);

    const handleToggleIntegration = useCallback((id: string, accountId?: string) => {
        setIntegrations(prev => prev.map(int => {
            if (int.id !== id) return int;

            if (accountId && int.accounts) {
                const newAccounts = int.accounts.map(acc => 
                    acc.id === accountId ? { ...acc, connected: !acc.connected } : acc
                );
                const isAnyAccountConnected = newAccounts.some(acc => acc.connected);
                return { ...int, accounts: newAccounts, connected: isAnyAccountConnected };
            }

            return { ...int, connected: !int.connected };
        }));
    }, []);

    const handleSignIn = useCallback(async () => {
        try {
            const loggedInUser = await signInWithGoogle();
            setUser(loggedInUser);

            setIntegrations(prev => prev.map(int => {
                if (int.id === 'email' && int.accounts) {
                    const newAccounts = int.accounts.map(acc => 
                        acc.id === loggedInUser.email ? { ...acc, connected: true } : acc
                    );
                    const isAnyAccountConnected = newAccounts.some(acc => acc.connected);
                    return { ...int, accounts: newAccounts, connected: isAnyAccountConnected };
                }
                if (int.id === 'calendar') {
                    return { ...int, connected: true };
                }
                return int;
            }));
            setIsProfileOpen(false);
        } catch (error) {
            console.error("Sign in failed:", error);
        }
    }, []);

    const handleSignOut = useCallback(async () => {
        try {
            await signOut();
            const loggedOutEmail = user?.email;
            setUser(null);

            setIntegrations(prev => prev.map(int => {
                if (int.id === 'email' && int.accounts && loggedOutEmail) {
                     const newAccounts = int.accounts.map(acc => 
                        acc.id === loggedOutEmail ? { ...acc, connected: false } : acc
                    );
                    const isAnyAccountConnected = newAccounts.some(acc => acc.connected);
                    return { ...int, accounts: newAccounts, connected: isAnyAccountConnected };
                }
                if (int.id === 'calendar') {
                    return { ...int, connected: false };
                }
                return int;
            }));
            setIsProfileOpen(false);
        } catch (error) {
            console.error("Sign out failed:", error);
        }
    }, [user]);

    const handleNewChat = useCallback(() => {
        const newChat: ChatSession = {
            id: Date.now().toString(),
            lastUpdated: Date.now(),
            messages: [],
        };
        setChatSessions(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
        setIsHistoryPanelOpen(false);
    }, []);

    const handleSelectChat = useCallback((id: string) => {
        setActiveChatId(id);
        setIsHistoryPanelOpen(false);
    }, []);

    const handleDeleteChat = useCallback((idToDelete: string) => {
        setChatSessions(prev => {
            const remainingSessions = prev.filter(s => s.id !== idToDelete);
            if (activeChatId === idToDelete) {
                if (remainingSessions.length > 0) {
                    setActiveChatId(remainingSessions.sort((a, b) => b.lastUpdated - a.lastUpdated)[0].id);
                }
            }
            return remainingSessions;
        });
    }, [activeChatId]);
    
    useEffect(() => {
        if (!isInitializing && chatSessions.length === 0) {
            handleNewChat();
        }
    }, [chatSessions, isInitializing, handleNewChat]);

    const handleClearHistory = useCallback(() => {
        setChatSessions([]); 
        setActiveChatId(null);
        setIsHistoryPanelOpen(false);
    }, []);
    
    const handleSelectProjectKey = async () => {
        // @ts-ignore
        if (window.aistudio) {
            // @ts-ignore
            await window.aistudio.openSelectKey();
            setIsProjectKeyNeeded(false);
            // We can optionally add a message to the chat to inform the user to try again
             const infoMessage: ChatMessage = { author: 'ai', text: "Your project has been configured. Please try your generation request again." };
            updateActiveChat(prev => [...prev, infoMessage]);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-900 text-slate-100 p-4 md:p-6 overflow-hidden">
            <ChatHistoryPanel 
                isOpen={isHistoryPanelOpen}
                onClose={() => setIsHistoryPanelOpen(false)}
                sessions={chatSessions}
                activeSessionId={activeChatId}
                onSelectSession={handleSelectChat}
                onNewSession={handleNewChat}
                onDeleteSession={handleDeleteChat}
                onClearAllSessions={handleClearHistory}
            />
            <header className="flex-shrink-0 flex items-center justify-center text-center py-4 relative">
                <div className="absolute top-2 left-2 flex items-center gap-2">
                     <button
                        onClick={() => setIsHistoryPanelOpen(true)}
                        className="p-2 rounded-full text-slate-400 hover:text-cyan-400 hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        aria-label="View chat history"
                        title="View chat history"
                    >
                        <HistoryIcon />
                    </button>
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
                <div className="absolute top-2 right-2 flex items-center gap-4">
                    {user ? (
                        <div className="relative" ref={profileRef}>
                            <button
                                onClick={() => setIsProfileOpen(p => !p)}
                                className="w-9 h-9 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500"
                                aria-label="Open user menu"
                                aria-expanded={isProfileOpen}
                            >
                                <img src={user.avatar} alt="User avatar" className="rounded-full" />
                            </button>
                            {isProfileOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-1 z-10 animate-fade-in">
                                    <div className="px-3 py-2 border-b border-slate-700">
                                        <p className="text-sm font-semibold text-slate-200 truncate">{user.name}</p>
                                        <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                    </div>
                                    <button
                                        onClick={handleSignOut}
                                        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                         <button
                            onClick={handleSignIn}
                            className="flex items-center gap-2 bg-white text-slate-800 font-semibold px-3 py-1.5 rounded-lg text-sm hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-white disabled:opacity-50 disabled:cursor-wait"
                            aria-label="Sign in with Google"
                            disabled={isInitializing}
                        >
                            <GoogleIcon />
                            <span>Sign In</span>
                        </button>
                    )}
                    <button
                        onClick={() => setIsLiveModeOpen(true)}
                        className="p-2 rounded-full text-slate-400 hover:text-cyan-400 hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        aria-label="Start Live Conversation"
                        title="Start Live Conversation"
                    >
                        <ConversationModeIcon />
                    </button>
                    <VoiceToggle isEnabled={isVoiceOutputEnabled} onToggle={handleToggleVoice} disabled={!audioContextRef.current} />
                </div>
                <div className="flex flex-col items-center">
                    <Orb isLoading={isLoading} />
                    <h1 className="text-2xl md:text-3xl font-bold mt-4 text-slate-200 tracking-tight">Nanda's assistant</h1>
                    <p className="text-sm md:text-base text-slate-400">Your personal assistant for life.</p>
                </div>
            </header>
            
            <main className="flex-1 flex flex-col min-h-0">
                <ChatInterface
                    key={activeChatId} // Force re-mount on chat switch to clear state
                    messages={activeChat?.messages || []}
                    isLoading={isLoading}
                    onSendMessage={handleSendMessage}
                    onConsent={handleConsent}
                    isProjectKeyNeeded={isProjectKeyNeeded}
                    onSelectProjectKey={handleSelectProjectKey}
                />
            </main>
            
            <ConnectionsModal 
                isOpen={isConnectionsModalOpen} 
                onClose={() => setIsConnectionsModalOpen(false)}
                integrations={integrations}
                onToggle={handleToggleIntegration}
            />
            <LiveConversationModal
                isOpen={isLiveModeOpen}
                onClose={() => setIsLiveModeOpen(false)}
            />
        </div>
    );
};

export default App;
