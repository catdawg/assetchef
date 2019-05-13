import React from "react";

import { ipcRendererAsker } from "../communication/ipcrenderercomms";
import { IProjOpenedMessage } from "../communication/messages";
import Recent from "./recent";

export interface IProps {
    onProjectOpened: (path: string) => void;
}

export default function Start({onProjectOpened}: IProps) {

    function handleNewPressed() {
        ipcRendererAsker.ask("NEW_PROJ", {}).then((reply) => {
            if (reply.type === "PROJ_OPENED") {
                onProjectOpened((reply.message as IProjOpenedMessage).path);
            }
        });
    }
    function handleOpenPressed() {
        ipcRendererAsker.ask("OPEN_PROJ", {}).then((reply) => {
            if (reply.type === "PROJ_OPENED") {
                onProjectOpened((reply.message as IProjOpenedMessage).path);
            }
        });
    }

    return (
        <div>
            <div>
                <img src="logo.svg" width="200" height="200"></img>
            </div>
            <button onClick={handleNewPressed}>New</button>
            <button onClick={handleOpenPressed}>Open</button>
            <Recent />
        </div>
    );
}
