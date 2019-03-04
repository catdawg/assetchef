
import * as fse from "fs-extra";
import * as pathutils from "path";
import { VError } from "verror";

import { ILogger } from "../comm/ilogger";
import { IRecipePlugin } from "../irecipeplugin";
import { ISchemaDefinition } from "../ischemadefinition";
import { validateJSON, ValidateJsonResultType } from "../jsonvalidation";
import { NodePackageHelper } from "../nodepackagehelper";
import { PathTree } from "../path/pathtree";
import { WatchmanFSWatch } from "../watch/fswatch_watchman";
import { ASSETCHEF_FOLDER_NAME } from "./defines";
import { IRecipeConfig } from "./irecipeconfig";
import { PluginCheck } from "./plugincheck";
import { RecipeConfigUtils } from "./recipeconfigutils";
import { RecipeCooker } from "./recipecooker";
import {
    CheckWorkingFolderResultType,
    WorkingFolderUtils} from "./workingfolder";

export enum SetupErrorKind {
    FailedToSetupWorkingFolder = "FailedToSetupWorkingFolder",
    FailedToReadConfig = "FailedToReadConfig",
    ConfigNotFound = "ConfigNotFound",
    ConfigNotJson = "ConfigNotJson",
    BaseStructureInvalid = "BaseStructureInvalid",
    PluginsFailedToInstall = "PluginsFailedToInstall",
    MissingPlugins = "MissingPlugins",
    PluginIncompatible = "PluginIncompatible",
    FullStructureInvalid = "FullStructureInvalid",
    None = "None",
}

export class Kitchen {
    /**
     * Sets up the recipe cooker.
     * @param logger the logger to use for cooking the recipe
     * @param configPath the path of the config file.
     * @returns the cooker or the error in case it fails
     */
    public static async setup(
        logger: ILogger,
        configPath: string):
        Promise<{recipe?: RecipeCooker, error: SetupErrorKind}> {

        configPath = pathutils.resolve(process.cwd(), configPath);
        const projectFolder = pathutils.dirname(configPath);
        const workingFolderPath = pathutils.join(projectFolder, ASSETCHEF_FOLDER_NAME);

        let configObject = null;
        // Check the base config
        {
            let configStat;
            try {
                configStat = await fse.stat(configPath);
            } catch (e) {
                logger.logInfo(
                    "path '%s' not found.",
                    configPath);
                return {error: SetupErrorKind.ConfigNotFound};
            }

            if (configStat.isDirectory()) {
                logger.logError("'%s' is a directory, it should be a file.", configPath);
                return {error: SetupErrorKind.FailedToReadConfig};
            }

            let configData = null;
            try {
                configData = await fse.readFile(configPath);
            } catch (e) /* istanbul ignore next */ {
                logger.logError(
                    "error reading '%s' with error '%s'",
                    configPath, e);
                return {error: SetupErrorKind.FailedToReadConfig};
            }

            try {
                configObject = JSON.parse(configData.toString("utf8"));
            } catch (e) {
                logger.logInfo(
                    "error parsing '%s' with error '%s'",
                    configPath, e);
                return {error: SetupErrorKind.ConfigNotJson};
            }

            const baseConfigCheckResult = validateJSON(configObject, RecipeConfigUtils.getBaseConfigSchema());

            switch (baseConfigCheckResult.res) {
                case ValidateJsonResultType.Valid:
                    break;
                /* istanbul ignore next */
                case ValidateJsonResultType.SchemaIsInvalid:
                    throw new VError("base schema can't be invalid");
                case ValidateJsonResultType.JsonIsInvalid:
                    logger.logError("config json '%s' not valid because: %s.",
                        configPath, baseConfigCheckResult.errors);
                    return {error: SetupErrorKind.BaseStructureInvalid};
            }
        }

        const recipeConfig = configObject as IRecipeConfig;

        // check working folder
        {
            const checkWorkingFolderRes = await WorkingFolderUtils.check(logger, workingFolderPath);
            switch (checkWorkingFolderRes) {
                case CheckWorkingFolderResultType.Failure:
                    return {error: SetupErrorKind.FailedToSetupWorkingFolder};
                case CheckWorkingFolderResultType.OutOfDate:
                    /* istanbul ignore next */
                    if (!await WorkingFolderUtils.delete(logger, workingFolderPath))  {
                        return {error: SetupErrorKind.FailedToSetupWorkingFolder};
                    }
                case CheckWorkingFolderResultType.NotFound:
                    /* istanbul ignore next */
                    if (!await WorkingFolderUtils.setup(logger, workingFolderPath))  {
                        return {error: SetupErrorKind.FailedToSetupWorkingFolder};
                    }
                    break;
                case CheckWorkingFolderResultType.Success:
                    break;
            }
        }

        // install dependencies in working folder
        if (!await NodePackageHelper.install(logger, workingFolderPath, recipeConfig.dependencies)) {
            return {error: SetupErrorKind.PluginsFailedToInstall};
        }

        const plugins: {[index: string]: IRecipePlugin} = {};
        const pluginSchemas: {[index: string]: ISchemaDefinition} = {};

        // check dependencies
        {
            const allDependencies = {...recipeConfig.dependencies, ...recipeConfig.peerDependencies};

            for (const key in allDependencies) {
                /* istanbul ignore next */
                if (!allDependencies.hasOwnProperty(key)) {
                    continue;
                }

                let pluginObj: IRecipePlugin = null;
                try {
                    pluginObj = NodePackageHelper.requireFromPath<IRecipePlugin>(workingFolderPath, key);
                } catch (e) {
                    logger.logError("dependency '%s' failed to be required. With error: %s", key, e.message);
                    return {error: SetupErrorKind.MissingPlugins};
                }

                if (pluginObj == null) {
                    logger.logError("dependency '%s' not found.", key);
                    return {error: SetupErrorKind.MissingPlugins};
                }

                if (!PluginCheck.isPluginValid(logger, pluginObj)) {
                    logger.logError("dependency '%s' incompatible.", key);
                    return {error: SetupErrorKind.PluginIncompatible};
                }

                plugins[key] = pluginObj;
                pluginSchemas[key] = pluginObj.configSchema;
            }
        }

        // validate full schema
        {
            const fullSchema = RecipeConfigUtils.getFullSchema(pluginSchemas);

            const fullSchemaCheckResult = validateJSON(recipeConfig, fullSchema);

            switch (fullSchemaCheckResult.res) {
                case ValidateJsonResultType.Valid:
                    break;
                case ValidateJsonResultType.SchemaIsInvalid:
                    logger.logError("one or more plugins required in '%s' does not have a valid schema. error: %s.",
                        configPath, fullSchemaCheckResult.errors);
                    return {error: SetupErrorKind.FullStructureInvalid};
                case ValidateJsonResultType.JsonIsInvalid:
                    logger.logError("config '%s' not valid because: %s.",
                        configPath, fullSchemaCheckResult.errors);
                    return {error: SetupErrorKind.FullStructureInvalid};
            }

        }

        // create the cooker
        const watch = await WatchmanFSWatch.watchPath(logger, projectFolder);

        const recipe = new RecipeCooker();
        await recipe.setup(logger, projectFolder, watch, recipeConfig.roots, new PathTree<Buffer>(), plugins);

        return {error: SetupErrorKind.None, recipe};
    }

}
