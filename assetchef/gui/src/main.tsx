import {app, BrowserWindow, dialog} from "electron";
import { openProjectDialog } from "./actions";
import { setStartMenu } from "./menu";
import { MessengerMain } from "./messenger/messengermain";

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: BrowserWindow;

function createMainWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        useContentSize: true,
        webPreferences: {
          nodeIntegration: true,
        },
    });

    // and load the index.html of the app.
    mainWindow.loadURL("file://" + __dirname + "/../index.html");

    // Open the DevTools.
    // mainWindow.webContents.openDevTools()

    const openProjListener = MessengerMain.listen("OPEN_PROJ", (message, responseCallback) => {
        openProjectDialog(mainWindow).then((path) => {
            if (path == null) {
                responseCallback("PROJ_OPEN_CANCEL", {});
            } else {
                responseCallback("PROJ_OPENED", {path});
            }
        });
    });

    const projPublisher = MessengerMain.setupPublisher("PROJ_OPENING");

    setStartMenu(mainWindow, projPublisher);

    // Emitted when the window is closed.
    mainWindow.on("closed", () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
        openProjListener.cancel();
        projPublisher.cancel();
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
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
