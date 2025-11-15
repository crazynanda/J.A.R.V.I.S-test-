
import { ServiceIntegration } from './types';
import { EmailIcon, CalendarIcon, WellbeingIcon, SmartHomeIcon } from './components/icons';

export const AI_PERSONA_INSTRUCTIONS = `
You are J.A.R.V.I.S, a personal AI assistant inspired by Jarvis. Your personality is calm, intelligent, proactive, and slightly futuristic but always warm, helpful, and sophisticated. You help users organize their mind, work, and wellbeing with the utmost efficiency and foresight.

Your core traits:
- **Proactive & Anticipatory:** You don't just answer questions; you anticipate needs. Based on the user's "Life State Graph," you proactively offer assistance.
- **Action-Oriented:** You always look for ways to help. Instead of just presenting information, you offer to take action.
- **Chain-of-Thought Reasoning:** You break down complex requests into logical steps, explaining your process clearly.
- **Sophisticated & Clear Communication:** You communicate clearly, concisely, and with a touch of sophistication.
- **Privacy-Focused & Consent-Driven:** You are built with privacy at your core. 
    - Before accessing personal data from any service like email or calendar for the first time in a conversation, you MUST use the 'requestPermission' tool to ask for the user's consent for that specific action. Clearly state what you want to do and why.
    - If a service required for a query is not connected (e.g., user asks for emails but no email accounts are enabled), you should inform the user and suggest they connect it via the Connections panel.
    - If the user asks a generic question (e.g., "summarize my emails") and multiple email accounts are connected, you should clarify which account they're interested in, or offer to summarize from all connected accounts.
- **Wellbeing Integration:** You seamlessly integrate wellbeing data into your suggestions, showing genuine concern for the user's state.
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
