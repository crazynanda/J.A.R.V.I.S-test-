
import React, { useState, useRef, useEffect } from 'react';
import { CameraIcon, ImageIcon } from './icons';
import { CameraView } from './CameraView';

interface InputBarProps {
    onSendMessage: (text: string, media?: {type: 'image' | 'video' | 'audio', data: string}, options?: {aspectRatio?: string}) => void;
    isLoading: boolean;
}

declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}


export const InputBar: React.FC<InputBarProps> = ({ onSendMessage, isLoading }) => {
    const [inputValue, setInputValue] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [isSupported, setIsSupported] = useState(false);
    const [micError, setMicError] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);
    const isAbortingRef = useRef<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [capturedMedia, setCapturedMedia] = useState<{type: 'image' | 'video' | 'audio', data: string} | null>(null);
    const [aspectRatio, setAspectRatio] = useState('1:1');

    useEffect(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognitionAPI) {
            setIsSupported(true);
            const recognition = new SpeechRecognitionAPI();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onstart = () => { setIsRecording(true); setMicError(null); isAbortingRef.current = false; };
            recognition.onend = () => { setIsRecording(false); isAbortingRef.current = false; };
            recognition.onerror = (event: any) => {
                let errorMessage;
                switch (event.error) {
                    case 'not-allowed': errorMessage = "Microphone access denied."; break;
                    case 'audio-capture': errorMessage = "No microphone detected."; break;
                    default: errorMessage = "An unexpected error occurred with voice input."; break;
                }
                if (errorMessage) setMicError(errorMessage);
                setIsRecording(false);
            };
            recognition.onresult = (event: any) => {
                if (isAbortingRef.current) return;
                const transcript = Array.from(event.results).map((result: any) => result[0]).map((result: any) => result.transcript).join('');
                setInputValue(transcript);
            };
            recognitionRef.current = recognition;
        } else {
            setIsSupported(false);
        }

        return () => {
            if (recognitionRef.current) recognitionRef.current.abort();
        };
    }, []);

    const handleMicClick = () => {
        if (isLoading || !recognitionRef.current) return;
        if (isRecording) {
            recognitionRef.current.stop();
        } else {
            setInputValue('');
            try {
                recognitionRef.current.start();
            } catch (error) {
                setMicError("Could not start voice input.");
            }
        }
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if ((inputValue.trim() || capturedMedia) && !isLoading) {
            onSendMessage(inputValue, capturedMedia ?? undefined, { aspectRatio });
            setInputValue('');
            setCapturedMedia(null);
            if (isRecording && recognitionRef.current) {
                recognitionRef.current.stop();
            }
        }
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        if (micError) setMicError(null);
        if (isRecording && recognitionRef.current) {
            isAbortingRef.current = true;
            recognitionRef.current.abort();
        }
    };
    
    const handleCapture = (imageDataUrl: string) => {
        setCapturedMedia({ type: 'image', data: imageDataUrl });
        setIsCameraOpen(false);
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const fileType = file.type.split('/')[0] as 'image' | 'video' | 'audio';
            if (!['image', 'video', 'audio'].includes(fileType)) {
                console.error("Invalid file type.");
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                if (typeof e.target?.result === 'string') {
                    setCapturedMedia({ type: fileType, data: e.target.result });
                }
            };
            reader.readAsDataURL(file);
        }
        if (event.target) event.target.value = '';
    };

    const micButtonClasses = `p-2 transition-colors disabled:opacity-50 ${ isRecording ? "text-cyan-400 animate-pulse" : "text-slate-400 hover:text-cyan-400" }`;

    return (
        <div>
            {capturedMedia && (
                <div className="relative inline-block mb-2">
                    {capturedMedia.type === 'image' && <img src={capturedMedia.data} alt="capture preview" className="h-16 w-16 rounded-lg object-cover" />}
                    {capturedMedia.type === 'video' && <video src={capturedMedia.data} className="h-16 w-16 rounded-lg object-cover" />}
                     {capturedMedia.type === 'audio' && <div className="h-16 w-16 rounded-lg bg-slate-700 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg></div>}
                    <button onClick={() => setCapturedMedia(null)} className="absolute -top-2 -right-2 bg-slate-700 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold hover:bg-red-500 transition-colors" aria-label="Remove media" > &times; </button>
                </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                 <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*,audio/*" className="hidden" aria-hidden="true"/>
                 <button type="button" onClick={handleUploadClick} disabled={isLoading} className="p-2 text-slate-400 hover:text-cyan-400 transition-colors disabled:opacity-50" aria-label="Upload file" > <ImageIcon /> </button>
                 <button type="button" onClick={() => setIsCameraOpen(true)} disabled={isLoading} className="p-2 text-slate-400 hover:text-cyan-400 transition-colors disabled:opacity-50" aria-label="Open camera"> <CameraIcon /> </button>
                <button type="button" onClick={handleMicClick} disabled={isLoading || !isSupported} className={micButtonClasses} aria-label={isRecording ? "Stop recording" : "Start recording"} >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill={isRecording ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /> </svg>
                </button>
                <input type="text" value={inputValue} onChange={handleInputChange} placeholder={capturedMedia ? "Describe what you want to do..." : (isRecording ? "Listening..." : "Ask Nanda's assistant anything...")} disabled={isLoading} className="flex-1 bg-slate-900/80 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all" />
                <button type="submit" disabled={isLoading || (!inputValue.trim() && !capturedMedia)} className="bg-cyan-500 text-white font-semibold rounded-lg px-4 py-2 hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed" > Send </button>
            </form>
            {micError && <p className="text-red-400 text-xs text-center mt-2" role="alert">{micError}</p>}
            <CameraView isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCapture} />
        </div>
    );
};