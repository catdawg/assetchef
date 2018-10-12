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
Object.defineProperty(exports, "__esModule", { value: true });
const fse = __importStar(require("fs-extra"));
const pathutils = __importStar(require("path"));
const recipeconfig_1 = require("./recipeconfig");
const workingfolder_1 = require("./workingfolder");
const ASSETCHEF_CONFIG_FILE = "assetchef.json";
var SetupErrorKind;
(function (SetupErrorKind) {
    SetupErrorKind["PathInvalid"] = "PathInvalid";
    SetupErrorKind["FailedToSetupWorkingFolder"] = "FailedToSetupWorkingFolder";
    SetupErrorKind["FailedToReadConfig"] = "FailedToReadConfig";
    SetupErrorKind["ConfigNotFound"] = "ConfigNotFound";
    SetupErrorKind["ConfigNotJson"] = "ConfigNotJson";
    SetupErrorKind["BaseStructureInvalid"] = "BaseStructureInvalid";
    SetupErrorKind["MissingPlugins"] = "MissingPlugins";
    SetupErrorKind["FullStructureInvalid"] = "FullStructureInvalid";
})(SetupErrorKind = exports.SetupErrorKind || (exports.SetupErrorKind = {}));
function setup(logger, path) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(yield checkPath(logger, path))) {
            return { error: SetupErrorKind.PathInvalid };
        }
        const configPath = pathutils.join(path, ASSETCHEF_CONFIG_FILE);
        const checkConfigRes = yield recipeconfig_1.checkBaseRecipeConfigStructure(logger, configPath);
        switch (checkConfigRes.result) {
            case (recipeconfig_1.CheckRecipeConfigResult.Failure):
                return { error: SetupErrorKind.FailedToReadConfig };
            case (recipeconfig_1.CheckRecipeConfigResult.NotFound):
                return { error: SetupErrorKind.ConfigNotFound };
            case (recipeconfig_1.CheckRecipeConfigResult.NotAJson):
                return { error: SetupErrorKind.ConfigNotJson };
            case (recipeconfig_1.CheckRecipeConfigResult.BaseStructureInvalid):
                return { error: SetupErrorKind.BaseStructureInvalid };
            case recipeconfig_1.CheckRecipeConfigResult.Success:
                break;
        }
        const workingFolderPath = pathutils.join(path, workingfolder_1.ASSETCHEF_FOLDER_NAME);
        const checkWorkingFolderRes = yield workingfolder_1.checkWorkingFolder(logger, path);
        switch (checkWorkingFolderRes) {
            case workingfolder_1.CheckWorkingFolderResultType.Failure:
                return { error: SetupErrorKind.FailedToSetupWorkingFolder };
            case workingfolder_1.CheckWorkingFolderResultType.OutOfDate:
                if (!(yield workingfolder_1.deleteWorkingFolder(logger, workingFolderPath))) {
                    return { error: SetupErrorKind.FailedToSetupWorkingFolder };
                }
            case workingfolder_1.CheckWorkingFolderResultType.NotFound:
                if (!(yield workingfolder_1.setupWorkingFolder(logger, workingFolderPath))) {
                    return { error: SetupErrorKind.FailedToSetupWorkingFolder };
                }
                break;
            case workingfolder_1.CheckWorkingFolderResultType.Success:
                break;
        }
    });
}
exports.setup = setup;
function checkPath(logger, targetFolder) {
    return __awaiter(this, void 0, void 0, function* () {
        let pathStat;
        try {
            pathStat = yield fse.stat(targetFolder);
        }
        catch (e) {
            logger.logError("'%s' not found.", targetFolder);
            return false;
        }
        if (!pathStat.isDirectory) {
            logger.logError("'%s' is a file, it should be a directory containing the assetchef.json file.", targetFolder);
            return false;
        }
        return true;
    });
}
//# sourceMappingURL=setup.js.map