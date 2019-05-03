import React, { useEffect, useState } from "react";
import { IProjOpenedMessage } from "../messenger/messages";
import { MessengerRenderer } from "../messenger/messengerrenderer";
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
            const newOpenProjects = openProjects.filter((s) => s !== path);

            setSelectedProject((project) => {
                if (project === path) {
                    if (newOpenProjects.length === 0) {
                        return "";
                    } else {
                        const newIndex = Math.min(newOpenProjects.length - 1, prevIndex);
                        return newOpenProjects[newIndex];
                    }
                }
            });

            return newOpenProjects;
        });
    }

    function handleProjectSelected(path: string) {
        setSelectedProject(path);
    }

    useEffect(() => {
        const subscription = MessengerRenderer.subscribe("PROJ_OPENING", (message) => {
            if (message.messageType === "PROJ_OPENED") {
                handleProjectOpened((message as IProjOpenedMessage).path);
            }
        });

        return () => {
            subscription.unsubscribe();
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
