import { ipcMain, WebContents } from "electron";
import {
    FullMessage,
    IReplyMap,
    ISubscriptionMap,
    Message,
    Reply,
    SubbedMessage,
    Subscription} from "./messages";

export type ResponderCallback<T extends keyof IReplyMap> =
    <V extends IReplyMap[T]>(replyType: V, reply: Message<V>) => void;

export interface IPublisher<T extends Subscription> {
    dispatch: <V extends ISubscriptionMap[T]>(messageType: V, msg: Message<V>) => void;
    cancel: () => void;
}

export interface IListener {
    cancel: () => void;
}

export class MessengerMain {

    public static listen<T extends keyof IReplyMap>(
        messageType: T,
        handler: (
            message: Message<T>,
            responseCallback: ResponderCallback<T>) => void,
    ): IListener {

        ipcMain.on(messageType, (event: any, arg: FullMessage<T>) => {
            handler(arg, (replyType: IReplyMap[T], reply: Reply<T>) => {
                event.sender.send("REPLY_" + messageType + "_" + arg.messageID, {replyType, ...reply});
            });
        });

        return {
            cancel: () => ipcMain.removeListener(messageType, handler),
        };
    }

    public static setupPublisher<T extends Subscription>(subscriptionType: T): IPublisher<T> {
        let subs: WebContents[] = [];

        const channel = "SUBSCRIBE_" + subscriptionType;

        const subscribeHandler = (event: any, msg: {}) => {
            subs.push(event.sender);
            event.sender.on("destroyed", () => {
                subs = subs.filter((s) => s !== event.sender);
            });
        };
        ipcMain.on(channel, subscribeHandler);

        return {
            dispatch: (messageType, msg) => {
                subs = subs.filter((s) => !s.isDestroyed());
                for (const sub of subs) {
                    sub.send("SUBBED_" + subscriptionType, {messageType, ...msg});
                }
            },
            cancel: () => {
                ipcMain.removeListener(channel, subscribeHandler);
            },
        };
    }
}
