
import React, { useState, useRef, useEffect } from 'react';

interface InputBarProps {
    onSendMessage: (text: string) => void;
    isLoading: boolean;
}

// For TypeScript: Add type definitions for the Web Speech API
// This avoids errors if the types are not included in the standard lib.
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

    useEffect(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognitionAPI) {
            setIsSupported(true);
            const recognition = new SpeechRecognitionAPI();
            recognition.continuous = true; // Allow for longer, continuous dictation
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                setIsRecording(true);
                setMicError(null); // Clear any previous errors on successful start
            };

            recognition.onend = () => {
                setIsRecording(false);
            };

            recognition.onerror = (event: any) => {
                let errorMessage;
                switch (event.error) {
                    case 'not-allowed':
                        errorMessage = "Microphone access denied. Please enable it in your browser settings to use voice input.";
                        break;
                    case 'audio-capture':
                        errorMessage = "No microphone detected. Please ensure your microphone is connected and working.";
                        break;
                    case 'network':
                        errorMessage = "A network error occurred during speech recognition. Please check your connection.";
                        break;
                    case 'service-not-allowed':
                        errorMessage = "Speech recognition service is unavailable. Please try again later.";
                        break;
                    case 'no-speech':
                        // This fires if the user is silent. We can just stop recording without showing an error.
                        break;
                    default:
                        console.error("Speech recognition error:", event.error);
                        errorMessage = "An unexpected error occurred with voice input.";
                        break;
                }
                if (errorMessage) {
                    setMicError(errorMessage);
                }
                setIsRecording(false);
            };

            recognition.onresult = (event: any) => {
                // Stitch together the full transcript from all results
                const transcript = Array.from(event.results)
                    .map((result: any) => result[0])
                    .map((result: any) => result.transcript)
                    .join('');
                setInputValue(transcript);
            };

            recognitionRef.current = recognition;
        } else {
            console.warn("Speech Recognition API not supported in this browser.");
            setIsSupported(false);
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, []);

    const handleMicClick = () => {
        if (isLoading || !recognitionRef.current) return;

        if (isRecording) {
            recognitionRef.current.stop();
        } else {
            setInputValue(''); // Clear previous text before starting a new dictation
            try {
                recognitionRef.current.start();
            } catch (error) {
                console.error("Could not start speech recognition:", error);
                setMicError("Could not start voice input. Please try again.");
            }
        }
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && !isLoading) {
            onSendMessage(inputValue);
            setInputValue('');
            if (isRecording && recognitionRef.current) {
                recognitionRef.current.stop();
            }
        }
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        if (micError) {
            setMicError(null); // Clear error when user types
        }
        // If the user starts typing, stop the recording to allow for manual editing.
        // This provides a seamless way to correct the dictated text.
        if (isRecording && recognitionRef.current) {
            recognitionRef.current.stop();
        }
    };

    const micButtonClasses = `p-2 transition-colors disabled:opacity-50 ${
        isRecording 
        ? "text-cyan-400 animate-pulse" 
        : "text-slate-400 hover:text-cyan-400"
    }`;

    return (
        <div>
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <button 
                    type="button" 
                    onClick={handleMicClick}
                    disabled={isLoading || !isSupported}
                    className={micButtonClasses}
                    aria-label={isRecording ? "Stop recording" : "Start recording"}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                </button>
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder={isRecording ? "Listening..." : "Ask J.A.R.V.I.S anything..."}
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
            {micError && (
                <p className="text-red-400 text-xs text-center mt-2" role="alert">
                    {micError}
                </p>
            )}
        </div>
    );
};
