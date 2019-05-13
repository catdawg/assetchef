import React, { useState } from "react";

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
