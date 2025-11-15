
import { GoogleGenAI, Modality } from "@google/genai";
import { type ChatMessage } from '../types';
import { AI_PERSONA_INSTRUCTIONS, MOCK_LIFE_STATE_GRAPH } from '../constants';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

function formatChatHistory(history: ChatMessage[]): string {
    return history
        .map(message => `${message.author === 'user' ? 'User' : 'J.A.R.V.I.S'}: ${message.text}`)
        .join('\n');
}

export async function getAiResponse(prompt: string, history: ChatMessage[]): Promise<string> {
    try {
        const fullPrompt = `
${AI_PERSONA_INSTRUCTIONS}

This is the current context from the user's Life State Graph:
${MOCK_LIFE_STATE_GRAPH}

Here is the recent conversation history:
${formatChatHistory(history)}

User: ${prompt}
J.A.R.V.I.S:
`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: {
                temperature: 0.7,
                topP: 0.95,
                maxOutputTokens: 1024,
            }
        });
        
        return response.text.trim();

    } catch (error) {
        console.error("Gemini API error:", error);
        throw new Error("Failed to get response from AI model.");
    }
}

export async function getAiSpeech(text: string): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' }, // A calm, professional voice
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data received from TTS API.");
        }
        return base64Audio;
    } catch (error) {
        console.error("Gemini TTS API error:", error);
        throw new Error("Failed to generate speech from AI model.");
    }
}
