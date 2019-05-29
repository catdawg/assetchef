import {app, BrowserWindow} from "electron";

import { newProjectDialog, openProjectDialog } from "./actions";
import { mainComm, startServer } from "./communication/maincomm";
import { setStartMenu } from "./menu";

let mainWindow: BrowserWindow;

function createMainWindow() {

    const uniqueId = Math.floor(Math.random() * Math.floor(Number.MAX_SAFE_INTEGER));
    startServer("" + uniqueId).then(() => {
        mainWindow = new BrowserWindow({
            useContentSize: true,
            webPreferences: {
              nodeIntegration: true,
            },
        });

        mainWindow.loadURL("file://" + __dirname + "/../index.html?uniqueid=" + uniqueId);

        // mainWindow.webContents.openDevTools()

        const openProjListener = mainComm.receive("OPEN_PROJ", () => {

            openProjectDialog(mainWindow).then((path) => {
                if (path != null) {
                    mainComm.send("PROJ_OPENED", {path});
                }
            });
        });

        const newProjListener = mainComm.receive("NEW_PROJ", async () => {
            newProjectDialog(mainWindow).then((path) => {
                if (path != null) {
                    mainComm.send("PROJ_OPENED", {path});
                }
            });
        });

        setStartMenu(mainWindow, mainComm);

        mainWindow.on("closed", () => {
            mainWindow = null;
            newProjListener.cancel();
            openProjListener.cancel();
        });
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
