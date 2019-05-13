import { BrowserWindow, dialog } from "electron";

export function openProjectDialog(window: BrowserWindow): Promise<string | null> {
    return new Promise((resolve) => {
        dialog.showOpenDialog(window, {
            filters: [{name: "project file", extensions: ["json"]}],
            buttonLabel: "Open",
            properties: ["openFile"],
            title: "Open project!",
        }, (filePaths, bookmarks) => {
            if (filePaths != null && filePaths.length > 0) {
                resolve(filePaths[0]);
            } else {
                resolve(null);
            }
        } );
    });
}

export function newProjectDialog(window: BrowserWindow): Promise<string | null> {
    return new Promise((resolve) => {
        dialog.showSaveDialog(window, {
            filters: [{name: "project file", extensions: ["json"]}],
            buttonLabel: "New",
            defaultPath: "assetchef.json",
            title: "New project!",
        }, (filePath, bookmarks) => {
            if (filePath != null) {
                resolve(filePath);
            } else {
                resolve(null);
            }
        } );
    });
}
