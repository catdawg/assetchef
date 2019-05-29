import { BrowserWindow, Menu, MenuItemConstructorOptions } from "electron";

import { newProjectDialog, openProjectDialog } from "./actions";
import { IMainCommunicator } from "./communication/maincomm";

export function setStartMenu(
    mainWindow: BrowserWindow,
    mainCommunicator: IMainCommunicator,
) {
    const template: MenuItemConstructorOptions[] = [
        {
            label: "File",
            submenu: [
                {
                    label: "New", click: () => {
                        newProjectDialog(mainWindow).then((path) => {
                            mainCommunicator.send("PROJ_OPENED", {path});
                        });
                    },
                },
                {
                    label: "Open", click: () => {
                        openProjectDialog(mainWindow).then((path) => {
                            mainCommunicator.send("PROJ_OPENED", {path});
                        });
                    },
                },
                { type: "separator" },
                process.platform === "darwin" ? { role: "close" } : { role: "quit" },
            ],
        },
        {
            label: "Edit",
            submenu: [
                { role: "undo" },
                { role: "redo" },
                { type: "separator" },
                { role: "cut" },
                { role: "copy" },
                { role: "paste" },
            ],
        },
        {
            label: "View",
            submenu: [
                { role: "reload" },
                { role: "toggledevtools" },
                { type: "separator" },
                { role: "resetzoom" },
                { role: "zoomin" },
                { role: "zoomout" },
                { type: "separator" },
                { role: "togglefullscreen" },
            ],
        },
        {
            role: "window",
            submenu: [
                { role: "minimize" },
                { role: "close" },
            ],
        },
        {
            role: "help",
            submenu: [
                { label: "Learn More" },
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}
