
import { GoogleGenAI, Modality, type Content, GenerateContentResponse, Tool, Part, Type } from "@google/genai";
import { type ChatMessage, type AiResponse, type ServiceIntegration } from '../types';
import { AI_PERSONA_INSTRUCTIONS, generateLifeStateGraph } from '../constants';
import { 
    getEmails, getEmailsFunctionDeclaration,
    requestPermissionFunctionDeclaration,
    getCalendarEvents, getCalendarEventsFunctionDeclaration,
    getWellbeingData, getWellbeingDataFunctionDeclaration,
    getSmartHomeStatus, getSmartHomeStatusFunctionDeclaration
} from './mockDataService';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'gemini-2.5-flash';

// A map of available tools the AI can call.
const availableTools: { [key: string]: Function } = {
    getEmails,
    getCalendarEvents,
    getWellbeingData,
    getSmartHomeStatus,
};

const tools: Tool[] = [{
    functionDeclarations: [
        requestPermissionFunctionDeclaration,
        getEmailsFunctionDeclaration,
        getCalendarEventsFunctionDeclaration,
        getWellbeingDataFunctionDeclaration,
        getSmartHomeStatusFunctionDeclaration
    ]
}];

/**
 * Creates a Part object for an image from a data URL.
 * @param imageDataUrl The base64 encoded image data URL.
 * @returns A Part object for the Gemini API or null if the format is invalid.
 */
function getImagePart(imageDataUrl: string): Part | null {
    const match = imageDataUrl.match(/^data:(image\/.+);base64,(.+)$/);
    if (!match) {
        console.error("Invalid image data URL format");
        return null;
    }
    const mimeType = match[1];
    const base64Data = match[2];
    
    return {
        inlineData: {
            mimeType,
            data: base64Data
        }
    };
}


function formatHistoryForApi(history: ChatMessage[]): Content[] {
    const apiHistory: Content[] = [];
    
    let processingHistory = [...history];

    if (processingHistory.length > 0 && processingHistory[0].author === 'ai') {
        processingHistory.shift();
    }

    for (const message of processingHistory) {
        if (message.author === 'user') {
            const parts: Part[] = [{ text: message.text }];
            if (message.image) {
                const imagePart = getImagePart(message.image);
                if (imagePart) {
                    parts.push(imagePart);
                }
            }
            apiHistory.push({ role: 'user', parts });
        } else { // author === 'ai'
            if (message.requiresConsent && message.action) {
                apiHistory.push({
                    role: 'model',
                    parts: [{
                        functionCall: {
                            name: 'requestPermission',
                            args: {
                                reason: message.text,
                                toolToCall: message.action.toolName,
                                toolArgs: message.action.toolArgs,
                            }
                        }
                    }]
                });
            } else if (message.text) { 
                apiHistory.push({
                    role: 'model',
                    parts: [{ text: message.text }]
                });
            }
        }
    }
    return apiHistory;
}

async function executeTool(toolName: string, toolArgs: any, connections: ServiceIntegration[]): Promise<Part> {
     if (toolName in availableTools) {
        try {
            if (toolName === 'getEmails') {
                const emailIntegration = connections.find(c => c.id === 'email');
                const connectedAccounts = emailIntegration?.accounts?.filter(a => a.connected).map(a => a.id) || [];
                
                if (!toolArgs.accountIds || toolArgs.accountIds.length === 0) {
                    toolArgs.accountIds = connectedAccounts;
                } else {
                    toolArgs.accountIds = toolArgs.accountIds.filter((id: string) => connectedAccounts.includes(id));
                }
            }

            const toolResponse = await availableTools[toolName](toolArgs);
            return {
                functionResponse: {
                    name: toolName,
                    response: { result: toolResponse },
                },
            };
        } catch (error) {
            console.error(`Error executing tool ${toolName}:`, error);
            return {
                functionResponse: {
                    name: toolName,
                    response: { error: "Failed to execute function." },
                },
            };
        }
    } else {
        console.warn(`Function ${toolName} not found.`);
        return {
            functionResponse: {
                name: toolName,
                response: { error: `Function ${toolName} not found.` },
            },
        };
    }
}

/**
 * Gets a text response from the Gemini model, handling the consent flow and tool calls.
 * @param prompt The user's latest message.
 * @param image Optional base64 encoded image string.
 * @param history The current chat history.
 * @param connections The current state of service integrations.
 * @returns A structured AiResponse object.
 */
export async function getAiResponse(
    prompt: string, 
    image: string | undefined,
    history: ChatMessage[],
    connections: ServiceIntegration[]
): Promise<AiResponse> {
    const chat = ai.chats.create({
        model: model,
        config: {
            tools: tools,
            systemInstruction: `${AI_PERSONA_INSTRUCTIONS}\n\n${generateLifeStateGraph(connections)}`
        },
        history: formatHistoryForApi(history)
    });

    const userParts: Part[] = [{ text: prompt }];
    if (image) {
        const imagePart = getImagePart(image);
        if (imagePart) {
            userParts.push(imagePart);
        }
    }

    // Fix: chat.sendMessage expects an object with a `message` property.
    const result = await chat.sendMessage({ message: userParts });
    const response = result;
    const functionCall = response.functionCalls?.[0];

    if (functionCall) {
        if (functionCall.name === 'requestPermission') {
            console.log("AI is requesting permission:", functionCall.args);
            return {
                text: functionCall.args.reason as string,
                requiresConsent: true,
                action: {
                    toolName: functionCall.args.toolToCall as string,
                    toolArgs: functionCall.args.toolArgs || {}
                }
            };
        } else {
            console.log("AI wants to call a tool directly:", functionCall);
            const functionResponsePart = await executeTool(functionCall.name, functionCall.args, connections);
            // Fix: chat.sendMessage expects an object with a `message` property.
            const secondResult = await chat.sendMessage({ message: [functionResponsePart] });
            return { text: secondResult.text };
        }
    } else {
        return { text: response.text };
    }
}


/**
 * Continues the conversation after user has granted consent to execute a tool.
 * @param action The tool action to execute.
 * @param history The chat history leading up to the consent request.
 * @param connections The current state of service integrations.
 * @returns A structured AiResponse object with the final text.
 */
export async function getAiResponseAfterConsent(
    action: { toolName: string; toolArgs: any; },
    history: ChatMessage[],
    connections: ServiceIntegration[]
): Promise<AiResponse> {
    const chat = ai.chats.create({
        model: model,
        config: {
            tools: tools,
            systemInstruction: `${AI_PERSONA_INSTRUCTIONS}\n\n${generateLifeStateGraph(connections)}`
        },
        history: formatHistoryForApi(history)
    });

    console.log("Executing tool after consent:", action);
    const functionResponsePart = await executeTool(action.toolName, action.toolArgs, connections);
    // Fix: chat.sendMessage expects an object with a `message` property.
    const result = await chat.sendMessage({ message: [functionResponsePart] });

    return { text: result.text };
}


/**
 * Generates speech audio from the given text using the Gemini TTS model.
 * @param text The text to convert to speech.
 * @returns A base64 encoded audio string or null if an error occurs.
 */
export async function getAiSpeech(text: string): Promise<string | null> {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `Speak the following text: ${text}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data received from API.");
        }
        return base64Audio;
    } catch (error) {
        console.error("Error generating AI speech:", error);
        return null;
    }
}
