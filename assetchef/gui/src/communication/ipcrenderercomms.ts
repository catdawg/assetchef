import { ipcRenderer } from "electron";
import {
    AddAnswerUntypedFunction,
    AddHearUntypedFunction,
    AskUntypedFunction,
    createAnswerer,
    createAsker,
    createHearer,
    createTeller,
    TellUntypedFunction} from "./comms";
import { IMainQuestions, IMessageMap, IRendererQuestions } from "./messages";

const ipcAsker: AskUntypedFunction =
    async (channel: string, message: any): Promise<{type: string, message: any}> => {
        return await new Promise((resolve) => {
            const messageID = Math.random().toString(36).substring(7);

            ipcRenderer.once("REPLY_" + channel + "_" + messageID,
                (_event: string, arg: any) => {
                    resolve(arg);
            });
            ipcRenderer.send("ASK_" + channel, {messageID, message});
        });
};

const ipcAnswerer: AddAnswerUntypedFunction =
    (channel, handler) => {

    const askChannel = "ASK_" + channel;

    const askHandler = (event: any, {messageID, message}: {messageID: string, message: any}) => {

        const replyChannel = "REPLY_" + channel + "_" + messageID;
        handler(message).then((reply) => {
            event.sender.send(replyChannel, reply);
        });
    };
    ipcRenderer.on(askChannel, askHandler);

    return {
        cancel: () => ipcRenderer.removeListener(askChannel, askHandler),
    };
};

const ipcTeller: TellUntypedFunction = (channel, message) => {
    ipcRenderer.send(channel, message);
};

const ipcHear: AddHearUntypedFunction = (messageName, handler) => {

    const hand = (_event: any, msg: any) => {
        handler(msg);
    };

    ipcRenderer.on(messageName, hand);

    return {
        cancel: () => {
            ipcRenderer.removeListener(messageName, hand);
        },
    };
};

export const ipcRendererAsker = createAsker<IMessageMap, IRendererQuestions>(
    ipcAsker,
);

export const ipcRendererTeller = createTeller<IMessageMap>(
    ipcTeller,
);

export const ipcRendererHearer = createHearer<IMessageMap>(
    ipcHear,
);

export const ipcRendererAnswerer = createAnswerer<IMessageMap, IMainQuestions>(
    ipcAnswerer,
);
