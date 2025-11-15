
import React from 'react';

interface OrbProps {
    isLoading: boolean;
}

export const Orb: React.FC<OrbProps> = ({ isLoading }) => {
    const orbBaseClasses = "relative w-24 h-24 md:w-28 md:h-28 rounded-full transition-all duration-500";
    const orbPulseClasses = isLoading ? 'animate-pulse scale-105' : '';
    
    return (
        <div className={`${orbBaseClasses} ${orbPulseClasses}`}>
            {/* Inner Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-violet-500 rounded-full blur-xl opacity-50"></div>
            {/* Core Orb */}
            <div className="absolute inset-1 bg-slate-800 rounded-full"></div>
            {/* Surface Shine */}
            <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-white/20 to-transparent rounded-full opacity-30 transform -rotate-45"></div>
            {/* Thinking Animation */}
            {isLoading && (
                 <div className="absolute inset-0 border-2 border-cyan-300/50 rounded-full animate-spin [animation-duration:3s]"></div>
            )}
        </div>
    );
};
