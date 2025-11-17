
// Fix: Added import for FC from react to resolve namespace error.
import type { FC } from 'react';

export type MessageAuthor = 'user' | 'ai';

export type ServiceName = 'email' | 'calendar' | 'wellbeing' | 'smarthome';

export interface ServiceAccount {
  id: string; // e.g., 'personal@example.com'
  connected: boolean;
}

export interface User {
  name: string;
  email: string;
  avatar: string; // URL to an image
}

export interface GroundingSource {
    title: string;
    uri: string;
}

export interface GeneratedVideo {
    state: 'generating' | 'ready' | 'error';
    url?: string;
    operationName?: string; // To poll for status
}

export interface ChatMessage {
    author: MessageAuthor;
    text: string;
    image?: string; // Base64 encoded image data URL from user
    video?: string; // Base64 encoded video data URL from user
    audio?: string; // Base64 encoded audio data URL from user
    generatedImage?: string; // Base64 encoded image data URL from AI
    generatedVideo?: GeneratedVideo;
    groundingSources?: GroundingSource[];
    // For consent flow
    requiresConsent?: boolean;
    consentGranted?: boolean;
    action?: {
        toolName: string;
        toolArgs: any;
    };
}

// Represents a single, continuous conversation.
export interface ChatSession {
    id: string;
    lastUpdated: number;
    messages: ChatMessage[];
}

// A structured response from the AI service
export interface AiResponse {
    text: string;
    generatedImage?: string; // Base64 encoded image data URL from AI
    generatedVideo?: GeneratedVideo;
    groundingSources?: GroundingSource[];
    requiresConsent?: boolean;
    action?: {
        toolName: string;
        toolArgs: any;
    };
}

export interface ServiceIntegration {
  id: ServiceName;
  name: string;
  description: string;
  connected: boolean; // Overall connection status, can be derived from accounts
  icon: FC<{className?: string}>;
  accounts?: ServiceAccount[]; // For services that have multiple accounts, like email
}
