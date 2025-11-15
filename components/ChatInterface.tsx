
import React, { useRef, useEffect } from 'react';
import { type ChatMessage } from '../types';
import { Message } from './Message';
import { InputBar } from './InputBar';

interface ChatInterfaceProps {
    messages: ChatMessage[];
    isLoading: boolean;
    onSendMessage: (text: string) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isLoading, onSendMessage }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    return (
        <div className="flex flex-col flex-1 bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50">
            <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4">
                {messages.map((msg, index) => (
                    <Message key={index} author={msg.author} text={msg.text} />
                ))}
                {isLoading && messages[messages.length-1]?.author === 'user' && (
                     <Message author="ai" text="..." isLoading={true} />
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 bg-slate-800/70 border-t border-slate-700/50">
                <InputBar onSendMessage={onSendMessage} isLoading={isLoading} />
            </div>
        </div>
    );
};
