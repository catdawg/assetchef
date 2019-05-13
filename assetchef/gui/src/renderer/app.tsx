import React, { useEffect, useState } from "react";
import { ipcRendererAsker, ipcRendererHearer } from "../communication/ipcrenderercomms";
import { IProjOpenedMessage } from "../communication/messages";
import OpenProjectsBar from "./openprojectsbar";
import Project from "./project";
import Start from "./start";

export default function App() {

    const [openProjects, setOpenProjects] = useState<string[]>([]);
    const [selectedProject, setSelectedProject] = useState<string>("");

    function handleProjectOpened(path: string) {

        setOpenProjects((projects) => [path, ...projects]);
        setSelectedProject(path);
        return;
    }

    function handleProjectClosed(path: string) {

        setOpenProjects((projects) => {
            const prevIndex = projects.indexOf(selectedProject);
            const newOpenProjects = projects.filter((s) => s !== path);

            setSelectedProject((project) => {
                if (project === path) {
                    if (newOpenProjects.length === 0) {
                        return "";
                    } else {
                        const newIndex = Math.min(newOpenProjects.length - 1, prevIndex);
                        return newOpenProjects[newIndex];
                    }
                }
                return project;
            });

            return newOpenProjects;
        });
    }

    function handleProjectSelected(path: string) {
        setSelectedProject(path);
    }

    useEffect(() => {
        const cancelHear = ipcRendererHearer.hear("PROJ_OPENED", (message) => {
            handleProjectOpened((message).path);
        });
        return () => {
            cancelHear.cancel();
        };
    }, []);

    if (openProjects.length === 0) {
        return (
            <Start onProjectOpened={handleProjectOpened}/>
        );
    } else {
        return <div>
            <OpenProjectsBar
                openProjects={openProjects}
                selectedProject={selectedProject}
                onProjectClosed={handleProjectClosed}
                onProjectSelected={handleProjectSelected} />
            <Project projectPath={openProjects[openProjects.indexOf(selectedProject)]} />
        </div>;

    }
}
