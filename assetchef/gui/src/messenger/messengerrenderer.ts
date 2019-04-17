import { ipcRenderer } from "electron";
import { IFromMainMessageMap, IFromRendererMessageMap } from "./messages";

interface ICancelListen {
    unlisten: () => void;
}

export class MessengerRenderer {

    public static send<MessageType extends keyof IFromRendererMessageMap>(
        messageType: MessageType, message: IFromRendererMessageMap[MessageType]) {
        ipcRenderer.send(messageType, {messageType, ...message});
    }

    public static listen<MessageType extends keyof IFromMainMessageMap>(
        messageType: MessageType,
        handler: (message: IFromMainMessageMap[MessageType] & {messageType: MessageType}) => void,
    ): ICancelListen {
        ipcRenderer.addListener(messageType, handler);

        return {
            unlisten: () => ipcRenderer.removeListener(messageType, handler),
        };
    }
}
