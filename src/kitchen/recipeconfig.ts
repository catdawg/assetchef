import * as fse from "fs-extra";
import VError from "verror";

import { ILogger } from "../plugin/ilogger";
import { ISchemaDefinition } from "../plugin/ischemadefinition";
import { validateJSON } from "../utils/jsonvalidation";

export const ASSETCHEF_CONFIG_FILE = "assetchefRecipe.json";

/**
 * Structure of each step in the config. The config object will be later "typed",
 * depending on whatever the plugin specifies as it's config schema.
 */
export interface IRecipeStepConfig {
    [propName: string]: {
        config: object;
        next: IRecipeStepConfig[];
    };
}

/**
 * The list of plugins
 */
export interface IRecipePlugins {
    [propName: string]: string;
}

/**
 * Base structure of a recipe config.
 */
export interface IRecipeConfig {
    plugins: IRecipePlugins;
    roots: IRecipeStepConfig[];
}

/**
 * The schema for validating the top level structure of the config
 */
export function getBaseConfigSchema(): ISchemaDefinition {
    return {
        additionalProperties: false,
        definitions: {
            step: {
                additionalProperties:  {
                    properties: {
                        config: {
                            type: "object",
                        },
                        next: {
                            items: { $ref: "#/definitions/step" },
                            type: "array",
                        },
                    },
                    required: ["config", "next"],
                    type: "object",
                },
                type: "object",
                maxProperties: 1,
                minProperties: 1,
            },
        },

        properties: {
            roots: {
                items: { $ref: "#/definitions/step" },
                type: "array",
            },
            plugins: {
                type: "object",
                items: { type: "string"},
            },
        },
        required: ["roots", "plugins"],
    };
}

export enum CheckRecipeConfigResult {
    NotFound = "NotFound",
    Failure = "Failure",
    NotAJson = "NotAJson",
    BaseStructureInvalid = "BaseStructureInvalid",
    Success = "Success",
}

let _interrupt: () => Promise<void> = null;

export abstract class RecipeConfigUtils {

    /**
     * This method will check if the recipe is valid up to it's base structure.
     * Depending on the kind of result, you should act accordingly. E.g. NotAJson should
     * prompt the user to check if the file is corrupted.
     * It will throw if any of the parameters are null.
     * On failure it will print a message on logger.logError, other errors will log in logger.logInfo.
     * Success won't log anything.
     * @param logger all logging will be done here.
     * @param configPath the path to the config file
     * @returns the result of the check
     */
    public static async checkBaseStructure(
        logger: ILogger, configPath: string): Promise<{config: IRecipeConfig, result: CheckRecipeConfigResult}> {
        if (logger == null) {
            throw new VError("logger can't be null");
        }
        if (configPath == null) {
            throw new VError("config path can't be null");
        }

        let configStat;
        try {
            configStat = await fse.stat(configPath);
        } catch (e) {
            logger.logInfo(
                "path '%s' not found.",
                configPath);
            return {config: null, result: CheckRecipeConfigResult.NotFound};
        }

        if (configStat.isDirectory()) {
            logger.logError("'%s' is a directory, it should be a file. Something weird is happening...", configPath);
            return {config: null, result: CheckRecipeConfigResult.Failure};
        }

        if (_interrupt != null) {
            const inter = _interrupt;
            _interrupt = null;
            await inter();
        }

        let content = null;
        try {
            content = await fse.readFile(configPath);
        } catch (e) {
            logger.logError(
                "error reading '%s' with error '%s'",
                configPath, e);
            return {config: null, result: CheckRecipeConfigResult.Failure};
        }

        let contentParsed = null;
        try {
            contentParsed = JSON.parse(content.toString("utf8"));
        } catch (e) {
            logger.logInfo(
                "error parsing '%s' with error '%s'",
                configPath, e);
            return {config: null, result: CheckRecipeConfigResult.NotAJson};
        }

        const res = validateJSON(contentParsed, getBaseConfigSchema());

        if (!res.valid) {
            logger.logInfo("config json '%s' not valid because: %s.",
                configPath, res.errors.map((e) => e.message).join(", "));
            return {config: null, result: CheckRecipeConfigResult.BaseStructureInvalid};
        }

        return {config: contentParsed as IRecipeConfig, result: CheckRecipeConfigResult.Success};
    }

    public static _setTestInterrupt(f: () => Promise<void>) {
        _interrupt = f;
    }
}
