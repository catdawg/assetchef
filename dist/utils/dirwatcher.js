"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
}
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
}
const chokidar = __importStar(require("chokidar"));
const events_1 = __importDefault(require("events"));
const fs = __importStar(require("fs"));
const verror_1 = require("verror");
const logger = __importStar(require("./logger"));
const pathchangeevent_1 = require("./path/pathchangeevent");
module.exports = class DirWatcher extends events_1.default {
    /**
     * DirEvent
     *
     * @event DirWatcher#pathchanged
     * @param {PathChangeEvent} event - see pathchangeevent.ts
     */
    /**
     * @param {string} directory - The directory to watch
     * @throws {verror.VError} if arguments are null or directory doesn't exist
     */
    constructor(directory) {
        if (directory == null) {
            throw new verror_1.VError("directory is null");
        }
        if (!fs.existsSync(directory)) {
            throw new verror_1.VError("directory does not exist");
        }
        super();
        this._directory = directory;
        this._chokidarWatcher = chokidar.watch(directory);
        this._chokidarWatcher.on("ready", () => {
            logger.logInfo("[Watch] now watching %s", directory);
            this._chokidarWatcher.on("add", (path) => {
                logger.logInfo("[Watch] detected add %s", path);
                this.emit("pathchanged", new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.Add, path));
            });
            this._chokidarWatcher.on("addDir", (path) => {
                logger.logInfo("[Watch] detected addDir %s", path);
                this.emit("pathchanged", new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.AddDir, path));
            });
            this._chokidarWatcher.on("change", (path) => {
                logger.logInfo("[Watch] detected change %s", path);
                this.emit("pathchanged", new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.Change, path));
            });
            this._chokidarWatcher.on("unlink", (path) => {
                logger.logInfo("[Watch] detected unlink %s", path);
                this.emit("pathchanged", new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.Unlink, path));
            });
            this._chokidarWatcher.on("unlinkDir", (path) => {
                logger.logInfo("[Watch] detected unlinkDir %s", path);
                this.emit("pathchanged", new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.UnlinkDir, path));
            });
        });
    }
    /**
     * Call this to cancel the watch
     * @returns {void}
     */
    cancel() {
        if (this._chokidarWatcher != null) {
            logger.logInfo("[Watch] cancelled watch on %s", this._directory);
            this._chokidarWatcher.close();
            this._chokidarWatcher = null;
        }
    }
};
//# sourceMappingURL=dirwatcher.js.map