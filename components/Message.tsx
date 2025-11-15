
import React from 'react';
import { type MessageAuthor } from '../types';

interface MessageProps {
    author: MessageAuthor;
    text: string;
    isLoading?: boolean;
}

const UserIcon: React.FC = () => (
    <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center font-bold text-white flex-shrink-0">
        U
    </div>
);

const AiIcon: React.FC = () => (
    <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-white flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
        </svg>
    </div>
);


export const Message: React.FC<MessageProps> = ({ author, text, isLoading = false }) => {
    const isUser = author === 'user';
    
    const containerClasses = `flex items-start gap-3 max-w-xl animate-fade-in ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`;
    const bubbleClasses = `px-4 py-3 rounded-2xl ${isUser ? 'bg-violet-600 rounded-br-md' : 'bg-slate-700 rounded-bl-md'}`;

    return (
        <div className={containerClasses}>
            {isUser ? <UserIcon /> : <AiIcon />}
            <div className={bubbleClasses}>
                {isLoading ? (
                    <div className="flex items-center space-x-1">
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></span>
                    </div>
                ) : (
                    <p className="text-slate-200 whitespace-pre-wrap">{text}</p>
                )}
            </div>
        </div>
    );
};

// Add fade-in animation to tailwind config (or in a style tag for simplicity here)
// In a real project this would go into tailwind.config.js
if (typeof window !== 'undefined') {
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fadeIn 0.3s ease-out forwards;
        }
    `;
    document.head.appendChild(style);
}
