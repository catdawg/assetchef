import { IPC } from "node-ipc";
import {
    AddReceiverFunction,
    createReceiver,
    createSender,
    SendFunction,
} from "typedcomm";

import { getMainCommPath } from "./commconfig";
import { IMainToRendererOneWayProtocol, IRendererToMainOneWayProtocol } from "./messages";

export interface IRendererCommunicator {
    send: SendFunction<IRendererToMainOneWayProtocol>;
    receive: AddReceiverFunction<IMainToRendererOneWayProtocol>;
}

export const rendererComm: IRendererCommunicator = {
    send: null,
    receive: null,
};

export async function connectToMain(id: string): Promise<{disconnect: () => void}> {
    return await new Promise((resolve) => {
        const ipc = new IPC();
        ipc.config.id = "RENDERER";
        ipc.config.retry = 1000;
        ipc.connectTo(
            "MAIN",
            getMainCommPath(id),
            () => {
                ipc.of.MAIN.on(
                    "connect",
                    () => {
                        ipc.of.MAIN.emit(
                            "REGISTER_RENDERER", {},
                        );

                        rendererComm.send = createSender<IMainToRendererOneWayProtocol>({
                            emit: (channel, data) => {
                                ipc.of.MAIN.emit(channel, data);
                            },
                        });
                        rendererComm.receive = createReceiver<IRendererToMainOneWayProtocol>({
                            addListener: (channel, listener) => {
                                ipc.of.MAIN.on(channel, listener);
                            },
                            removeListener: (channel, listener) => {
                                ipc.of.MAIN.off(channel, listener);
                            },
                        }),
                        resolve();
                    },
                );
            },
        );

        return {
            disconnect: () => {
                ipc.disconnect("MAIN");
            },
        };
    });
}
