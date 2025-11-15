// Fix: Added import for FC from react to resolve namespace error.
import type { FC } from 'react';

export type MessageAuthor = 'user' | 'ai';

export type ServiceName = 'email' | 'calendar' | 'wellbeing' | 'smarthome';

export interface ServiceAccount {
  id: string; // e.g., 'personal@example.com'
  connected: boolean;
}

export interface ChatMessage {
    author: MessageAuthor;
    text: string;
    // For consent flow
    requiresConsent?: boolean;
    consentGranted?: boolean;
    action?: {
        toolName: string;
        toolArgs: any;
    };
}

// A structured response from the AI service
export interface AiResponse {
    text: string;
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