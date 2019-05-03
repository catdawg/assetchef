import { BrowserWindow, Menu, MenuItemConstructorOptions } from "electron";
import { openProjectDialog } from "./actions";
import { IPublisher } from "./messenger/messengermain";

export function setStartMenu(
    mainWindow: BrowserWindow,
    openProjectPublisher: IPublisher<"PROJ_OPENING">,
) {
    const template: MenuItemConstructorOptions[] = [
        {
            label: "File",
            submenu: [
                { label: "New" },
                {
                    label: "Open", click: () => {
                        openProjectDialog(mainWindow).then((path) => {
                            if (path == null) {
                                openProjectPublisher.dispatch("PROJ_OPEN_CANCEL", {});
                            } else {
                                openProjectPublisher.dispatch("PROJ_OPENED", { path });
                            }
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
