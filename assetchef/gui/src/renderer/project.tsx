import { dialog } from "electron";
import React, { useState } from "react";
import { MessengerRenderer } from "../messenger/messengerrenderer";
import Recent from "./recent";

export interface IProps {
    projectPath: string;
}

export default function Project({projectPath}: IProps) {

    return (
        <div>
            <div>
                <img src="logo.svg" width="200" height="200"></img>
                <a>{projectPath}</a>
            </div>
        </div>
    );
}
