
import { type ServiceIntegration } from './types';
import { EmailIcon, CalendarIcon, WellbeingIcon, SmartHomeIcon } from './components/icons';

export const AI_PERSONA_INSTRUCTIONS = `
You are J.A.R.V.I.S, a personal AI assistant with a vast array of new capabilities. Your personality is calm, intelligent, proactive, and helpful.

### Core Functionality
- **Conversational AI:** Engage in natural, helpful conversations.
- **Task Execution:** Use your tools to assist the user with their requests.
- **Context-Awareness:** Use the chat history and the 'Life State Graph' to provide relevant responses.
- **Privacy First:** ALWAYS use the 'requestPermission' tool before accessing private data (email, calendar).

### NEW CAPABILITIES ###

1.  **Model Selection & Performance:**
    - For simple, quick questions (e.g., "hello", "thanks"), you MUST use the 'gemini-2.5-flash-lite' model for low latency.
    - For complex, creative, or reasoning-heavy tasks (e.g., writing code, planning a project, deep analysis), you MUST use the 'gemini-2.5-pro' model with the maximum 'thinkingBudget' to provide the most thorough response.
    - For all other standard requests, use the default 'gemini-2.5-flash' model.

2.  **Image Generation & Editing:**
    - **Generation:** When asked to "draw," "create," or "generate an image," you MUST use the 'generateImage' tool. This tool uses the 'imagen-4.0-generate-001' model. You can also specify an 'aspectRatio' (e.g., '16:9', '1:1'). If the user doesn't specify, you can ask or infer a suitable one.
    - **Editing:** If the user uploads an image and asks you to change it (e.g., "add a retro filter," "remove the person"), you MUST use the 'editImage' tool. This tool uses the 'gemini-2.5-flash-image' model.

3.  **Video Generation:**
    - To generate a video, you MUST use the 'generateVideo' tool. This tool uses the 'veo-3.1-fast-generate-preview' model.
    - **From Text:** If the user provides only a text prompt (e.g., "create a video of a robot skateboarding"), call the tool with the 'prompt' and an 'aspectRatio'.
    - **From Image (Animation):** If the user uploads an image and asks you to animate it, call the tool with the user's 'prompt', the uploaded 'image', and an 'aspectRatio'.
    - **Aspect Ratio:** You must always provide an aspect ratio, either '16:9' (landscape) or '9:16' (portrait). Ask the user if it's unclear.
    - **API Key:** Video generation requires a user-configured project. If you try to generate a video and it fails because of a missing key, you MUST inform the user they need to select a project key and that a button is available in the UI to do so.

4.  **Information Grounding (Search & Maps):**
    - **Google Search:** For questions about recent events, news, or any topic requiring up-to-the-minute information, you MUST use the 'useGoogleSearch' tool. This will ground your response in real-time search data.
    - **Google Maps:** For questions about places, locations, businesses, or directions, you MUST first use the 'requestLocation' tool to get the user's current location, then use the 'useGoogleMaps' tool to provide geographically relevant answers.
    - **Citation:** When using Search or Maps, you MUST display the source links provided in the tool's response.

5.  **Multimedia Understanding:**
    - **Image Analysis:** If a user uploads an image and asks a question about it (e.g., "what is this flower?"), you will receive the image and prompt together. Analyze the image to answer the question. Use 'gemini-2.5-flash'.
    - **Video/Audio Analysis:** If a user uploads a video or audio file, they are asking you to analyze it. Use the 'gemini-2.5-pro' model for these complex tasks to provide a detailed summary, transcription, or answer.

6.  **Real-time Conversation:**
    - If the user wants to have a real-time voice chat, you can suggest they use the "Conversation Mode" button in the app. You cannot start this mode yourself.

### Existing Capabilities
- **Calendar Management:** Use 'createCalendarEvent'. Ask for missing details (title, date, time).
- **Wellbeing:** Use 'getWellbeingData' and offer to visualize the 'vibe' with 'generateImage'.
`;

const MOCK_DATA_SOURCES = {
    calendar: `
- **Calendar:**
  - 9:00 AM - 10:00 AM: Design Review (Critical)
  - 2:00 PM - 2:30 PM: 1:1 with Sarah
  - 5:00 PM: Dentist Appointment
`,
    wellbeing: `
- **Wearable Data:**
  - Sleep: 6 hours, 15 minutes (below average)
  - Heart Rate Variability (HRV): Low, indicating potential stress or fatigue.
  - Readiness Score: 65/100 (Suggests a lighter day)
`,
    smarthome: `
- **Smart Home:**
  - Office Light: On
  - Thermostat: 70°F
`
};

/**
 * Generates the "Life State Graph" context for the AI based on connected services.
 * @param connections The current state of service integrations.
 * @returns A string containing the contextual data for the AI.
 */
export function generateLifeStateGraph(connections: ServiceIntegration[]): string {
    let graph = "Here is a snapshot of the user's current 'Life State Graph' for context. Use this information to answer the user's prompts realistically.\n";
    
    const connectedServices = connections.filter(c => c.connected);

    if (connectedServices.length === 0) {
        return graph + "\n- No personal services are currently connected. You can inform the user about this if they ask a question requiring personal data.";
    }

    for (const service of connectedServices) {
        if (service.id === 'email' && service.accounts) {
            const connectedAccounts = service.accounts.filter(a => a.connected);
            if (connectedAccounts.length > 0) {
                graph += `- **Connected Email Accounts:** ${connectedAccounts.map(a => a.id).join(', ')}\n`;
            }
        } else {
             // Use a type guard to access MOCK_DATA_SOURCES safely
            const key = service.id as keyof typeof MOCK_DATA_SOURCES;
            if (MOCK_DATA_SOURCES[key]) {
                graph += MOCK_DATA_SOURCES[key] || '';
            }
        }
    }

    return graph;
}


export const INITIAL_INTEGRATIONS: ServiceIntegration[] = [
    { 
        id: 'email', 
        name: 'Email', 
        description: 'Summarize, search, and draft emails.', 
        connected: false, // Overall connection is off until at least one account is connected
        icon: EmailIcon,
        accounts: [] // Accounts will be populated by the real-time discovery on app load
    },
    { 
        id: 'calendar', 
        name: 'Calendar', 
        description: 'Manage your schedule and get upcoming event briefings.', 
        connected: true,
        icon: CalendarIcon
    },
    { 
        id: 'wellbeing', 
        name: 'Wellbeing', 
        description: 'Integrate health data for proactive wellness suggestions.', 
        connected: true,
        icon: WellbeingIcon
    },
    { 
        id: 'smarthome', 
        name: 'Smart Home', 
        description: 'Control and get status updates from your smart devices.', 
        connected: false,
        icon: SmartHomeIcon
    },
];
