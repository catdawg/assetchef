"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chokidar = __importStar(require("chokidar"));
const events_1 = __importDefault(require("events"));
const fs = __importStar(require("fs"));
const pathutils = __importStar(require("path"));
const verror_1 = require("verror");
const pathchangeevent_1 = require("path/pathchangeevent");
const logger_1 = require("utils/logger");
/**
 * @fires DirWatcher#pathchanged
 */
class DirWatcher extends events_1.default {
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
        const removeDirectoryFromPath = (path) => {
            let newPath = path.substr(directory.length);
            while (newPath.charAt(0) === pathutils.sep) {
                newPath = newPath.substr(1);
            }
            return newPath;
        };
        this._directory = directory;
        this._chokidarWatcher = chokidar.watch(directory);
        this._chokidarWatcher.on("ready", () => {
            logger_1.logInfo("[Watch] now watching %s", directory);
            // this._chokidarWatcher.on("raw", (event: string, path: string, details: any) => {
            // logDebug("[Watch] %s raw event detected %s:%s details:%s", directory, event, path, details);
            // });
            /* istanbul ignore next */
            this._chokidarWatcher.on("error", (error) => {
                /* istanbul ignore next */
                logger_1.logWarn("[Watch] %s error %s", directory, error);
            });
            this._chokidarWatcher.on("add", (path) => {
                path = removeDirectoryFromPath(path);
                logger_1.logInfo("[Watch] %s detected add %s", directory, path);
                this.emit("pathchanged", new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.Add, path));
            });
            this._chokidarWatcher.on("addDir", (path) => {
                path = removeDirectoryFromPath(path);
                logger_1.logInfo("[Watch] %s detected addDir %s", directory, path);
                this.emit("pathchanged", new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.AddDir, path));
            });
            this._chokidarWatcher.on("change", (path) => {
                path = removeDirectoryFromPath(path);
                logger_1.logInfo("[Watch] %s detected change %s", directory, path);
                this.emit("pathchanged", new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.Change, path));
            });
            this._chokidarWatcher.on("unlink", (path) => {
                path = removeDirectoryFromPath(path);
                logger_1.logInfo("[Watch] %s detected unlink %s", directory, path);
                this.emit("pathchanged", new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.Unlink, path));
            });
            this._chokidarWatcher.on("unlinkDir", (path) => {
                path = removeDirectoryFromPath(path);
                logger_1.logInfo("[Watch] %s detected unlinkDir %s", directory, path);
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
            logger_1.logInfo("[Watch] cancelled watch on %s", this._directory);
            this._chokidarWatcher.close();
            this._chokidarWatcher = null;
        }
    }
}
exports.DirWatcher = DirWatcher;
//# sourceMappingURL=dirwatcher.js.map