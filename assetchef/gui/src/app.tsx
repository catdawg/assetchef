import { dialog } from "electron";
import React, { useState } from "react";
import { MessengerRenderer } from "./messenger/messengerrenderer";
import Recent from "./recent";

export default function App() {

    function handleNewPressed() {
        MessengerRenderer.send("OPEN_PROJ", {});
    }
    return (
        <div>
            <div>
                <img src="logo.svg" width="200" height="200"></img>
            </div>
            <button onClick={handleNewPressed}>New</button>
            <button>Open</button>
            <Recent />
        </div>
    );
}
