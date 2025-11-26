
import React, { useRef, useEffect } from 'react';
import { type ChatMessage } from '../types';
import { Message } from './Message';
import { InputBar } from './InputBar';

interface ChatInterfaceProps {
    messages: ChatMessage[];
    isLoading: boolean;
    onSendMessage: (text: string, media?: {type: 'image' | 'video' | 'audio', data: string}, options?: {aspectRatio?: string}) => void;
    onConsent: (message: ChatMessage) => void;
    isProjectKeyNeeded: boolean;
    onSelectProjectKey: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isLoading, onSendMessage, onConsent, isProjectKeyNeeded, onSelectProjectKey }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    return (
        <div className="flex flex-col flex-1 bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50">
            <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-2">
                {isProjectKeyNeeded && (
                     <div className="bg-blue-900/50 border border-blue-700 text-blue-200 px-4 py-3 rounded-lg relative text-sm flex items-center justify-between gap-4" role="alert">
                        <div>
                            <strong className="font-bold">Project required for this feature. </strong>
                            <span className="block sm:inline">Please select a project to enable Image or Video generation.</span>
                            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline ml-1 hover:text-white">Learn about billing.</a>
                        </div>
                        <button onClick={onSelectProjectKey} className="bg-blue-500 text-white font-semibold rounded-lg px-4 py-2 hover:bg-blue-600 transition-colors flex-shrink-0">
                            Select Project
                        </button>
                    </div>
                )}
                {messages.map((msg, index) => (
                    <div key={index}>
                        <Message 
                            author={msg.author} 
                            text={msg.text} 
                            image={msg.image} 
                            video={msg.video}
                            audio={msg.audio}
                            generatedImage={msg.generatedImage} 
                            generatedVideo={msg.generatedVideo}
                            groundingSources={msg.groundingSources}
                        />
                        {msg.author === 'ai' && msg.requiresConsent && !msg.consentGranted && (
                            <div className="flex justify-start pl-11 pt-2 animate-fade-in">
                                <button 
                                    onClick={() => onConsent(msg)}
                                    disabled={isLoading}
                                    className="text-sm font-semibold bg-cyan-500 text-white rounded-lg px-4 py-2 hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-cyan-500 transition-colors disabled:bg-slate-600"
                                >
                                    Grant Access & Proceed
                                </button>
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && messages[messages.length-1]?.author === 'user' && (
                     <Message author="ai" text="..." isLoading={true} />
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 bg-slate-800/70 border-t border-slate-700/50 flex-shrink-0">
                <InputBar onSendMessage={onSendMessage} isLoading={isLoading} />
            </div>
        </div>
    );
};
