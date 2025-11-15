
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Orb } from './components/Orb';
import { ChatInterface } from './components/ChatInterface';
import { SuggestedPrompts } from './components/SuggestedPrompts';
import { type ChatMessage } from './types';
import { getAiResponse } from './services/geminiService';

const App: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { author: 'ai', text: "Hello. I'm Flowen, your personal AI assistant. How can I help you organize your day?" }
    ]);
    const [isLoading, setIsLoading] = useState(false);

    const handleSendMessage = useCallback(async (text: string) => {
        if (!text.trim()) return;

        const userMessage: ChatMessage = { author: 'user', text };
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        try {
            const aiResponseText = await getAiResponse(text, messages);
            const aiMessage: ChatMessage = { author: 'ai', text: aiResponseText };
            setMessages(prev => [...prev, aiMessage]);
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
    }, [messages]);

    return (
        <div className="flex flex-col h-screen bg-slate-900 text-slate-100 p-4 md:p-6 overflow-hidden">
            <header className="flex-shrink-0 flex flex-col items-center justify-center text-center py-4">
                <Orb isLoading={isLoading} />
                <h1 className="text-2xl md:text-3xl font-bold mt-4 text-slate-200 tracking-tight">Flowen</h1>
                <p className="text-sm md:text-base text-slate-400">Your personal Jarvis for life.</p>
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
