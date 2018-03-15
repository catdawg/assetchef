import * as fs from "fs-extra";
import * as pathutils from "path";
import { VError } from "verror";

import {DirChangeEvent, DirEventType} from "./dirchangeevent";
import { hashFSStat } from "./hash";
import { validateJSON } from "./jsonvalidation";
import * as logger from "./logger";

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

    public statHash: string;
    /**
     * @param {string} statHash - the current hash from fs.stat from the file
     */
    constructor(statHash: string) {
        this.statHash = statHash;
    }
}

/**
 * Holder object for a directory and it's contents, which is a map of FileElem and DirElem.
 * Initially it has no content, it is meant to be filled later.
 */
class DirElem {
    public contents: Map<string, FileElem | DirElem>;
}

/**
 * This class builds a representation of the directory, which can later be compared to look for changes.
 * @property {function()} _debugWaitPromise
 */
export = class Dir {

    public _debugWaitPromise: () => Promise<void>;
    public _debugWaitTicks: number;

    private _content: DirElem;
    private _cancelled: boolean;
    private _path: string;
    /**
     * @param {string} path - the full path to the directory
     * @throws {VError} if the path is null
     */
    constructor(path: string) {

        if (path == null) {
            throw new VError("path is null");
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
    public async build() {
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
                    await this._debugRunWaitTick("[Dir] wait tick before readdir %s", fullPathDirElem);
                }
                dirList = await fs.readdir(fullPathDirElem);
            } catch (err) {
                logger.logWarn("[Dir] Failed to readdir %s", fullPathDirElem);
                return false;
            }

            for (const elem of dirList) {
                const fullElemPath = pathutils.join(fullPathDirElem, elem);
                const elemPath = pathutils.join(dirElemPath, elem);

                let stat = null;
                try {
                    if (this._debugWaitTicks > 0) {
                        await this._debugRunWaitTick("[Dir] Wait tick stat %s", fullElemPath);
                    }
                    stat = await fs.stat(fullElemPath);
                } catch (err) {
                    logger.logWarn("[Dir] Failed to stat %s", fullElemPath);
                    return false;
                }

                if (stat.isDirectory()) {
                    const newDirElem = new DirElem();
                    dirContents.set(elemPath, newDirElem);
                    directoriesToProcess.push(newDirElem);
                    pathsToProcess.push(elemPath);
                } else {
                    dirContents.set(elemPath, new FileElem(hashFSStat(stat)));
                }

                if (this._debugWaitTicks > 0) {
                    await this._debugRunWaitTick("[Dir] wait tick cancelled 1");
                }

                if (this._cancelled) {
                    return false;
                }
            }

            dirElem.contents = dirContents;

            if (this._debugWaitTicks > 0) {
                await this._debugRunWaitTick("[Dir] wait tick cancelled 2");
            }

            if (this._cancelled) {
                return false;
            }
        }

        this._content = content;

        return true;
    }

    /**
     * This method tries to find a ".assetchef file inside the directory, and calls deserialize on it."
     * If anything strange happens, this will return false, and it should be executed again.
     * If an expected error happens like file isn't there or file is corrupted, then this will return true.
     * @returns {Promise<void>} the async method return
     */
    public async buildFromPrevImage() {

        const serializationFilePath = pathutils.join(this._path, SERIALIZATION_FILENAME);

        let prevDirSerialized = null;

        try {
            prevDirSerialized = await fs.readFile(serializationFilePath, "utf8");
        } catch (err) {
            logger.logInfo("[Dir] Error '%s' reading '%s'", err, serializationFilePath);
            this._content = new DirElem();
            return;
        }

        if (!this.deserialize(prevDirSerialized)) {
            logger.logWarn(
                "[Dir] Error deserializing '%s', deleting since it's probably corrupted.", serializationFilePath);
            await fs.remove(serializationFilePath);
            this._content = new DirElem();
            return;
        }

        return;
    }

    /**
     * @returns {Promise<boolean>} true if successful save
     */
    public async saveToImage() {
        const serializationFilePath = pathutils.join(this._path, SERIALIZATION_FILENAME);

        const serializedString = this.serialize();

        try {
            await fs.writeFile(serializationFilePath, serializedString);
        } catch (err) {
            logger.logWarn("[Dir] Error %s writing %s", err, serializationFilePath);
            return false;
        }

        return true;
    }

    /**
     * Makes the build exit gracefully in case it was running, this should be called if something
     * changes inside the directory being built, or if we need to exit for some reason
     * @returns {void}
     */
    public cancelBuild() {
        this._cancelled = true;
    }

    /**
     * @returns {Array} list of paths in directory
     * @throws {VError} if you try to use this without having a successful build/deserialize first
     */
    public getPathList() {

        if (this._content == null) {
            throw new VError("Tried to get path list without properly building first.");
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
    public serialize() {
        if (this._content == null) {
            throw new VError("Tried to serialize without properly building first.");
        }

        interface ISerializedObj {
            [propName: string]: string | ISerializedObj;
        }

        const topLevel: ISerializedObj = {};
        const directoriesToProcess = [this._content];
        const directoriesToProcessObj: ISerializedObj[] = [topLevel];

        while (directoriesToProcess.length > 0) {
            const dirElem = directoriesToProcess.pop();
            const dirElemObj = directoriesToProcessObj.pop();

            for (const [path, elem] of dirElem.contents) {
                if (elem instanceof DirElem) {
                    const serializedObj: ISerializedObj = {};
                    dirElemObj[path] = serializedObj;
                    directoriesToProcess.push(elem);
                    directoriesToProcessObj.push(serializedObj);
                } else {
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
    public deserialize(jsonString: string) {
        if (jsonString == null || jsonString === "") {
            logger.logWarn("[Dir] json used to deserialize was null or empty.");
            return false;
        }
        let obj = null;
        try {
            obj = JSON.parse(jsonString);
        } catch (e) {
            logger.logWarn("[Dir] malformed json '%s' used to deserialize.", jsonString);
            return false;
        }

        const result = validateJSON(obj, serializationSchema);
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
                } else {
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
    public compare(olderDir: Dir) {
        if (this._content == null || olderDir == null || olderDir._content == null) {
            throw new VError("To compare, both Dirs have to have been properly built with build or deserialize.");
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
                            diffList.push(new DirChangeEvent(DirEventType.Unlink, path));
                            diffList.push(new DirChangeEvent(DirEventType.AddDir, path));
                        } else {
                            dirPairsToProcess.push([currentElem as DirElem, olderElem as DirElem]);
                        }

                    } else {

                        if (wasADir) {
                            diffList.push(new DirChangeEvent(DirEventType.UnlinkDir, path));
                            diffList.push(new DirChangeEvent(DirEventType.Add, path));
                        } else if ((currentElem as FileElem).statHash !== (olderElem as FileElem).statHash) {
                            diffList.push(new DirChangeEvent(DirEventType.Change, path));
                        }
                    }
                } else {
                    // new path
                    if (isADir) {
                        diffList.push(new DirChangeEvent(DirEventType.AddDir, path));
                    } else {
                        diffList.push(new DirChangeEvent(DirEventType.Add, path));
                    }
                }
            }
            // removals
            for (const [path, olderElem] of olderDirElem.contents) {

                if (!currentDirElem.contents.has(path)) {
                    if (olderElem instanceof DirElem) {
                        diffList.push(new DirChangeEvent(DirEventType.UnlinkDir, path));
                    } else {
                        diffList.push(new DirChangeEvent(DirEventType.Unlink, path));
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
    public _debugWaitForTicks(count: number, promiseToWaitForAfterTicksFinish: () => Promise<void>) {

        this._debugWaitPromise = promiseToWaitForAfterTicksFinish;
        this._debugWaitTicks = count;
    }

    /**
     * Test method to stop the app in specific places.
     * @returns {Promise<void>} the wait promise
     */
    private async _debugRunWaitTick(...loggingArgs: string[]) {

        --this._debugWaitTicks;
        logger.logDebug.apply(this, loggingArgs);

        if (this._debugWaitTicks === 0) {
            logger.logDebug("[Dir] running tick promise");
            await this._debugWaitPromise();
            this._debugWaitPromise = null;
        }
    }
};
