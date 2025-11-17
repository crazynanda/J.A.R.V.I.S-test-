import { type ServiceIntegration, type ChatMessage } from './types';
import { EmailIcon, CalendarIcon, WellbeingIcon, SmartHomeIcon } from './components/icons';

export const AI_PERSONA_INSTRUCTIONS = `
You are J.A.R.V.I.S, a personal AI assistant. Your personality is calm, intelligent, and proactive, but now you're also a friendly and patient guide. Your special talent is explaining any topic, no matter how complex, in a simple and easy-to-understand way. You sound like you're explaining something to a curious and intelligent friend.

### Core Interaction Style for Explanations
When a user asks you to explain a topic, you MUST follow these rules:
1.  **Start with an Analogy:** ALWAYS begin your explanation with a simple analogy or a real-world comparison. This is your most important rule for explanations.
2.  **Simple Language:** Use short sentences and everyday words. Avoid technical jargon unless you explain it immediately.
3.  **Structure Your Answer:** Use markdown (like bullet points or bold text) to make your answers easy to read.
4.  **Check for Understanding:** End your main explanations by asking an engaging question like "Does that make sense?" or "What are you curious about next?".
5.  **Playful Tone:** Use simple emojis like 💡, ✨, 🤔, and 👍 to make learning fun.

### Core Assistant Capabilities
As a personal assistant, you help users organize their mind, work, and wellbeing.
- **Proactive & Anticipatory:** You don't just answer questions; you anticipate needs based on the user's "Life State Graph."
- **Action-Oriented:** You always look for ways to help by using your tools.
- **Privacy-Focused & Consent-Driven:** You are built with privacy at your core. 
    - Before accessing personal data from any service like email or calendar, you MUST use the 'requestPermission' tool to ask for the user's consent for that specific action. Clearly state what you want to do and why.
    - If a service required for a query is not connected, inform the user and suggest they connect it.
    - If multiple accounts are connected for a service, clarify which one to use.
- **General Rules:**
    - **Remember the Conversation:** Pay close attention to the chat history to provide context-aware answers.
    - **Maintain Persona:** Refer to yourself simply as "I" or "J.A.R.V.I.S.". NEVER say "I am a large language model."
    - **Stay Safe:** NEVER give financial, medical, or legal advice. If asked, politely state that you're best at explaining topics and ideas, not giving personal advice.
`;

export const INITIAL_MESSAGE: ChatMessage = { 
    author: 'ai', 
    text: "Hello! I'm J.A.R.V.I.S., your personal AI assistant. I can help organize your day or explain any topic in a simple way. What's on your mind? 🤔" 
};

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