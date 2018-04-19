"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const VError = require("verror").VError;
const fs = require("fs-extra");
const pathutils = require("path");
const EventEmitter = require("events");
const logger = require("utils/logger");
const DirWatcher = require("utils/dirwatcher");
const DirChangeQueue = require("utils/dirchangequeue");
const Dir = require("utils/dir");
const timeout = require("utils/timeout");
module.exports = class Conveyor extends EventEmitter {
    /**
     *
     * @param {string} sourceFolder the source folder
     * @param {string} targetFolder the target folder
     */
    constructor(sourceFolder, targetFolder) {
        super();
        if (sourceFolder == null) {
            throw new VError("sourceFolder is null");
        }
        if (targetFolder == null) {
            throw new VError("targetFolder is null");
        }
        this.sourceFolder = sourceFolder;
        this.targetFolder = targetFolder;
    }
    /**
     *
    */
    setup() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield fs.exists(this.sourceFolder))) {
                throw new VError("sourceFolder does not exist");
            }
            if (!(yield fs.exists(this.targetFolder))) {
                yield fs.mkdir(this.targetFolder);
            }
            /**
             * This method attempts to make initial setup, if something changes while the initial setup is being attempted
             *
             * @returns {bool} true if the setup succeeded, false if not.
             */
            function initialSetup() {
                return __awaiter(this, void 0, void 0, function* () {
                    logger.logInfo("[Conveyor] Running initial setup...");
                    this.dirWatcher = new DirWatcher(this.sourceFolder);
                    this.dirChangeQueue = new DirChangeQueue(this.dirWatcher);
                    const sourceDir = new Dir(this.sourceFolder);
                    const sourceDirPrevious = new Dir(this.sourceFolder);
                    let failure = false;
                    function dirChangedWhileSettingUpCallback() {
                        failure = true;
                        sourceDir.cancelBuild();
                        sourceDirPrevious.cancelBuild();
                    }
                    this.dirWatcher.once("dirchanged", dirChangedWhileSettingUpCallback);
                    if (failure)
                        return false;
                    logger.logInfo("[Conveyor] Reading source directory...");
                    const buildSuccess = yield sourceDir.build();
                    if (!buildSuccess || failure)
                        return false;
                    logger.logInfo("[Conveyor] Reading previous state of source directory...");
                    yield sourceDirPrevious.buildFromPrevImage();
                    if (failure)
                        return false;
                    this.dirWatcher.removeListener(dirChangedWhileSettingUpCallback);
                    const diff = sourceDir.compare(sourceDirPrevious);
                    if (diff.length > 0) {
                        logger.logInfo("[Conveyor] Found the following changes:");
                        for (const ev of diff) {
                            logger.logInfo("[Conveyor] %s %s", ev.eventType, ev.path);
                            this.dirChangeQueue.push(ev);
                        }
                    }
                    else {
                        logger.logInfo("[Conveyor] Found no changes...");
                    }
                    this.dirWatcher.on("dirchanged", function (ev) {
                        this.dirChangeQueue.push(ev);
                    });
                    return true;
                });
            }
            while (!(yield initialSetup())) {
                logger.logInfo("[Conveyor] Initial setup failed, retrying in 5 seconds ...");
                yield timeout(5);
                logger.logInfo("[Conveyor] ... retrying");
            }
            logger.logInfo("[Conveyor] Starting sync process ...");
            while (true) {
                if (this.dirChangeQueue.isEmpty()) {
                    yield timeout(5);
                    continue;
                }
                let failure = false;
                function domainChangedWhileSyncing() {
                    failure = true;
                }
                const ev = this.dirChangeQueue.peek(domainChangedWhileSyncing);
                if (failure)
                    continue;
            }
        });
    }
};
//# sourceMappingURL=conveyor.js.map