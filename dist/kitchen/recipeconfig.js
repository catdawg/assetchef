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
const verror_1 = __importDefault(require("verror"));
const jsonvalidation_1 = require("../utils/jsonvalidation");
exports.ASSETCHEF_CONFIG_FILE = "assetchefRecipe.json";
/**
 * The schema for validating the top level structure of the config
 */
function getBaseConfigSchema() {
    return {
        additionalProperties: false,
        definitions: {
            step: {
                additionalProperties: {
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
        },
        required: ["roots"],
    };
}
exports.getBaseConfigSchema = getBaseConfigSchema;
var CheckRecipeConfigResult;
(function (CheckRecipeConfigResult) {
    CheckRecipeConfigResult["NotFound"] = "NotFound";
    CheckRecipeConfigResult["Failure"] = "Failure";
    CheckRecipeConfigResult["NotAJson"] = "NotAJson";
    CheckRecipeConfigResult["InvalidJson"] = "InvalidJson";
    CheckRecipeConfigResult["Success"] = "Success";
})(CheckRecipeConfigResult = exports.CheckRecipeConfigResult || (exports.CheckRecipeConfigResult = {}));
let _interrupt = null;
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
function checkRecipeConfig(logger, configPath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (logger == null) {
            throw new verror_1.default("logger can't be null");
        }
        if (configPath == null) {
            throw new verror_1.default("config path can't be null");
        }
        let configStat;
        try {
            configStat = yield fse.stat(configPath);
        }
        catch (e) {
            logger.logInfo("path '%s' not found.", configPath);
            return { config: null, result: CheckRecipeConfigResult.NotFound };
        }
        if (configStat.isDirectory()) {
            logger.logError("'%s' is a directory, it should be a file. Something weird is happening...", configPath);
            return { config: null, result: CheckRecipeConfigResult.Failure };
        }
        if (_interrupt != null) {
            const inter = _interrupt;
            _interrupt = null;
            yield inter();
        }
        let content = null;
        try {
            content = yield fse.readFile(configPath);
        }
        catch (e) {
            logger.logError("error reading '%s' with error '%s'", configPath, e);
            return { config: null, result: CheckRecipeConfigResult.Failure };
        }
        let contentParsed = null;
        try {
            contentParsed = JSON.parse(content.toString("utf8"));
        }
        catch (e) {
            logger.logInfo("error parsing '%s' with error '%s'", configPath, e);
            return { config: null, result: CheckRecipeConfigResult.NotAJson };
        }
        const res = jsonvalidation_1.validateJSON(contentParsed, getBaseConfigSchema());
        if (!res.valid) {
            logger.logInfo("config json '%s' not valid because: %s.", configPath, res.errors.map((e) => e.message).join(", "));
            return { config: null, result: CheckRecipeConfigResult.InvalidJson };
        }
        return { config: contentParsed, result: CheckRecipeConfigResult.Success };
    });
}
exports.checkRecipeConfig = checkRecipeConfig;
function _setTestInterrupt(f) {
    _interrupt = f;
}
exports._setTestInterrupt = _setTestInterrupt;
//# sourceMappingURL=recipeconfig.js.map