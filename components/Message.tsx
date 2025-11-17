
import React from 'react';
import { type MessageAuthor, type GroundingSource, type GeneratedVideo } from '../types';

interface MessageProps {
    author: MessageAuthor;
    text: string;
    image?: string;
    video?: string;
    audio?: string;
    generatedImage?: string;
    generatedVideo?: GeneratedVideo;
    groundingSources?: GroundingSource[];
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

const MediaGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="grid grid-cols-1 gap-2 mt-2">{children}</div>
);

const GroundingSources: React.FC<{ sources: GroundingSource[] }> = ({ sources }) => (
    <div className="mt-3 border-t border-slate-600 pt-2">
        <h4 className="text-xs font-semibold text-slate-400 mb-1">Sources:</h4>
        <div className="flex flex-wrap gap-2">
            {sources.map((source, index) => (
                <a 
                    key={index}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-slate-600/50 text-cyan-300 rounded-md px-2 py-1 hover:bg-slate-600 transition-colors truncate"
                >
                    {source.title || new URL(source.uri).hostname}
                </a>
            ))}
        </div>
    </div>
);

export const Message: React.FC<MessageProps> = ({ author, text, image, video, audio, generatedImage, generatedVideo, groundingSources, isLoading = false }) => {
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
                    <div className="space-y-2">
                         <MediaGrid>
                            {image && <img src={image} alt="User upload" className="rounded-lg max-w-xs md:max-w-sm" />}
                            {video && <video src={video} controls className="rounded-lg max-w-xs md:max-w-sm" />}
                            {audio && <audio src={audio} controls className="w-full" />}
                            {generatedImage && <img src={generatedImage} alt="AI generated" className="rounded-lg max-w-xs md:max-w-sm" />}
                            {generatedVideo?.state === 'generating' && (
                                <div className="p-4 text-center bg-slate-800/50 rounded-lg">
                                    <p className="text-sm text-slate-300 animate-pulse">Generating video...</p>
                                    <p className="text-xs text-slate-400 mt-1">This may take a few minutes.</p>
                                </div>
                            )}
                             {generatedVideo?.state === 'ready' && generatedVideo.url && (
                                <video src={generatedVideo.url} controls className="rounded-lg max-w-xs md:max-w-sm" />
                            )}
                            {generatedVideo?.state === 'error' && (
                                 <div className="p-3 text-center bg-red-900/50 border border-red-700 rounded-lg">
                                    <p className="text-sm text-red-300">Video generation failed.</p>
                                </div>
                            )}
                        </MediaGrid>
                        {text && <p className="text-slate-200 whitespace-pre-wrap">{text}</p>}
                        {groundingSources && groundingSources.length > 0 && <GroundingSources sources={groundingSources} />}
                    </div>
                )}
            </div>
        </div>
    );
};

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
