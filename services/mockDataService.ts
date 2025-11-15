
import { FunctionDeclaration, Type } from '@google/genai';
import { ServiceAccount } from '../types';

// --- MOCK DATA ---

// This simulates the accounts that would be "discovered" on a user's device.
const MOCK_DEVICE_ACCOUNTS = [
    { id: 'personal@example.com' },
    { id: 'work@example.com' },
];

const MOCK_EMAILS_INTERNAL = {
    "personal@example.com": [
        { from: "Sarah <sarah@widgets.com>", subject: "Re: 1:1 Canceled", body: "Hi, I need to cancel our 1:1 today. Can we reschedule for tomorrow afternoon?" },
        { from: "Dr. Smith's Office", subject: "Your Appointment Reminder", body: "This is a reminder for your dentist appointment tomorrow at 5:00 PM." },
    ],
    "work@example.com": [
        { from: "Alex <alex@investors.com>", subject: "Quick Question", body: "Hey, can we confirm the investor meeting for tomorrow at 10 AM?" },
        { from: "Slack #design-team", subject: "Reminder: Design Review Feedback", body: "Don't forget to submit your design review feedback by EOD." },
    ]
};

const MOCK_CALENDAR_EVENTS_INTERNAL = [
    { title: "Design Review", time: "9:00 AM - 10:00 AM", status: "Critical" },
    { title: "1:1 with Sarah", time: "2:00 PM - 2:30 PM", status: "Normal" },
    { title: "Dentist Appointment", time: "5:00 PM", status: "Personal" }
];

const MOCK_WELLBEING_DATA_INTERNAL = {
    sleep: { hours: 6, minutes: 15, quality: "below average" },
    hrv: "Low",
    readinessScore: 65,
    notes: "Suggests a lighter day due to potential stress or fatigue."
};

const MOCK_SMARTHOME_STATUS_INTERNAL = {
    officeLight: "On",
    thermostat: "70°F"
};


// --- SIMULATED DEVICE API ---

async function simulateNetworkDelay(ms: number = 300) {
    await new Promise(resolve => setTimeout(resolve, ms));
}

export async function getDeviceEmailAccounts(): Promise<{ id: string }[]> {
    console.log("Simulating real-time discovery of device email accounts...");
    await simulateNetworkDelay(500); // Simulate a quick scan
    return MOCK_DEVICE_ACCOUNTS;
}

// --- TOOLS / FUNCTIONS ---

export async function getEmails({ accountIds }: { accountIds: string[] }): Promise<string> {
    console.log(`Tool called: getEmails() for accounts: ${accountIds.join(', ')}`);
    await simulateNetworkDelay();
    
    if (!accountIds || accountIds.length === 0) {
        return JSON.stringify({ error: "No email accounts were specified or connected." });
    }

    let allEmails: object[] = [];
    for (const id of accountIds) {
        if (MOCK_EMAILS_INTERNAL[id as keyof typeof MOCK_EMAILS_INTERNAL]) {
            const accountEmails = MOCK_EMAILS_INTERNAL[id as keyof typeof MOCK_EMAILS_INTERNAL].map(email => ({ ...email, account: id }));
            allEmails = allEmails.concat(accountEmails);
        }
    }
    return JSON.stringify(allEmails);
}

export async function getCalendarEvents(): Promise<string> {
    console.log("Tool called: getCalendarEvents()");
    await simulateNetworkDelay();
    return JSON.stringify(MOCK_CALENDAR_EVENTS_INTERNAL);
}

export async function getWellbeingData(): Promise<string> {
    console.log("Tool called: getWellbeingData()");
    await simulateNetworkDelay();
    return JSON.stringify(MOCK_WELLBEING_DATA_INTERNAL);
}

export async function getSmartHomeStatus(): Promise<string> {
    console.log("Tool called: getSmartHomeStatus()");
    await simulateNetworkDelay();
    return JSON.stringify(MOCK_SMARTHOME_STATUS_INTERNAL);
}


// --- FUNCTION DECLARATIONS for Gemini ---

export const requestPermissionFunctionDeclaration: FunctionDeclaration = {
    name: 'requestPermission',
    description: "Must be called before using any other tool that accesses a user's private data. Explain why you need access and which tool you intend to use.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            toolToCall: {
                type: Type.STRING,
                description: "The name of the tool you want to use after getting permission (e.g., 'getEmails')."
            },
            toolArgs: {
                type: Type.OBJECT,
                description: "The arguments you will pass to the tool after getting permission."
            },
            reason: {
                type: Type.STRING,
                description: "A friendly, user-facing explanation for why you need to access this data."
            }
        },
        required: ['toolToCall', 'reason']
    }
};

export const getEmailsFunctionDeclaration: FunctionDeclaration = {
    name: 'getEmails',
    description: "Fetches the user's unread emails from their connected accounts to summarize or answer questions about them.",
    parameters: { 
        type: Type.OBJECT, 
        properties: {
            accountIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Optional. The specific email accounts to check (e.g., ['personal@example.com']). If not provided, will check all connected accounts."
            }
        } 
    },
};

export const getCalendarEventsFunctionDeclaration: FunctionDeclaration = {
    name: 'getCalendarEvents',
    description: "Fetches the user's upcoming calendar events for today.",
    parameters: { type: Type.OBJECT, properties: {} },
};

export const getWellbeingDataFunctionDeclaration: FunctionDeclaration = {
    name: 'getWellbeingData',
    description: "Fetches the user's latest wellbeing and health data from their wearable device.",
    parameters: { type: Type.OBJECT, properties: {} },
};

export const getSmartHomeStatusFunctionDeclaration: FunctionDeclaration = {
    name: 'getSmartHomeStatus',
    description: "Fetches the current status of the user's connected smart home devices.",
    parameters: { type: Type.OBJECT, properties: {} },
};
