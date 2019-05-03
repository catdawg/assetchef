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
