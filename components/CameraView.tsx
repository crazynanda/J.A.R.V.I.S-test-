import React, { useRef, useEffect, useState } from 'react';

interface CameraViewProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (imageDataUrl: string) => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ isOpen, onClose, onCapture }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const startCamera = async () => {
            if (isOpen) {
                try {
                    setError(null);
                    const stream = await navigator.mediaDevices.getUserMedia({ 
                        video: { facingMode: 'environment' } // Prefer rear camera
                    });
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        streamRef.current = stream;
                    }
                } catch (err) {
                    console.error("Error accessing camera:", err);
                    if (err instanceof Error) {
                        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                            setError('Camera access was denied. Please enable it in your browser settings.');
                        } else {
                             setError('Could not access the camera. Please ensure it is not in use by another application.');
                        }
                    } else {
                        setError('An unknown error occurred while trying to access the camera.');
                    }
                }
            }
        };

        startCamera();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [isOpen]);

    const handleCapture = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const imageDataUrl = canvas.toDataURL('image/jpeg');
                onCapture(imageDataUrl);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-50 animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="camera-view-title"
        >
            <div className="relative w-full max-w-lg aspect-video bg-black rounded-lg overflow-hidden border border-slate-700">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
                        <p className="text-center text-red-400">{error}</p>
                    </div>
                )}
            </div>

            <div className="mt-6 flex items-center gap-4">
                <button
                    onClick={onClose}
                    className="text-slate-300 bg-slate-700/50 px-6 py-3 rounded-full hover:bg-slate-600/50 transition-colors"
                    aria-label="Close camera"
                >
                    Cancel
                </button>
                 <button
                    onClick={handleCapture}
                    disabled={!!error}
                    className="w-20 h-20 rounded-full bg-white flex items-center justify-center ring-4 ring-white/30 ring-offset-4 ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Capture photo"
                >
                    <div className="w-16 h-16 rounded-full bg-white active:bg-slate-200 border-2 border-slate-800"></div>
                </button>
            </div>
        </div>
    );
};