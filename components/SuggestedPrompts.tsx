import React from 'react';

interface SuggestedPromptsProps {
    onPromptClick: (prompt: string) => void;
    disabled: boolean;
}

const prompts = [
    "Give me a morning briefing.",
    "Summarize my unread emails.",
    "Draft a reply to Alex about the meeting.",
    "My energy is low, any suggestions?",
];

const PromptButton: React.FC<{text: string, onClick: () => void, disabled: boolean}> = ({ text, onClick, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="text-sm bg-slate-800/80 border border-slate-700 rounded-full px-4 py-2 text-slate-300 hover:bg-slate-700/80 hover:border-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
        {text}
    </button>
);

export const SuggestedPrompts: React.FC<SuggestedPromptsProps> = ({ onPromptClick, disabled }) => {
    return (
        <div className="flex flex-wrap items-center justify-center gap-2">
            {prompts.map((prompt) => (
                <PromptButton 
                    key={prompt}
                    text={prompt}
                    onClick={() => onPromptClick(prompt)}
                    disabled={disabled}
                />
            ))}
        </div>
    );
};
