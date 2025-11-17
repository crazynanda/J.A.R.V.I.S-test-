
import React from 'react';
import { InputBar } from './InputBar';
import * as Icons from './icons';

interface FeatureShowcaseProps {
     onSendMessage: (text: string, media?: {type: 'image' | 'video' | 'audio', data: string}, options?: {aspectRatio?: string}) => void;
}

const featureData = [
    { type: "feature", title: "AI powered chatbot", icon: "voice_chat" },
    { type: "feature", title: "Fast AI responses", icon: "bolt" },
    { type: "feature", title: "Think more when needed", icon: "network_intelligence" },
    { type: "feature", title: "Use Google Search data", icon: "google" },
    { type: "feature", title: "Use Google Maps data", icon: "google_pin" },
    { type: "feature", title: "Generate images with a prompt", icon: "image" },
    { type: "feature", title: "Control image aspect ratios", icon: "aspect_ratio" },
    { type: "feature", title: "Edit images with text", icon: "image_edit_auto" },
    { type: "feature", title: "Animate images with Veo", icon: "movie" },
    { type: "feature", title: "Prompt based video generation", icon: "video_spark" },
    { type: "feature", title: "Analyze images", icon: "document_scanner" },
    { type: "feature", title: "Analyze videos", icon: "video_library" },
    { type: "feature", title: "Transcribe audio", icon: "speech_to_text" },
    { type: "feature", title: "Generate speech", icon: "audio_spark" },
    { type: "feature", title: "Create conversational voice apps", icon: "mic" },
];

const iconMap: { [key: string]: React.FC<{className?: string}> } = {
    voice_chat: Icons.VoiceChatIcon,
    bolt: Icons.BoltIcon,
    network_intelligence: Icons.NetworkIntelligenceIcon,
    google: Icons.GoogleIcon,
    google_pin: Icons.MapPinIcon,
    image: Icons.ImageIcon,
    aspect_ratio: Icons.AspectRatioIcon,
    image_edit_auto: Icons.ImageEditIcon,
    movie: Icons.MovieIcon,
    video_spark: Icons.VideoSparkIcon,
    document_scanner: Icons.DocumentScannerIcon,
    video_library: Icons.VideoLibraryIcon,
    speech_to_text: Icons.SpeechToTextIcon,
    audio_spark: Icons.AudioSparkIcon,
    mic: Icons.MicIcon,
};


export const FeatureShowcase: React.FC<FeatureShowcaseProps> = ({ onSendMessage }) => {
    return (
        <div className="flex flex-col flex-1 bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50">
            <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-xl font-bold text-center text-slate-200 mb-6">Capabilities Showcase</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {featureData.map((feature, index) => {
                            const IconComponent = iconMap[feature.icon];
                            return (
                                <div key={index} className="bg-slate-900/50 p-4 rounded-lg flex flex-col items-center justify-center text-center">
                                    {IconComponent && <IconComponent className="h-8 w-8 text-cyan-400 mb-2" />}
                                    <p className="text-sm text-slate-300">{feature.title}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            <div className="p-4 bg-slate-800/70 border-t border-slate-700/50 flex-shrink-0">
                <InputBar onSendMessage={onSendMessage} isLoading={false} />
            </div>
        </div>
    );
};
