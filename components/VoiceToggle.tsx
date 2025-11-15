
import React from 'react';

interface VoiceToggleProps {
    isEnabled: boolean;
    onToggle: () => void;
    disabled?: boolean;
}

const SpeakerOnIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
);

const SpeakerOffIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9l-6 6M11 9l6 6" />
    </svg>
);

export const VoiceToggle: React.FC<VoiceToggleProps> = ({ isEnabled, onToggle, disabled }) => {
    return (
        <button
            onClick={onToggle}
            disabled={disabled}
            className="p-2 rounded-full text-slate-400 hover:text-cyan-400 hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={isEnabled ? "Disable voice output" : "Enable voice output"}
            title={isEnabled ? "Disable voice output" : "Enable voice output"}
        >
            {isEnabled ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
        </button>
    );
};
