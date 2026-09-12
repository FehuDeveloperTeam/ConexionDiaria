import { IMessage } from 'react-native-gifted-chat';

// Extiende el tipo IMessage de GiftedChat con los campos propios del chat.
export interface ExtendedMessage extends IMessage {
    audio?: string;
    file?: string;
    fileName?: string;
    fileSize?: number;
    delivered?: boolean;
    read?: boolean;
    audioPlayed?: boolean;
    deleted?: boolean;
    sentAt?: Date;
}
