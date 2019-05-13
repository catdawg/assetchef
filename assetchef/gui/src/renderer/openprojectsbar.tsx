import React, { useState } from "react";

export interface IProps {
    openProjects: string[];
    selectedProject: string;
    onProjectClosed: (path: string) => void;
    onProjectSelected: (path: string) => void;
}

export default function OpenProjectsBar({openProjects, selectedProject, onProjectClosed, onProjectSelected}: IProps) {

    return (
        <div>
            {openProjects.map((path) =>
                <div key={"nav_" + path}>
                    {selectedProject === path && "("}
                    <button onClick={() => onProjectSelected(path)}>{path}</button>
                    <button onClick={() => onProjectClosed(path)}>x</button>
                    {selectedProject === path && ")"}
                </div>)}
        </div>
    );
}
