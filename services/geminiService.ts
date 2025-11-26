
import { GoogleGenAI, Modality, type Content, GenerateContentResponse, Tool, Part, Type } from "@google/genai";
import { type ChatMessage, type AiResponse, type ServiceIntegration, GroundingSource, GeneratedVideo } from '../types';
import { AI_PERSONA_INSTRUCTIONS, generateSystemInstruction, generateLifeStateGraph } from '../constants';
import { 
    getEmails, getEmailsFunctionDeclaration,
    requestPermissionFunctionDeclaration,
    getCalendarEvents, getCalendarEventsFunctionDeclaration,
    createCalendarEvent, createCalendarEventFunctionDeclaration,
    getWellbeingData, getWellbeingDataFunctionDeclaration,
    getSmartHomeStatus, getSmartHomeStatusFunctionDeclaration,
    generateImageFunctionDeclaration,
    editImageFunctionDeclaration,
    generateVideoFunctionDeclaration,
    useGoogleSearchFunctionDeclaration,
    useGoogleMapsFunctionDeclaration,
    requestLocationFunctionDeclaration,
    getUserLocation,
    rememberFactFunctionDeclaration,
} from './mockDataService';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper function to retry operations on 503 (Overloaded) and 429 (Too Many Requests) errors
async function retryWithBackoff<T>(operation: () => Promise<T>, retries = 3, initialDelay = 1000): Promise<T> {
    let attempt = 0;
    while (true) {
        try {
            return await operation();
        } catch (error: any) {
            attempt++;
            const isOverloaded = error.status === 503 || error.code === 503 || error.message?.includes('overloaded');
            const isRateLimited = error.status === 429 || error.code === 429;
            
            if (attempt > retries || (!isOverloaded && !isRateLimited)) {
                throw error;
            }
            const delay = initialDelay * Math.pow(2, attempt - 1);
            console.warn(`Service busy (Status ${error.status}). Retrying in ${delay}ms... (Attempt ${attempt})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// A map of available tools the AI can call.
const availableTools: { [key: string]: Function } = {
    getEmails,
    getCalendarEvents,
    createCalendarEvent,
    getWellbeingData,
    getSmartHomeStatus,
    getUserLocation,
    // These are placeholders for the AI to signal intent for grounding
    useGoogleSearch: async () => ({ result: "Now searching Google..."}),
    useGoogleMaps: async () => ({ result: "Now searching Google Maps..."}),
    // The rememberFact tool logic is handled directly in the loop to pass data back to App state
    rememberFact: async () => ({ result: "Fact remembered." }),
};

const functionDeclarations = [
    requestPermissionFunctionDeclaration,
    getEmailsFunctionDeclaration,
    getCalendarEventsFunctionDeclaration,
    createCalendarEventFunctionDeclaration,
    getWellbeingDataFunctionDeclaration,
    getSmartHomeStatusFunctionDeclaration,
    generateImageFunctionDeclaration,
    editImageFunctionDeclaration,
    generateVideoFunctionDeclaration,
    useGoogleSearchFunctionDeclaration,
    useGoogleMapsFunctionDeclaration,
    requestLocationFunctionDeclaration,
    rememberFactFunctionDeclaration,
];

/**
 * Creates a Part object for an image from a data URL.
 * @param dataUrl The base64 encoded data URL.
 * @returns A Part object for the Gemini API or null if the format is invalid.
 */
function getMediaPart(dataUrl: string): Part | null {
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
        console.error("Invalid data URL format");
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
    
    // Prune history to last 30 messages to handle "heavy input" context limits and improve latency
    let processingHistory = [...history];
    const MAX_HISTORY_LENGTH = 30;
    if (processingHistory.length > MAX_HISTORY_LENGTH) {
        processingHistory = processingHistory.slice(processingHistory.length - MAX_HISTORY_LENGTH);
    }

    if (processingHistory.length > 0 && processingHistory[0].author === 'ai') {
        processingHistory.shift();
    }

    for (const message of processingHistory) {
        const parts: Part[] = [];
        if (message.text) {
            parts.push({ text: message.text });
        }
        if (message.image) {
            const imagePart = getMediaPart(message.image);
            if (imagePart) parts.push(imagePart);
        }
         if (message.video) {
            const videoPart = getMediaPart(message.video);
            if (videoPart) parts.push(videoPart);
        }
        if (message.audio) {
            const audioPart = getMediaPart(message.audio);
            if (audioPart) parts.push(audioPart);
        }

        if (message.author === 'user') {
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
            } else if (parts.length > 0) { 
                apiHistory.push({
                    role: 'model',
                    parts
                });
            }
        }
    }
    return apiHistory;
}

async function executeTool(toolName: string, toolArgs: any, connections: ServiceIntegration[]): Promise<Part> {
     if (toolName in availableTools) {
        try {
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
    } else if (toolName === 'requestLocation') {
        // Special handling for client-side permission request
        try {
            const location = await getUserLocation();
            return {
                functionResponse: {
                    name: toolName,
                    response: { result: JSON.stringify(location) }
                }
            };
        } catch (error) {
            return {
                functionResponse: {
                    name: toolName,
                    response: { error: (error as Error).message }
                }
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


function selectModel(prompt: string, media?: { type: 'image' | 'video' | 'audio', data: string }): string {
    if (media?.type === 'video' || media?.type === 'audio') {
        return 'gemini-2.5-pro';
    }
    const complexKeywords = ['analyze', 'code', 'plan', 'complex', 'explain in detail'];
    if (complexKeywords.some(kw => prompt.toLowerCase().includes(kw))) {
        return 'gemini-2.5-pro';
    }
    if (prompt.split(' ').length <= 3) {
        return 'gemini-2.5-flash-lite';
    }
    return 'gemini-2.5-flash';
}

/**
 * Gets a text response from the Gemini model, handling tool calls, model selection, and various generation tasks.
 */
export async function getAiResponse(
    prompt: string, 
    media: { type: 'image' | 'video' | 'audio', data: string } | undefined,
    options: { aspectRatio?: string } | undefined,
    history: ChatMessage[],
    connections: ServiceIntegration[],
    userMemory: string[] = [] // New parameter for Long-Term Memory
): Promise<AiResponse> {
    const modelName = selectModel(prompt, media);
    console.log(`Using model: ${modelName}`);

    const config: any = {
        tools: [{ functionDeclarations }],
        systemInstruction: generateSystemInstruction(connections, userMemory)
    };

    if (modelName === 'gemini-2.5-pro') {
        config.thinkingConfig = { thinkingBudget: 32768 };
    }

    const chat = ai.chats.create({
        model: modelName,
        config: config,
        history: formatHistoryForApi(history)
    });

    const userParts: Part[] = [{ text: prompt }];
    if (media) {
        const mediaPart = getMediaPart(media.data);
        if (mediaPart) {
            userParts.push(mediaPart);
        }
    }

    // Wrapped in retry
    let result = await retryWithBackoff<GenerateContentResponse>(() => chat.sendMessage({ message: userParts }));
    let response = result;
    const learnedFacts: string[] = [];

    while (response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls[0];
        console.log("AI wants to call a tool:", functionCall);

        // --- SPECIAL TOOL HANDLING ---
        if (functionCall.name === 'rememberFact') {
            const fact = functionCall.args.fact as string;
            learnedFacts.push(fact);
            const functionResponsePart: Part = { functionResponse: { name: 'rememberFact', response: { result: "Fact remembered successfully." } } };
            // Wrapped in retry
            result = await retryWithBackoff<GenerateContentResponse>(() => chat.sendMessage({ message: [functionResponsePart] }));
            response = result;
            // Continue the loop to allow the AI to generate a response acknowledging the memory
            continue;
        }

        if (functionCall.name === 'requestPermission') {
            return {
                text: functionCall.args.reason as string,
                requiresConsent: true,
                action: {
                    toolName: functionCall.args.toolToCall as string,
                    toolArgs: functionCall.args.toolArgs || {}
                },
                learnedFacts
            };
        }
        
        if (functionCall.name === 'generateImage') {
            const imagePrompt = functionCall.args.prompt as string;
            const aspectRatio = functionCall.args.aspectRatio as "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
             try {
                // Wrapped in retry
                const imageResult: any = await retryWithBackoff(() => ai.models.generateImages({
                    model: 'imagen-4.0-generate-001',
                    prompt: imagePrompt,
                    config: {
                        numberOfImages: 1,
                        aspectRatio: aspectRatio || '1:1'
                    },
                }));

                const base64ImageBytes = imageResult.generatedImages[0].image.imageBytes;
                const imageUrl = `data:image/png;base64,${base64ImageBytes}`;
                 const functionResponsePart: Part = { functionResponse: { name: 'generateImage', response: { result: `Successfully generated image.` } } };
                // Wrapped in retry
                result = await retryWithBackoff<GenerateContentResponse>(() => chat.sendMessage({ message: [functionResponsePart] }));
                return { text: result.text, generatedImage: imageUrl, learnedFacts };
             } catch (error: any) {
                 console.error("Error generating image:", error);
                 if (error.message?.includes('billed users') || error.status === 400 || error.code === 400) {
                     return { 
                         text: "To generate images, you need to select a billing project. Please use the button above to configure your project.", 
                         requiresBillingProject: true,
                         learnedFacts
                     };
                 }
                 const functionResponsePart: Part = { functionResponse: { name: 'generateImage', response: { error: (error as Error).message } } };
                 // Wrapped in retry
                 result = await retryWithBackoff<GenerateContentResponse>(() => chat.sendMessage({ message: [functionResponsePart] }));
                 return { text: result.text, learnedFacts };
             }
        }
        
        if (functionCall.name === 'editImage') {
             const imagePrompt = functionCall.args.prompt as string;
             // Find the last user message with an image to edit
             const lastUserImageMsg = [...history].reverse().find(m => m.author === 'user' && m.image);
             if (!lastUserImageMsg || !lastUserImageMsg.image) {
                 return { text: "I'm sorry, I couldn't find an image to edit. Please upload one first.", learnedFacts };
             }
             try {
                const imagePart = getMediaPart(lastUserImageMsg.image);
                if (!imagePart) throw new Error("Invalid image format for editing.");
                
                // Wrapped in retry
                const imageResult = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: { parts: [imagePart, { text: imagePrompt }] },
                    config: { responseModalities: [Modality.IMAGE] },
                }));
                const resultPart = imageResult.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                if (resultPart?.inlineData) {
                    const imageUrl = `data:${resultPart.inlineData.mimeType};base64,${resultPart.inlineData.data}`;
                    const functionResponsePart: Part = { functionResponse: { name: 'editImage', response: { result: "Successfully edited the image." } } };
                    // Wrapped in retry
                    result = await retryWithBackoff<GenerateContentResponse>(() => chat.sendMessage({ message: [functionResponsePart] }));
                    return { text: result.text, generatedImage: imageUrl, learnedFacts };
                } else {
                    throw new Error("No edited image data received.");
                }
             } catch(error) {
                console.error("Error editing image:", error);
                const functionResponsePart: Part = { functionResponse: { name: 'editImage', response: { error: (error as Error).message } } };
                // Wrapped in retry
                result = await retryWithBackoff<GenerateContentResponse>(() => chat.sendMessage({ message: [functionResponsePart] }));
                return { text: result.text, learnedFacts };
             }
        }
        
        if (functionCall.name === 'generateVideo') {
             const videoPrompt = functionCall.args.prompt as string;
             const aspectRatio = functionCall.args.aspectRatio as '16:9' | '9:16';
             const imageToAnimate = functionCall.args.image as string | undefined; // Assuming AI might pass this if it decides to animate

             const lastUserImageMsg = [...history, {author: 'user', text: prompt, image: media?.type === 'image' ? media.data : undefined}].reverse().find(m => m.author === 'user' && m.image);
             const imagePayload = imageToAnimate || lastUserImageMsg?.image ? { image: getMediaPart(imageToAnimate || lastUserImageMsg!.image!) } : {};
             
             try {
                 // @ts-ignore
                 if (window.aistudio && await window.aistudio.hasSelectedApiKey() === false) {
                    return { 
                        text: "To generate a video, you first need to select a project. Please click the 'Select Project' button to continue.",
                        requiresBillingProject: true,
                        learnedFacts
                    };
                 }

                const localAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const request = {
                    model: 'veo-3.1-fast-generate-preview',
                    prompt: videoPrompt,
                    ...imagePayload,
                    config: {
                        numberOfVideos: 1,
                        aspectRatio: aspectRatio || '16:9',
                    },
                };
                
                // Wrapped in retry
                // @ts-ignore
                const operation: any = await retryWithBackoff(() => localAi.models.generateVideos(request));
                const functionResponsePart: Part = { functionResponse: { name: 'generateVideo', response: { result: `Starting video generation. This may take a few minutes.` } } };
                // Wrapped in retry
                result = await retryWithBackoff<GenerateContentResponse>(() => chat.sendMessage({ message: [functionResponsePart] }));
                return {
                    text: result.text,
                    generatedVideo: { state: 'generating', operationName: operation.name },
                    learnedFacts
                };

             } catch (error) {
                 console.error("Error starting video generation:", error);
                 const functionResponsePart: Part = { functionResponse: { name: 'generateVideo', response: { error: (error as Error).message } } };
                 // Wrapped in retry
                 result = await retryWithBackoff<GenerateContentResponse>(() => chat.sendMessage({ message: [functionResponsePart] }));
                 return { text: result.text, learnedFacts };
             }
        }
        
        // --- GROUNDING HANDLING ---
        if (functionCall.name === 'useGoogleSearch' || functionCall.name === 'useGoogleMaps') {
             const isMaps = functionCall.name === 'useGoogleMaps';
             const groundingConfig: any = {
                 tools: isMaps ? [{ googleMaps: {} }, {googleSearch: {}}] : [{ googleSearch: {} }],
             };
             if (isMaps) {
                 try {
                     const location = await getUserLocation();
                     groundingConfig.toolConfig = { retrievalConfig: { latLng: location } };
                 } catch (e) { /* fail silently, proceed without location */ }
             }

             // Wrapped in retry
             const groundingResult = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
                 model: 'gemini-2.5-flash',
                 contents: userParts,
                 config: groundingConfig
             }));
             
             const groundingChunks = groundingResult.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
             const sources: GroundingSource[] = groundingChunks.map((chunk: any) => ({
                 uri: chunk.web?.uri || chunk.maps?.uri || '',
                 title: chunk.web?.title || chunk.maps?.title || 'Source'
             })).filter((s: GroundingSource) => s.uri);
             
             return { text: groundingResult.text, groundingSources: sources, learnedFacts };
        }

        // --- REGULAR TOOL HANDLING ---
        const functionResponsePart = await executeTool(functionCall.name, functionCall.args, connections);
        // Wrapped in retry
        result = await retryWithBackoff<GenerateContentResponse>(() => chat.sendMessage({ message: [functionResponsePart] }));
        response = result;
    }

    return { text: response.text, learnedFacts };
}


/**
 * Continues the conversation after user has granted consent to execute a tool.
 */
export async function getAiResponseAfterConsent(
    action: { toolName: string; toolArgs: any; },
    history: ChatMessage[],
    connections: ServiceIntegration[]
): Promise<AiResponse> {
    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            tools: [{ functionDeclarations }],
            systemInstruction: `${AI_PERSONA_INSTRUCTIONS}\n\n${generateLifeStateGraph(connections)}`
        },
        history: formatHistoryForApi(history)
    });

    console.log("Executing tool after consent:", action);
    const functionResponsePart = await executeTool(action.toolName, action.toolArgs, connections);
    // Wrapped in retry
    const result = await retryWithBackoff<GenerateContentResponse>(() => chat.sendMessage({ message: [functionResponsePart] }));

    return { text: result.text };
}

/**
 * Generates speech audio from the given text using the Gemini TTS model.
 */
export async function getAiSpeech(text: string): Promise<string | null> {
    try {
        // Wrapped in retry
        const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
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
        }));

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
