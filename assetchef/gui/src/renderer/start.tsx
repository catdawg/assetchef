import React from "react";

import { rendererComm } from "../communication/renderercomm";
import Recent from "./recent";

export interface IProps {
    onProjectOpened: (path: string) => void;
}

export default function Start({onProjectOpened}: IProps) {

    function handleNewPressed() {
        rendererComm.send("NEW_PROJ", null);
    }
    function handleOpenPressed() {
        rendererComm.send("OPEN_PROJ", null);
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
