
import { GoogleGenAI } from "@google/genai";
import { type ChatMessage } from '../types';
import { AI_PERSONA_INSTRUCTIONS, MOCK_LIFE_STATE_GRAPH } from '../constants';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

function formatChatHistory(history: ChatMessage[]): string {
    return history
        .map(message => `${message.author === 'user' ? 'User' : 'Flowen'}: ${message.text}`)
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
Flowen:
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
