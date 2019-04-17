import { ipcMain } from "electron";
import { IFromMainMessageMap, IFromRendererMessageMap } from "./messages";

interface ICancelListen {
    unlisten: () => void;
}

export class MessengerMain {

    public static send<MessageType extends keyof IFromMainMessageMap>(
        messageType: MessageType, message: IFromMainMessageMap[MessageType]) {
        ipcMain.emit(messageType, {messageType, ...message});
    }

    public static listen<MessageType extends keyof IFromRendererMessageMap>(
        messageType: MessageType,
        handler: (message: IFromRendererMessageMap[MessageType] & {messageType: MessageType}) => void,
    ): ICancelListen {
        ipcMain.addListener(messageType, handler);

        return {
            unlisten: () => ipcMain.removeListener(messageType, handler),
        };
    }
}
