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
const fs = __importStar(require("fs-extra"));
const pathutils = __importStar(require("path"));
const verror_1 = require("verror");
const dirchangeevent_1 = require("./dirchangeevent");
const hash_1 = require("./hash");
const jsonvalidation_1 = require("./jsonvalidation");
const logger = __importStar(require("./logger"));
const SERIALIZATION_VERSION = 1;
const SERIALIZATION_FILENAME = ".assetchef";
const serializationSchema = {
    additionalProperties: false,
    definitions: {
        dir: {
            additionalProperties: {
                oneOf: [
                    { type: "string" },
                    { $ref: "#/definitions/dir" },
                ],
            },
            type: "object",
        },
    },
    properties: {
        content: {
            $ref: "#/definitions/dir",
        },
        version: {
            type: "integer",
        },
    },
    required: ["version", "content"],
};
/**
 * Holder object for a file and its hash.
 */
class FileElem {
    /**
     * @param {string} statHash - the current hash from fs.stat from the file
     */
    constructor(statHash) {
        this.statHash = statHash;
    }
}
/**
 * Holder object for a directory and it's contents, which is a map of FileElem and DirElem.
 * Initially it has no content, it is meant to be filled later.
 */
class DirElem {
}
module.exports = class Dir {
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
            const content = new DirElem();
            const directoriesToProcess = [content];
            const pathsToProcess = [""];
            while (directoriesToProcess.length > 0) {
                const dirElem = directoriesToProcess.pop();
                const dirElemPath = pathsToProcess.pop();
                const fullPathDirElem = pathutils.join(this._path, dirElemPath);
                const dirContents = new Map();
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
                        const newDirElem = new DirElem();
                        dirContents.set(elemPath, newDirElem);
                        directoriesToProcess.push(newDirElem);
                        pathsToProcess.push(elemPath);
                    }
                    else {
                        dirContents.set(elemPath, new FileElem(hash_1.hashFSStat(stat)));
                    }
                    if (this._debugWaitTicks > 0) {
                        yield this._debugRunWaitTick("[Dir] wait tick cancelled 1");
                    }
                    if (this._cancelled) {
                        return false;
                    }
                }
                dirElem.contents = dirContents;
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
     * This method tries to find a ".assetchef file inside the directory, and calls deserialize on it."
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
                this._content = new DirElem();
                return;
            }
            if (!this.deserialize(prevDirSerialized)) {
                logger.logWarn("[Dir] Error deserializing '%s', deleting since it's probably corrupted.", serializationFilePath);
                yield fs.remove(serializationFilePath);
                this._content = new DirElem();
                return;
            }
            return;
        });
    }
    /**
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
     * @returns {Array} list of paths in directory
     * @throws {VError} if you try to use this without having a successful build/deserialize first
     */
    getPathList() {
        if (this._content == null) {
            throw new verror_1.VError("Tried to get path list without properly building first.");
        }
        const list = [];
        const directoriesToProcess = [this._content];
        while (directoriesToProcess.length > 0) {
            const dirElem = directoriesToProcess.pop();
            for (const [path, elem] of dirElem.contents) {
                list.push(path);
                if (elem instanceof DirElem) {
                    directoriesToProcess.push(elem);
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
        const topLevel = {};
        const directoriesToProcess = [this._content];
        const directoriesToProcessObj = [topLevel];
        while (directoriesToProcess.length > 0) {
            const dirElem = directoriesToProcess.pop();
            const dirElemObj = directoriesToProcessObj.pop();
            for (const [path, elem] of dirElem.contents) {
                if (elem instanceof DirElem) {
                    const serializedObj = {};
                    dirElemObj[path] = serializedObj;
                    directoriesToProcess.push(elem);
                    directoriesToProcessObj.push(serializedObj);
                }
                else {
                    dirElemObj[path] = elem.statHash;
                }
            }
        }
        const obj = {
            content: topLevel,
            version: SERIALIZATION_VERSION,
        };
        return JSON.stringify(obj);
    }
    /**
     * @param {string} jsonString the same string outputted by serialize()
     * @returns {boolean} if succesful or not.
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
        const topLevel = new DirElem();
        const serializedDirsToProcess = [obj.content];
        const dirElemsToProcess = [topLevel];
        while (serializedDirsToProcess.length > 0) {
            const serializedDirContent = serializedDirsToProcess.pop();
            const dirElemObj = dirElemsToProcess.pop();
            const contentOfDirElem = new Map();
            for (const path of Object.keys(serializedDirContent)) {
                const elem = serializedDirContent[path];
                if (typeof elem !== "string") {
                    const newDirElem = new DirElem();
                    contentOfDirElem.set(path, newDirElem);
                    serializedDirsToProcess.push(elem);
                    dirElemsToProcess.push(newDirElem);
                }
                else {
                    contentOfDirElem.set(path, new FileElem(elem));
                }
            }
            dirElemObj.contents = contentOfDirElem;
        }
        this._content = topLevel;
        return true;
    }
    /**
     * This method will compare the current Dir against another one.
     * The output is a list of DirChangeEvent that represents the differences.
     * @param {Dir} olderDir the Dir to be compared.
     * @throws {VError} if this or the other dir wasn't properly initialized.
     * @returns {array} A list of DirChangeEvent
     */
    compare(olderDir) {
        if (this._content == null || olderDir == null || olderDir._content == null) {
            throw new verror_1.VError("To compare, both Dirs have to have been properly built with build or deserialize.");
        }
        const diffList = [];
        const dirPairsToProcess = [[this._content, olderDir._content]];
        // additions and changes
        for (const pair of dirPairsToProcess) {
            const currentDirElem = pair[0];
            const olderDirElem = pair[1];
            for (const [path, currentElem] of currentDirElem.contents) {
                const isADir = currentElem instanceof DirElem;
                const olderElem = olderDirElem.contents.get(path);
                if (olderElem != null) {
                    const wasADir = olderElem instanceof DirElem;
                    // already existed
                    if (isADir) {
                        if (!wasADir) {
                            diffList.push(new dirchangeevent_1.DirChangeEvent(dirchangeevent_1.DirEventType.Unlink, path));
                            diffList.push(new dirchangeevent_1.DirChangeEvent(dirchangeevent_1.DirEventType.AddDir, path));
                        }
                        else {
                            dirPairsToProcess.push([currentElem, olderElem]);
                        }
                    }
                    else {
                        if (wasADir) {
                            diffList.push(new dirchangeevent_1.DirChangeEvent(dirchangeevent_1.DirEventType.UnlinkDir, path));
                            diffList.push(new dirchangeevent_1.DirChangeEvent(dirchangeevent_1.DirEventType.Add, path));
                        }
                        else if (currentElem.statHash !== olderElem.statHash) {
                            diffList.push(new dirchangeevent_1.DirChangeEvent(dirchangeevent_1.DirEventType.Change, path));
                        }
                    }
                }
                else {
                    // new path
                    if (isADir) {
                        diffList.push(new dirchangeevent_1.DirChangeEvent(dirchangeevent_1.DirEventType.AddDir, path));
                    }
                    else {
                        diffList.push(new dirchangeevent_1.DirChangeEvent(dirchangeevent_1.DirEventType.Add, path));
                    }
                }
            }
            // removals
            for (const [path, olderElem] of olderDirElem.contents) {
                if (!currentDirElem.contents.has(path)) {
                    if (olderElem instanceof DirElem) {
                        diffList.push(new dirchangeevent_1.DirChangeEvent(dirchangeevent_1.DirEventType.UnlinkDir, path));
                    }
                    else {
                        diffList.push(new dirchangeevent_1.DirChangeEvent(dirchangeevent_1.DirEventType.Unlink, path));
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
};
//# sourceMappingURL=dir.js.map