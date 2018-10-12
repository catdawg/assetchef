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
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fse = __importStar(require("fs-extra"));
const pathutils = __importStar(require("path"));
const verror_1 = __importDefault(require("verror"));
exports.ASSETCHEF_FOLDER_NAME = ".assetchef";
exports.ASSETCHEF_FOLDER_VERSION_FILE = "version";
exports.ASSETCHEF_FOLDER_VERSION = "1";
var CheckWorkingFolderResultType;
(function (CheckWorkingFolderResultType) {
    CheckWorkingFolderResultType[CheckWorkingFolderResultType["Failure"] = 0] = "Failure";
    CheckWorkingFolderResultType[CheckWorkingFolderResultType["NotFound"] = 1] = "NotFound";
    CheckWorkingFolderResultType[CheckWorkingFolderResultType["OutOfDate"] = 2] = "OutOfDate";
    CheckWorkingFolderResultType[CheckWorkingFolderResultType["Success"] = 3] = "Success";
})(CheckWorkingFolderResultType = exports.CheckWorkingFolderResultType || (exports.CheckWorkingFolderResultType = {}));
/**
 * Checks the integrity of the working folder. Throws if parameters are null.
 * Besides that, it should never throw, and the result should inform what to do next.
 * E.g. OutOfDate should call removeWorkingFolder next, Failure should inform the user that
 * something weird is going on. Relevant info will be logged in the logger parameter.
 * @param logger the logger
 * @param workingFolder the working folder
 * @returns the result of the check.
 */
function checkWorkingFolder(logger, workingFolder) {
    return __awaiter(this, void 0, void 0, function* () {
        if (logger == null) {
            throw new verror_1.default("logger can't be null");
        }
        if (workingFolder == null) {
            throw new verror_1.default("working folder path can't be null");
        }
        const workingFolderVersionFile = pathutils.join(workingFolder, exports.ASSETCHEF_FOLDER_VERSION_FILE);
        let assetchefFolderStat;
        try {
            assetchefFolderStat = yield fse.stat(workingFolder);
        }
        catch (e) {
            logger.logInfo("path '%s' not found.", workingFolder);
            return CheckWorkingFolderResultType.NotFound;
        }
        if (!assetchefFolderStat.isDirectory()) {
            logger.logError("'%s' is a file, it should be a directory. Something weird is happening...", workingFolder);
            return CheckWorkingFolderResultType.Failure;
        }
        let existingVersion = null;
        try {
            existingVersion = yield fse.readFile(workingFolderVersionFile);
        }
        catch (e) {
            logger.logInfo("error reading '%s' or file not found.", workingFolderVersionFile);
            return CheckWorkingFolderResultType.OutOfDate;
        }
        if (existingVersion.toString("utf8") !== exports.ASSETCHEF_FOLDER_VERSION) {
            logger.logInfo(".assetchef folder is older '%s' than current version '%s'.", existingVersion, exports.ASSETCHEF_FOLDER_VERSION);
            return CheckWorkingFolderResultType.OutOfDate;
        }
        return CheckWorkingFolderResultType.Success;
    });
}
exports.checkWorkingFolder = checkWorkingFolder;
/**
 * Safely removes the working folder. If the folder doesn't exists it will return false and log an error.
 * It will throw if the parameters are null.
 * @param logger the logger
 * @param workingFolder the working folder to remove
 * @returns true if successful
 */
function deleteWorkingFolder(logger, workingFolder) {
    return __awaiter(this, void 0, void 0, function* () {
        if (logger == null) {
            throw new verror_1.default("logger can't be null");
        }
        if (workingFolder == null) {
            throw new verror_1.default("working folder path can't be null");
        }
        try {
            yield fse.access(workingFolder);
        }
        catch (e) {
            logger.logError("failed to remove '%s' folder, are you sure the path is writeable?", workingFolder);
            return false;
        }
        yield fse.remove(workingFolder);
        return true;
    });
}
exports.deleteWorkingFolder = deleteWorkingFolder;
let _interrupt = null;
/**
 * Prepares the working folder from scratch. It will throw if the parameters are null.
 * Otherwise it will return false if any error occurs, and the relevant info will be sent to the logger.
 * @param logger the logger instance
 * @param workingFolder the folder
 * @returns true if successful
 */
function setupWorkingFolder(logger, workingFolder) {
    return __awaiter(this, void 0, void 0, function* () {
        if (logger == null) {
            throw new verror_1.default("logger can't be null");
        }
        if (workingFolder == null) {
            throw new verror_1.default("working folder path can't be null");
        }
        try {
            yield fse.access(workingFolder);
            throw new verror_1.default("folder already exists");
        }
        catch (e) {
            // doesn't exist is good.
        }
        try {
            yield fse.mkdir(workingFolder);
        }
        catch (e) {
            logger.logError("failed to create '%s' folder, are you sure the path is writeable?", workingFolder);
            return false;
        }
        if (_interrupt != null) {
            const inter = _interrupt;
            _interrupt = null;
            yield inter();
        }
        const versionFile = pathutils.join(workingFolder, exports.ASSETCHEF_FOLDER_VERSION_FILE);
        try {
            yield fse.writeFile(versionFile, Buffer.from(exports.ASSETCHEF_FOLDER_VERSION));
        }
        catch (e) {
            logger.logError("failed to write version file '%s', are you sure the path is writeable?", versionFile);
            return false;
        }
        return true;
    });
}
exports.setupWorkingFolder = setupWorkingFolder;
function _setTestInterrupt(f) {
    _interrupt = f;
}
exports._setTestInterrupt = _setTestInterrupt;
//# sourceMappingURL=workingfolder.js.map