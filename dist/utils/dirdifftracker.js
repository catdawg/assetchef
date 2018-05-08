"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
}
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs-extra"));
const pathutils = __importStar(require("path"));
const verror_1 = require("verror");
const hash_1 = require("./hash");
const jsonvalidation_1 = require("./jsonvalidation");
const logger = __importStar(require("./logger"));
const pathchangeevent_1 = require("./path/pathchangeevent");
const pathtree_1 = require("./path/pathtree");
const SERIALIZATION_VERSION = 1;
const SERIALIZATION_FILENAME = ".assetchef";
const serializationSchema = {
    additionalProperties: false,
    definitions: {
        file: {
            type: "array",
            items: [
                {
                    type: "string",
                },
                {
                    type: "string",
                },
            ],
        },
    },
    properties: {
        content: {
            type: "array",
            items: {
                oneOf: [
                    {
                        type: "string",
                    },
                    {
                        $ref: "#/definitions/file",
                    },
                ],
            },
        },
        version: {
            type: "integer",
        },
    },
    required: ["version", "content"],
};
/**
 * This class builds a representation of the directory, which can later be compared to look for changes.
 * @property {function()} _debugWaitPromise
 */
class DirDiffTracker {
    /**
     * @param {string} path - the full path to the directory
     * @throws {VError} if the path is null
     */
    constructor(path) {
        if (path == null) {
            throw new verror_1.VError("path is null");
        }
        this._path = path;
        this._cancelled = false;
        this._content = null;
        this._debugWaitPromise = null;
        this._debugWaitTicks = 0;
    }
    /**
     * Traverses the directory to retrieve it's structure recursively and the hashes of the files.
     * @returns {Promise<boolean>} returns true if the build finishes successfully, otherwise, returns false
     */
    build() {
        return __awaiter(this, void 0, void 0, function* () {
            this._cancelled = false;
            const content = new pathtree_1.PathTree();
            const pathsToProcess = [""];
            while (pathsToProcess.length > 0) {
                const dirElemPath = pathsToProcess.pop();
                const fullPathDirElem = pathutils.join(this._path, dirElemPath);
                let dirList = null;
                try {
                    if (this._debugWaitTicks > 0) {
                        yield this._debugRunWaitTick("[Dir] wait tick before readdir %s", fullPathDirElem);
                    }
                    dirList = yield fs.readdir(fullPathDirElem);
                }
                catch (err) {
                    logger.logWarn("[Dir] Failed to readdir %s", fullPathDirElem);
                    return false;
                }
                for (const elem of dirList) {
                    const fullElemPath = pathutils.join(fullPathDirElem, elem);
                    const elemPath = pathutils.join(dirElemPath, elem);
                    let stat = null;
                    try {
                        if (this._debugWaitTicks > 0) {
                            yield this._debugRunWaitTick("[Dir] Wait tick stat %s", fullElemPath);
                        }
                        stat = yield fs.stat(fullElemPath);
                    }
                    catch (err) {
                        logger.logWarn("[Dir] Failed to stat %s", fullElemPath);
                        return false;
                    }
                    if (stat.isDirectory()) {
                        pathsToProcess.push(elemPath);
                        content.mkdir(elemPath);
                    }
                    else {
                        content.set(elemPath, hash_1.hashFSStat(stat));
                    }
                    if (this._debugWaitTicks > 0) {
                        yield this._debugRunWaitTick("[Dir] wait tick cancelled 1");
                    }
                    if (this._cancelled) {
                        return false;
                    }
                }
                if (this._debugWaitTicks > 0) {
                    yield this._debugRunWaitTick("[Dir] wait tick cancelled 2");
                }
                if (this._cancelled) {
                    return false;
                }
            }
            this._content = content;
            return true;
        });
    }
    /**
     * This method tries to find a ".assetchef" file inside the directory, and calls deserialize on it.
     * If anything strange happens, this will return false, and it should be executed again.
     * If an expected error happens like file isn't there or file is corrupted, then this will return true.
     * @returns {Promise<void>} the async method return
     */
    buildFromPrevImage() {
        return __awaiter(this, void 0, void 0, function* () {
            const serializationFilePath = pathutils.join(this._path, SERIALIZATION_FILENAME);
            let prevDirSerialized = null;
            try {
                prevDirSerialized = yield fs.readFile(serializationFilePath, "utf8");
            }
            catch (err) {
                logger.logInfo("[Dir] Error '%s' reading '%s'", err, serializationFilePath);
                this._content = new pathtree_1.PathTree();
                return;
            }
            if (!this.deserialize(prevDirSerialized)) {
                logger.logWarn("[Dir] Error deserializing '%s', deleting since it's probably corrupted.", serializationFilePath);
                yield fs.remove(serializationFilePath);
                this._content = new pathtree_1.PathTree();
                return;
            }
            return;
        });
    }
    /**
     * Calls serialize and saves a .assetchef file in the directory
     * @returns {Promise<boolean>} true if successful save
     */
    saveToImage() {
        return __awaiter(this, void 0, void 0, function* () {
            const serializationFilePath = pathutils.join(this._path, SERIALIZATION_FILENAME);
            const serializedString = this.serialize();
            try {
                yield fs.writeFile(serializationFilePath, serializedString);
            }
            catch (err) {
                logger.logWarn("[Dir] Error %s writing %s", err, serializationFilePath);
                return false;
            }
            return true;
        });
    }
    /**
     * Makes the build exit gracefully in case it was running, this should be called if something
     * changes inside the directory being built, or if we need to exit for some reason
     * @returns {void}
     */
    cancelBuild() {
        this._cancelled = true;
    }
    /**
     * @returns {string[]} list of paths in directory
     * @throws {VError} if you try to use this without having a successful build/deserialize first
     */
    getPathList() {
        if (this._content == null) {
            throw new verror_1.VError("Tried to get path list without properly building first.");
        }
        const list = [];
        const directoriesToProcess = [""];
        while (directoriesToProcess.length > 0) {
            const dirPath = directoriesToProcess.pop();
            for (const elemPath of this._content.list(dirPath)) {
                list.push(elemPath);
                if (this._content.isDir(elemPath)) {
                    directoriesToProcess.push(elemPath);
                }
            }
        }
        return list;
    }
    /**
     * @returns {string} the serialized directory
     * @throws {VError} if you try to serialize without having a successful build/deserialize first
     */
    serialize() {
        if (this._content == null) {
            throw new verror_1.VError("Tried to serialize without properly building first.");
        }
        const allpaths = this._content.listAll();
        const data = new Array();
        for (const path of allpaths) {
            if (!this._content.isDir(path)) {
                data.push([path, this._content.get(path)]);
            }
            else {
                data.push(path);
            }
        }
        const obj = {
            content: data,
            version: SERIALIZATION_VERSION,
        };
        return JSON.stringify(obj);
    }
    /**
     * @param {string} jsonString the same string outputted by serialize()
     * @returns {boolean} if successful or not.
     */
    deserialize(jsonString) {
        if (jsonString == null || jsonString === "") {
            logger.logWarn("[Dir] json used to deserialize was null or empty.");
            return false;
        }
        let obj = null;
        try {
            obj = JSON.parse(jsonString);
        }
        catch (e) {
            logger.logWarn("[Dir] malformed json '%s' used to deserialize.", jsonString);
            return false;
        }
        const result = jsonvalidation_1.validateJSON(obj, serializationSchema);
        if (result.errors != null) {
            logger.logWarn("[Dir] json structure '%s' could not be validated.", jsonString);
            return false;
        }
        if (obj.version !== SERIALIZATION_VERSION) {
            logger.logWarn("[Dir] json structure has a version that is different, can't deserialize");
            return false;
        }
        this._content = new pathtree_1.PathTree();
        for (const pathOrData of obj.content) {
            if (typeof (pathOrData) !== "string") {
                this._content.set(pathOrData[0], pathOrData[1]);
            }
            else {
                this._content.mkdir(pathOrData);
            }
        }
        return true;
    }
    /**
     * This method will compare the current Dir against another one.
     * The output is a list of PathChangeEvent that represents the differences.
     * @param {DirDiffTracker} olderDir the Dir to be compared.
     * @throws {VError} if this or the other dir wasn't properly initialized.
     * @returns {PathChangeEvent[]} A list of PathChangeEvent
     */
    compare(olderDir) {
        if (this._content == null || olderDir == null || olderDir._content == null) {
            throw new verror_1.VError("To compare, both Dirs have to have been properly built with build or deserialize.");
        }
        const diffList = [];
        const dirsToProcess = [""];
        // additions and changes
        for (const dirPath of dirsToProcess) {
            for (const fullPath of this._content.list(dirPath)) {
                const newElem = this._content.get(fullPath, true);
                const olderElem = olderDir._content.get(fullPath, true);
                if (olderDir._content.exists(fullPath)) {
                    // already existed
                    if (this._content.isDir(fullPath)) {
                        if (!olderDir._content.isDir(fullPath)) {
                            diffList.push(new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.Unlink, fullPath));
                            diffList.push(new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.AddDir, fullPath));
                        }
                        else {
                            dirsToProcess.push(fullPath);
                        }
                    }
                    else {
                        if (olderDir._content.isDir(fullPath)) {
                            diffList.push(new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.UnlinkDir, fullPath));
                            diffList.push(new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.Add, fullPath));
                        }
                        else if (newElem !== olderElem) {
                            diffList.push(new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.Change, fullPath));
                        }
                    }
                }
                else {
                    // new path
                    if (this._content.isDir(fullPath)) {
                        diffList.push(new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.AddDir, fullPath));
                    }
                    else {
                        diffList.push(new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.Add, fullPath));
                    }
                }
            }
            // removals
            for (const fullPath of olderDir._content.list(dirPath)) {
                if (!this._content.exists(fullPath)) {
                    if (olderDir._content.isDir(fullPath)) {
                        diffList.push(new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.UnlinkDir, fullPath));
                    }
                    else {
                        diffList.push(new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.Unlink, fullPath));
                    }
                }
            }
        }
        return diffList;
    }
    /**
     * Testing method used to stop the application in specific situations, so errors can be triggered.
     * @param {number} count ticks to wait for
     * @param {function():PromiseLike<void>} promiseToWaitForAfterTicksFinish what is waited for after ticks reach zero.
     * @returns {void}
     */
    _debugWaitForTicks(count, promiseToWaitForAfterTicksFinish) {
        this._debugWaitPromise = promiseToWaitForAfterTicksFinish;
        this._debugWaitTicks = count;
    }
    /**
     * Test method to stop the app in specific places.
     * @returns {Promise<void>} the wait promise
     */
    _debugRunWaitTick(...loggingArgs) {
        return __awaiter(this, void 0, void 0, function* () {
            --this._debugWaitTicks;
            logger.logDebug.apply(this, loggingArgs);
            if (this._debugWaitTicks === 0) {
                logger.logDebug("[Dir] running tick promise");
                yield this._debugWaitPromise();
                this._debugWaitPromise = null;
            }
        });
    }
}
exports.DirDiffTracker = DirDiffTracker;
//# sourceMappingURL=dirdifftracker.js.map