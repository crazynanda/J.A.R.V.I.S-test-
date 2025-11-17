
import { FunctionDeclaration, Type } from '@google/genai';
import { ServiceAccount, User } from '../types';

// --- MOCK USER DATA ---
const MOCK_USER: User = {
    name: 'Tony Stark',
    email: 'personal@example.com',
    // A simple, generic SVG avatar to avoid external dependencies
    avatar: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="%23cbd5e1" stroke-width="8"><circle cx="50" cy="50" r="45"/><path d="M50 20 C 65 30, 65 50, 50 60 S 35 30, 50 20 Z"/><path d="M25 70 A 25 25 0 0 1 75 70"/></svg>`
};

// --- MOCK DATA ---

const MOCK_DEVICE_ACCOUNTS = [ { id: 'personal@example.com' }, { id: 'work@example.com' } ];
const MOCK_EMAILS_INTERNAL = { "personal@example.com": [ { from: "Sarah <sarah@widgets.com>", subject: "Re: 1:1 Canceled", body: "Hi, I need to cancel our 1:1 today. Can we reschedule for tomorrow afternoon?" }, { from: "Dr. Smith's Office", subject: "Your Appointment Reminder", body: "This is a reminder for your dentist appointment tomorrow at 5:00 PM." }, ], "work@example.com": [ { from: "Alex <alex@investors.com>", subject: "Quick Question", body: "Hey, can we confirm the investor meeting for tomorrow at 10 AM?" }, { from: "Slack #design-team", subject: "Reminder: Design Review Feedback", body: "Don't forget to submit your design review feedback by EOD." }, ] };
const MOCK_CALENDAR_EVENTS_INTERNAL = [ { title: "Design Review", time: "9:00 AM - 10:00 AM", status: "Critical" }, { title: "1:1 with Sarah", time: "2:00 PM - 2:30 PM", status: "Normal" }, { title: "Dentist Appointment", time: "5:00 PM", status: "Personal" } ];
const MOCK_WELLBEING_DATA_INTERNAL = { sleep: { hours: 6, minutes: 15, quality: "below average" }, hrv: "Low", readinessScore: 65, notes: "Suggests a lighter day due to potential stress or fatigue." };
const MOCK_SMARTHOME_STATUS_INTERNAL = { officeLight: "On", thermostat: "70°F" };


// --- SIMULATED DEVICE API ---

async function simulateNetworkDelay(ms: number = 300) { await new Promise(resolve => setTimeout(resolve, ms)); }
export async function getDeviceEmailAccounts(): Promise<{ id: string }[]> { await simulateNetworkDelay(500); return MOCK_DEVICE_ACCOUNTS; }
export async function signInWithGoogle(): Promise<User> { await simulateNetworkDelay(700); return MOCK_USER; }
export async function signOut(): Promise<{ success: boolean }> { await simulateNetworkDelay(200); return { success: true }; }

// --- TOOLS / FUNCTIONS ---

export function getUserLocation(): Promise<{latitude: number, longitude: number}> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by your browser."));
        } else {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                },
                () => {
                    reject(new Error("Unable to retrieve your location. Please ensure location services are enabled."));
                }
            );
        }
    });
}

export async function getEmails({ accountIds }: { accountIds: string[] }): Promise<string> {
    await simulateNetworkDelay();
    if (!accountIds || accountIds.length === 0) return JSON.stringify({ error: "No email accounts were specified or connected." });
    let allEmails: object[] = [];
    for (const id of accountIds) {
        if (MOCK_EMAILS_INTERNAL[id as keyof typeof MOCK_EMAILS_INTERNAL]) {
            allEmails = allEmails.concat(MOCK_EMAILS_INTERNAL[id as keyof typeof MOCK_EMAILS_INTERNAL].map(email => ({ ...email, account: id })));
        }
    }
    return JSON.stringify(allEmails);
}

export async function getCalendarEvents(): Promise<string> { await simulateNetworkDelay(); return JSON.stringify(MOCK_CALENDAR_EVENTS_INTERNAL); }
export async function createCalendarEvent({ title, date, time }: { title: string, date: string, time: string }): Promise<string> {
    await simulateNetworkDelay();
    const newEvent = { title, date, time, status: "Scheduled" };
    MOCK_CALENDAR_EVENTS_INTERNAL.push(newEvent);
    return JSON.stringify({ success: true, event: newEvent });
}
export async function getWellbeingData(): Promise<string> { await simulateNetworkDelay(); return JSON.stringify(MOCK_WELLBEING_DATA_INTERNAL); }
export async function getSmartHomeStatus(): Promise<string> { await simulateNetworkDelay(); return JSON.stringify(MOCK_SMARTHOME_STATUS_INTERNAL); }


// --- FUNCTION DECLARATIONS for Gemini ---

export const generateImageFunctionDeclaration: FunctionDeclaration = {
    name: 'generateImage',
    description: "Generates an image from a text prompt using Imagen 4. Use for high-quality image creation requests.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            prompt: { type: Type.STRING, description: "A detailed, descriptive prompt of the image to generate." },
            aspectRatio: { type: Type.STRING, description: "The desired aspect ratio. Supported values: '1:1', '16:9', '9:16', '4:3', '3:4'." }
        },
        required: ['prompt']
    }
};

export const editImageFunctionDeclaration: FunctionDeclaration = {
    name: 'editImage',
    description: "Edits a user-provided image based on a text prompt. Use when the user uploads an image and asks to modify it.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            prompt: { type: Type.STRING, description: "Instructions on how to edit the image (e.g., 'add a retro filter', 'make the background blurry')." }
        },
        required: ['prompt']
    }
};

export const generateVideoFunctionDeclaration: FunctionDeclaration = {
    name: 'generateVideo',
    description: "Generates a video using Veo. Can generate from a text prompt or animate an existing image.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            prompt: { type: Type.STRING, description: "A detailed prompt describing the video content or animation." },
            aspectRatio: { type: Type.STRING, description: "The video aspect ratio, MUST be '16:9' or '9:16'." },
            image: { type: Type.STRING, description: "Optional. The base64 encoded image to animate."}
        },
        required: ['prompt', 'aspectRatio']
    }
};

export const useGoogleSearchFunctionDeclaration: FunctionDeclaration = {
    name: 'useGoogleSearch',
    description: "Use to get up-to-date information or answer questions about recent events from Google Search.",
    parameters: { type: Type.OBJECT, properties: {} }
};

export const useGoogleMapsFunctionDeclaration: FunctionDeclaration = {
    name: 'useGoogleMaps',
    description: "Use to get location-based information, find places, or answer geography-related questions.",
    parameters: { type: Type.OBJECT, properties: {} }
};

export const requestLocationFunctionDeclaration: FunctionDeclaration = {
    name: 'requestLocation',
    description: "Requests the user's current geographic location (latitude and longitude) before using the Google Maps tool.",
    parameters: { type: Type.OBJECT, properties: {} }
};

export const requestPermissionFunctionDeclaration: FunctionDeclaration = {
    name: 'requestPermission',
    description: "Must be called before using any other tool that accesses a user's private data. Explain why you need access and which tool you intend to use.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            toolToCall: { type: Type.STRING, description: "The name of the tool you want to use after getting permission (e.g., 'getEmails')." },
            toolArgs: { type: Type.OBJECT, description: "The arguments you will pass to the tool after getting permission." },
            reason: { type: Type.STRING, description: "A friendly, user-facing explanation for why you need to access this data." }
        },
        required: ['toolToCall', 'reason']
    }
};

export const getEmailsFunctionDeclaration: FunctionDeclaration = { name: 'getEmails', description: "Fetches the user's unread emails.", parameters: { type: Type.OBJECT, properties: { accountIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Optional. Specific email accounts to check." } } } };
export const getCalendarEventsFunctionDeclaration: FunctionDeclaration = { name: 'getCalendarEvents', description: "Fetches today's upcoming calendar events.", parameters: { type: Type.OBJECT, properties: {} } };
export const createCalendarEventFunctionDeclaration: FunctionDeclaration = { name: 'createCalendarEvent', description: "Creates a new event in the user's calendar.", parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: "The title of the event." }, date: { type: Type.STRING, description: "The date of the event." }, time: { type: Type.STRING, description: "The time of the event." } }, required: ['title', 'date', 'time'] } };
export const getWellbeingDataFunctionDeclaration: FunctionDeclaration = { name: 'getWellbeingData', description: "Fetches the user's latest health data from a wearable device.", parameters: { type: Type.OBJECT, properties: {} } };
export const getSmartHomeStatusFunctionDeclaration: FunctionDeclaration = { name: 'getSmartHomeStatus', description: "Fetches the current status of connected smart home devices.", parameters: { type: Type.OBJECT, properties: {} } };
