import { IPC } from "node-ipc";
import {
    AddReceiverFunction,
    createReceiver,
    createSender,
    SendFunction,
} from "typedcomm";
import { getMainCommPath } from "./commconfig";
import {
    IMainToRendererOneWayProtocol,
    IRendererToMainOneWayProtocol,
} from "./messages";

export interface IMainCommunicator {
    send: SendFunction<IMainToRendererOneWayProtocol>;
    receive: AddReceiverFunction<IRendererToMainOneWayProtocol>;
}

export const mainComm: IMainCommunicator = {
    send: null,
    receive: null,
};

export async function startServer(id: string): Promise<void> {

    await new Promise((resolve) => {

        const ipc = new IPC();
        ipc.config.appspace = "assetchef";
        ipc.config.id = "MAIN";
        ipc.config.retry = 1500;
        let mainWindowSocket: any = null;

        ipc.serve(getMainCommPath(id), () => {
            ipc.server.on(
                "REGISTER_RENDERER",
                (_, socket) => {
                    mainWindowSocket = socket;
                },
            );

            mainComm.send = createSender<IMainToRendererOneWayProtocol>({
                emit: (channel, data) => {
                    if (mainWindowSocket == null) {
                        return;
                    }
                    ipc.server.emit(
                        mainWindowSocket,
                        channel, data,
                    );
                },
            }),
            mainComm.receive = createReceiver<IRendererToMainOneWayProtocol>({
                addListener: (channel, listener) => {
                    ipc.server.on(channel, listener);
                },
                removeListener: (channel, listener) => {
                    ipc.server.off(channel, listener);
                },
            }),
            resolve();
        });

        ipc.server.start();
    });
}
