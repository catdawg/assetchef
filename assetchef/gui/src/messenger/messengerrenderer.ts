import { ipcRenderer } from "electron";
import { FullMessage, FullReply, FullSubbedMessage, Message, Req, Subscription } from "./messages";

export class MessengerRenderer {

    public static async request<T extends Req>(
        messageType: T,
        message: Message<T>,
    ): Promise<FullReply<T>> {
        return await new Promise((resolve) => {
            const messageID = Math.random().toString(36).substring(7);

            ipcRenderer.once("REPLY_" + messageType + "_" + messageID,
                (_event: string, arg: FullReply<T>) => {
                    resolve(arg);
            });
            ipcRenderer.send(messageType, {messageID, ...message} as FullMessage<T>);
        });
    }

    public static subscribe<T extends Subscription>(
        messageType: T,
        callback: (message: FullSubbedMessage<T>) => void): {unsubscribe: () => void} {

        const handler = (_event: any, msg: FullSubbedMessage<T>) => {
            callback(msg);
        };
        const channel = "SUBBED_" + messageType;
        ipcRenderer.on(channel, handler);
        ipcRenderer.send("SUBSCRIBE_" + messageType, {});

        return {
            unsubscribe: () => {
                ipcRenderer.send("UNSUBSCRIBE_" + messageType, {});
                ipcRenderer.removeListener(channel, handler);
            },
        };
    }
}
