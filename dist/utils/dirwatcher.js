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
const dirchangeevent_1 = require("./dirchangeevent");
const logger = __importStar(require("./logger"));
module.exports = class DirWatcher extends events_1.default {
    /**
     * Add DirEvent
     *
     * @event DirWatcher#dirchanged
     * @param {DirChangeEvent} event - see dirchangeevent.js
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
                this.emit("dirchanged", new dirchangeevent_1.DirChangeEvent(dirchangeevent_1.DirEventType.Add, path));
            });
            this._chokidarWatcher.on("addDir", (path) => {
                logger.logInfo("[Watch] detected addDir %s", path);
                this.emit("dirchanged", new dirchangeevent_1.DirChangeEvent(dirchangeevent_1.DirEventType.AddDir, path));
            });
            this._chokidarWatcher.on("change", (path) => {
                logger.logInfo("[Watch] detected change %s", path);
                this.emit("dirchanged", new dirchangeevent_1.DirChangeEvent(dirchangeevent_1.DirEventType.Change, path));
            });
            this._chokidarWatcher.on("unlink", (path) => {
                logger.logInfo("[Watch] detected unlink %s", path);
                this.emit("dirchanged", new dirchangeevent_1.DirChangeEvent(dirchangeevent_1.DirEventType.Unlink, path));
            });
            this._chokidarWatcher.on("unlinkDir", (path) => {
                logger.logInfo("[Watch] detected unlinkDir %s", path);
                this.emit("dirchanged", new dirchangeevent_1.DirChangeEvent(dirchangeevent_1.DirEventType.UnlinkDir, path));
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