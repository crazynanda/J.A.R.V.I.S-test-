
export type MessageAuthor = 'user' | 'ai';

export interface ChatMessage {
    author: MessageAuthor;
    text: string;
}
