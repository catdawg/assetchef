import React from "react";
import { IProjOpenedMessage } from "../messenger/messages";
import { MessengerRenderer } from "../messenger/messengerrenderer";
import Recent from "./recent";

export interface IProps {
    onProjectOpened: (path: string) => void;
}

export default function Start({onProjectOpened}: IProps) {

    function handleNewPressed() {
        MessengerRenderer.request("NEW_PROJ", {}).then((reply) => {
            if (reply.replyType === "PROJ_OPENED") {
                onProjectOpened((reply as IProjOpenedMessage).path);
            }
        });
    }
    function handleOpenPressed() {
        MessengerRenderer.request("OPEN_PROJ", {}).then((reply) => {
            if (reply.replyType === "PROJ_OPENED") {
                onProjectOpened((reply as IProjOpenedMessage).path);
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
