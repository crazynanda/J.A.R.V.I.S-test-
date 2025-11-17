
import React from 'react';
import { type ChatSession } from '../types';
import { NewChatIcon, TrashIcon } from './icons';

interface ChatHistoryPanelProps {
    isOpen: boolean;
    onClose: () => void;
    sessions: ChatSession[];
    activeSessionId: string | null;
    onSelectSession: (id: string) => void;
    onNewSession: () => void;
    onDeleteSession: (id: string) => void;
    onClearAllSessions: () => void;
}

export const ChatHistoryPanel: React.FC<ChatHistoryPanelProps> = ({ 
    isOpen, onClose, sessions, activeSessionId, onSelectSession, onNewSession, onDeleteSession, onClearAllSessions
}) => {
    if (!isOpen) return null;

    const sortedSessions = [...sessions].sort((a, b) => b.lastUpdated - a.lastUpdated);

    const getTitle = (session: ChatSession) => {
        // Find the first user message to use as a title, skipping the initial AI message
        const firstUserMessage = session.messages.find(m => m.author === 'user');
        return firstUserMessage?.text.substring(0, 40) || 'New Chat';
    };

    const handleClearAll = () => {
        if (window.confirm('Are you sure you want to delete all conversation history? This action cannot be undone.')) {
            onClearAllSessions();
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
                onClick={onClose}
                aria-hidden="true"
            ></div>

            {/* Panel */}
            <aside 
                className={`fixed top-0 left-0 h-full w-72 bg-slate-800/90 border-r border-slate-700 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="history-title"
            >
                <header className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h2 id="history-title" className="text-lg font-bold text-slate-200">Chat History</h2>
                    <button 
                        onClick={onNewSession} 
                        className="p-2 rounded-full text-slate-300 hover:bg-slate-700 hover:text-cyan-400 transition-colors"
                        aria-label="Start new chat"
                        title="Start new chat"
                    >
                        <NewChatIcon />
                    </button>
                </header>

                <nav className="p-2 overflow-y-auto flex-1">
                    <ul className="space-y-1">
                        {sortedSessions.map(session => (
                            <li key={session.id}>
                                <button 
                                    onClick={() => onSelectSession(session.id)}
                                    className={`w-full text-left p-3 rounded-lg flex items-center justify-between group transition-colors ${
                                        activeSessionId === session.id ? 'bg-cyan-500/20' : 'hover:bg-slate-700/50'
                                    }`}
                                >
                                    <span className="text-sm text-slate-200 truncate pr-2">
                                        {getTitle(session)}...
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevent session selection
                                            onDeleteSession(session.id);
                                        }}
                                        className="p-1 rounded-md text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all focus:opacity-100"
                                        aria-label={`Delete chat "${getTitle(session)}"`}
                                    >
                                        <TrashIcon />
                                    </button>
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>
                <footer className="p-4 border-t border-slate-700">
                    <button
                        onClick={handleClearAll}
                        className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-sm text-red-400 hover:bg-red-500/20 transition-colors"
                        aria-label="Clear all chat history"
                    >
                        <TrashIcon className="h-4 w-4" />
                        <span>Clear All History</span>
                    </button>
                </footer>
            </aside>
        </>
    );
};
