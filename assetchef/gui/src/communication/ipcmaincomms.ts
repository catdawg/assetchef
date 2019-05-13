import { BrowserWindow, ipcMain } from "electron";

import {
    AddAnswerUntypedFunction,
    AddHearUntypedFunction,
    createAnswerer,
    createAsker,
    createHearer,
    createTeller,
} from "./comms";
import {
    IMainQuestions,
    IMessageMap,
    IRendererQuestions,
} from "./messages";

const ipcAnswerer: AddAnswerUntypedFunction =
    (channel, handler) => {

    const askChannel = "ASK_" + channel;

    const askHandler = (event: any, {messageID, message}: {messageID: string, message: any}) => {

        const replyChannel = "REPLY_" + channel + "_" + messageID;
        handler(message).then((reply) => {
            event.sender.send(replyChannel, reply);
        });
    };
    ipcMain.on(askChannel, askHandler);

    return {
        cancel: () => ipcMain.removeListener(askChannel, askHandler),
    };
};

const ipcHear: AddHearUntypedFunction = (messageName, handler) => {

    const hand = (_event: any, msg: any) => {
        handler(msg);
    };

    ipcMain.on(messageName, hand);

    return {
        cancel: () => {
            ipcMain.removeListener(messageName, hand);
        },
    };
};

const getIpcAskerForWindow = (window: BrowserWindow) => {
    return async (channel: string, message: any): Promise<{type: string, message: any}> => {
        return await new Promise((resolve) => {
            const messageID = Math.random().toString(36).substring(7);

            ipcMain.once("REPLY_" + channel + "_" + messageID,
                (_event: string, arg: any) => {
                    resolve(arg);
            });
            window.webContents.send("ASK_" + channel, {messageID, message});
        });
    };
};

export const ipcMainAnswerer =
    createAnswerer<IMessageMap, IRendererQuestions>(ipcAnswerer);

export const ipcMainHearer =
    createHearer<IMessageMap>(ipcHear);

export const createIpcMainTeller = (window: BrowserWindow) => {
    return createTeller<IMessageMap>((channel: any, message: any) => {
        window.webContents.send(channel, message);
    });
};

export const createIpcMainAskerForWindow = (window: BrowserWindow) => {
    createAsker<IMessageMap, IMainQuestions>(getIpcAskerForWindow(window));
};
