import { API_LEVEL } from "../apilevel";
import { ILogger } from "../comm/ilogger";
import { IRecipePlugin } from "../irecipeplugin";

export abstract class PluginCheck {
    /**
     * Checks if a plugin is compatible. Right now it only checks for the apiLevel,
     * but the idea is to check better to see if the plugin is well written.
     * @param logger the logger in case we need to inform something
     * @param plugin the plugint o check
     * @returns true if successful, false otherwise
     */
    public static isPluginValid(logger: ILogger, plugin: IRecipePlugin): boolean {
        return plugin.apiLevel != null && plugin.apiLevel === API_LEVEL;
    }
}
