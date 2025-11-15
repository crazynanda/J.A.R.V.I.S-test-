
import React, { useState } from 'react';

interface InputBarProps {
    onSendMessage: (text: string) => void;
    isLoading: boolean;
}

export const InputBar: React.FC<InputBarProps> = ({ onSendMessage, isLoading }) => {
    const [inputValue, setInputValue] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && !isLoading) {
            onSendMessage(inputValue);
            setInputValue('');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <button type="button" className="p-2 text-slate-400 hover:text-cyan-400 transition-colors disabled:opacity-50" disabled>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
            </button>
            <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask Flowen anything..."
                disabled={isLoading}
                className="flex-1 bg-slate-900/80 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
            />
            <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="bg-cyan-500 text-white font-semibold rounded-lg px-4 py-2 hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
            >
                Send
            </button>
        </form>
    );
};
