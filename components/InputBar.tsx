import React, { useState, useRef, useEffect } from 'react';
import { CameraIcon, ImageIcon } from './icons';
import { CameraView } from './CameraView';

interface InputBarProps {
    onSendMessage: (text: string, image?: string) => void;
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
    const isAbortingRef = useRef<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);


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
                isAbortingRef.current = false; // Reset abort flag on new session
            };

            recognition.onend = () => {
                setIsRecording(false);
                isAbortingRef.current = false; // Reset abort flag
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
                // If we've flagged for abort, ignore any trailing results
                if (isAbortingRef.current) return;

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
        if ((inputValue.trim() || capturedImage) && !isLoading) {
            onSendMessage(inputValue, capturedImage ?? undefined);
            setInputValue('');
            setCapturedImage(null);
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
        // If the user starts typing, abort the recording to allow for manual editing.
        // This provides a seamless way to correct the dictated text without overwriting.
        if (isRecording && recognitionRef.current) {
            isAbortingRef.current = true; // Set flag to ignore any further results
            recognitionRef.current.abort();
        }
    };
    
    const handleCapture = (imageDataUrl: string) => {
        setCapturedImage(imageDataUrl);
        setIsCameraOpen(false);
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                console.error("Invalid file type. Please upload an image.");
                // Optionally set an error state to show in the UI
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                if (typeof e.target?.result === 'string') {
                    setCapturedImage(e.target.result);
                }
            };
            reader.readAsDataURL(file);
        }
        // Reset file input value to allow re-uploading the same file
        if (event.target) {
            event.target.value = '';
        }
    };

    const micButtonClasses = `p-2 transition-colors disabled:opacity-50 ${
        isRecording 
        ? "text-cyan-400 animate-pulse" 
        : "text-slate-400 hover:text-cyan-400"
    }`;

    return (
        <div>
            {capturedImage && (
                <div className="relative inline-block mb-2">
                    <img src={capturedImage} alt="capture preview" className="h-16 w-16 rounded-lg object-cover" />
                    <button
                        onClick={() => setCapturedImage(null)}
                        className="absolute -top-2 -right-2 bg-slate-700 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold hover:bg-red-500 transition-colors"
                        aria-label="Remove image"
                    >
                        &times;
                    </button>
                </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                 <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                    aria-hidden="true"
                 />
                 <button
                    type="button"
                    onClick={handleUploadClick}
                    disabled={isLoading}
                    className="p-2 text-slate-400 hover:text-cyan-400 transition-colors disabled:opacity-50"
                    aria-label="Upload image"
                 >
                    <ImageIcon />
                </button>
                 <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    disabled={isLoading}
                    className="p-2 text-slate-400 hover:text-cyan-400 transition-colors disabled:opacity-50"
                    aria-label="Open camera"
                >
                    <CameraIcon />
                </button>
                <button 
                    type="button" 
                    onClick={handleMicClick}
                    disabled={isLoading || !isSupported}
                    className={micButtonClasses}
                    aria-label={isRecording ? "Stop recording" : "Start recording"}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill={isRecording ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                </button>
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder={capturedImage ? "Add a caption..." : (isRecording ? "Listening..." : "Ask J.A.R.V.I.S anything...")}
                    disabled={isLoading}
                    className="flex-1 bg-slate-900/80 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                />
                <button
                    type="submit"
                    disabled={isLoading || (!inputValue.trim() && !capturedImage)}
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
            <CameraView 
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onCapture={handleCapture}
            />
        </div>
    );
};