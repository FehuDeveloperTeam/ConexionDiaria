import { IMessage } from 'react-native-gifted-chat';

// Extiende el tipo IMessage de GiftedChat con los campos propios del chat.
export interface ExtendedMessage extends IMessage {
    audio?: string;
    audioDuration?: number;
    // Sprint 9.23. 'videoDuration' viene en milisegundos, igual que el audio.
    video?: string;
    videoDuration?: number;
    file?: string;
    fileName?: string;
    fileSize?: number;
    delivered?: boolean;
    read?: boolean;
    audioPlayed?: boolean;
    deleted?: boolean;
    sentAt?: Date;
}
