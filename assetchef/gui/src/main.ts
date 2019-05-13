import {app, BrowserWindow, dialog} from "electron";

import { newProjectDialog, openProjectDialog } from "./actions";
import { ipcMainAnswerer } from "./communication/ipcmaincomms";
import { setStartMenu } from "./menu";

let mainWindow: BrowserWindow;

function createMainWindow() {
    mainWindow = new BrowserWindow({
        useContentSize: true,
        webPreferences: {
          nodeIntegration: true,
        },
    });

    mainWindow.loadURL("file://" + __dirname + "/../index.html");

    // mainWindow.webContents.openDevTools()

    const openProjListener = ipcMainAnswerer.answer("OPEN_PROJ", async (message) => {
        const path = await openProjectDialog(mainWindow);

        if (path == null) {
            return {
                type: "PROJ_OPEN_CANCEL",
                message: {},
            };
        } else {
            return {
                type: "PROJ_OPENED",
                message: {path},
            };
        }
    });

    const newProjListener = ipcMainAnswerer.answer("NEW_PROJ", async (message) => {
        const path = await newProjectDialog(mainWindow);
        if (path == null) {
            return {
                type: "PROJ_OPEN_CANCEL",
                message: {},
            };
        } else {
            return {
                type: "PROJ_OPENED",
                message: {path},
            };
        }
    });

    setStartMenu(mainWindow);

    mainWindow.on("closed", () => {
        mainWindow = null;
        newProjListener.cancel();
        openProjListener.cancel();
    });
}

app.on("ready", createMainWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createMainWindow();
    }
});
