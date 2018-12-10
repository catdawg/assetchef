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
const jsonvalidation_1 = require("../utils/jsonvalidation");
const pluginmanager_1 = require("../utils/pluginmanager");
const defines_1 = require("./defines");
const plugincheck_1 = require("./plugincheck");
const recipeconfigutils_1 = require("./recipeconfigutils");
const recipecooker_1 = require("./recipecooker");
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
    SetupErrorKind["PluginsFailedToInstall"] = "PluginsFailedToInstall";
    SetupErrorKind["MissingPlugins"] = "MissingPlugins";
    SetupErrorKind["PluginIncompatible"] = "PluginIncompatible";
    SetupErrorKind["FullStructureInvalid"] = "FullStructureInvalid";
    SetupErrorKind["None"] = "None";
})(SetupErrorKind = exports.SetupErrorKind || (exports.SetupErrorKind = {}));
let _interrupt = null;
function setup(logger, path) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(yield checkPath(logger, path))) {
            return { error: SetupErrorKind.PathInvalid };
        }
        const configPath = pathutils.join(path, ASSETCHEF_CONFIG_FILE);
        let configObject = null;
        {
            let configStat;
            try {
                configStat = yield fse.stat(configPath);
            }
            catch (e) {
                logger.logInfo("path '%s' not found.", configPath);
                return { error: SetupErrorKind.ConfigNotFound };
            }
            if (configStat.isDirectory()) {
                logger.logError("'%s' is a directory, it should be a file. Something weird is happening...", configPath);
                return { error: SetupErrorKind.FailedToReadConfig };
            }
            if (_interrupt != null) {
                const inter = _interrupt;
                _interrupt = null;
                yield inter();
            }
            let configData = null;
            try {
                configData = yield fse.readFile(configPath);
            }
            catch (e) {
                logger.logError("error reading '%s' with error '%s'", configPath, e);
                return { error: SetupErrorKind.FailedToReadConfig };
            }
            try {
                configObject = JSON.parse(configData.toString("utf8"));
            }
            catch (e) {
                logger.logInfo("error parsing '%s' with error '%s'", configPath, e);
                return { error: SetupErrorKind.ConfigNotJson };
            }
            const baseConfigCheckResult = jsonvalidation_1.validateJSON(configObject, recipeconfigutils_1.RecipeConfigUtils.getBaseConfigSchema());
            if (!baseConfigCheckResult.valid) {
                logger.logError("config json '%s' not valid because: %s.", configPath, baseConfigCheckResult.errors.map((e) => e.message).join(", "));
                return { error: SetupErrorKind.BaseStructureInvalid };
            }
        }
        const recipeConfig = configObject;
        const workingFolderPath = pathutils.join(path, defines_1.ASSETCHEF_FOLDER_NAME);
        const checkWorkingFolderRes = yield workingfolder_1.WorkingFolderUtils.check(logger, path);
        switch (checkWorkingFolderRes) {
            case workingfolder_1.CheckWorkingFolderResultType.Failure:
                return { error: SetupErrorKind.FailedToSetupWorkingFolder };
            case workingfolder_1.CheckWorkingFolderResultType.OutOfDate:
                if (!(yield workingfolder_1.WorkingFolderUtils.delete(logger, workingFolderPath))) {
                    return { error: SetupErrorKind.FailedToSetupWorkingFolder };
                }
            case workingfolder_1.CheckWorkingFolderResultType.NotFound:
                if (!(yield workingfolder_1.WorkingFolderUtils.setup(logger, workingFolderPath))) {
                    return { error: SetupErrorKind.FailedToSetupWorkingFolder };
                }
                break;
            case workingfolder_1.CheckWorkingFolderResultType.Success:
                break;
        }
        const pluginManager = yield pluginmanager_1.PluginManager.setup(logger, workingFolderPath);
        if (!(yield pluginManager.install(recipeConfig.plugins))) {
            return { error: SetupErrorKind.PluginsFailedToInstall };
        }
        const plugins = {};
        const pluginSchemas = {};
        for (const key in recipeConfig.plugins) {
            if (!recipeConfig.hasOwnProperty(key)) {
                continue;
            }
            const pluginObj = pluginManager.require(key);
            if (pluginObj == null) {
                return { error: SetupErrorKind.MissingPlugins };
            }
            if (plugincheck_1.PluginCheck.isPluginValid(logger, pluginObj)) {
                return { error: SetupErrorKind.PluginIncompatible };
            }
            plugins[key] = pluginObj;
            pluginSchemas[key] = pluginObj.configSchema;
        }
        const fullSchema = recipeconfigutils_1.RecipeConfigUtils.getFullSchema(pluginSchemas);
        const fullSchemaCheckResult = jsonvalidation_1.validateJSON(recipeConfig, fullSchema);
        if (!fullSchemaCheckResult.valid) {
            logger.logError("config json '%s' not valid because: %s.", configPath, fullSchemaCheckResult.errors.map((e) => e.message).join(", "));
            return { error: SetupErrorKind.FullStructureInvalid };
        }
        const recipe = new recipecooker_1.RecipeCooker();
        //await recipe.setup(logger, recipeConfig, plugins);
        return { error: SetupErrorKind.None, recipe };
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
function _setTestInterrupt(f) {
    _interrupt = f;
}
exports._setTestInterrupt = _setTestInterrupt;
//# sourceMappingURL=setup.js.map