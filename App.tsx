
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
    const [isVeoKeyNeeded, setIsVeoKeyNeeded] = useState(false);
    const [isLiveModeOpen, setIsLiveModeOpen] = useState(false);

    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const profileRef = useRef<HTMLDivElement>(null);

    // Load sessions from localStorage on initial render
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
        } catch (error)
        {
            console.error('Failed to load chat history:', error);
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

    const activeChat = useMemo(() => {
        return chatSessions.find(chat => chat.id === activeChatId);
    }, [chatSessions, activeChatId]);

    const stopAudioInternal = useCallback(() => {
        if (audioSourceRef.current) {
            try {
                audioSourceRef.current.stop();
            } catch (e) { /* Ignore errors */ }
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
                    setIsVeoKeyNeeded(true);
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
        try {
            const base64Audio = await getAiSpeech(text);
            if (base64Audio && audioContextRef.current) {
                await playAudio(base64Audio, audioContextRef.current, audioSourceRef);
            }
        } catch (error) {
            console.error("Failed to play AI speech:", error);
        }
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
            const aiResponse = await getAiResponse(text, media, options, activeChat.messages, integrations);
            const aiMessage: ChatMessage = { 
                author: 'ai', 
                text: aiResponse.text,
                generatedImage: aiResponse.generatedImage,
                generatedVideo: aiResponse.generatedVideo,
                groundingSources: aiResponse.groundingSources,
                requiresConsent: aiResponse.requiresConsent,
                action: aiResponse.action,
            };
            updateActiveChat(prev => [...prev, aiMessage]);
            
            if (!aiResponse.requiresConsent && !aiResponse.generatedImage && !aiResponse.generatedVideo) {
                await playAiSpeech(aiResponse.text);
            }
        } catch (error) {
            console.error("Error getting AI response:", error);
            const errorMessage: ChatMessage = { author: 'ai', text: "I'm sorry, I encountered an error." };
            updateActiveChat(prev => [...prev, errorMessage]);
            await playAiSpeech(errorMessage.text);
        } finally {
            setIsLoading(false);
        }
    }, [activeChat, integrations, stopAudioInternal, playAiSpeech, activeChatId]);

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
            await playAiSpeech(aiResponse.text);
        } catch (error) {
            console.error("Error getting AI response after consent:", error);
            const errorMessage: ChatMessage = { author: 'ai', text: "Thank you. However, I encountered an error while proceeding." };
            updateActiveChat(prev => [...prev, errorMessage]);
            await playAiSpeech(errorMessage.text);
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
    
    const handleSelectVeoKey = async () => {
        // @ts-ignore
        if (window.aistudio) {
            // @ts-ignore
            await window.aistudio.openSelectKey();
            setIsVeoKeyNeeded(false);
            // We can optionally add a message to the chat to inform the user to try again
             const infoMessage: ChatMessage = { author: 'ai', text: "Your project has been configured. Please try your video generation request again." };
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
                    isVeoKeyNeeded={isVeoKeyNeeded}
                    onSelectVeoKey={handleSelectVeoKey}
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