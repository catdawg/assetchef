import commander from "commander";
import * as fse from "fs-extra";
import { VError } from "verror";
import * as winston from "winston";

import {
    IKitchenSetupData,
    ILogger,
    Kitchen,
    LoggerLevel,
    PathTree,
    RecipeCooker,
    SetupErrorKind,
    WatchmanFSWatch} from "@assetchef/core";

winston.addColors({
    debug: "blue",
    error: "red",
    info: "green",
    silly: "magenta",
    verbose: "cyan",
    warn: "yellow",
});

winston.remove(winston.transports.Console);
winston.add(new winston.transports.Console({
    stderrLevels: ["debug", "error", "info", "warn"],
    level: "debug",
    format: winston.format.combine(
        winston.format.splat(),
        winston.format.colorize(),
        winston.format.padLevels(),
        winston.format.timestamp(),
        winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`),
    ),
    silent: false,
}));

const log = (level: LoggerLevel, str: string, ...args: any[]) => {
    switch (level) {
        case LoggerLevel.info:
            winston.info.apply(this, [str, ...args]);
            break;
        case LoggerLevel.warn:
            winston.warn.apply(this, [str, ...args]);
            break;
        case LoggerLevel.debug:
            winston.debug.apply(this, [str, ...args]);
            break;
        case LoggerLevel.error:
            winston.error.apply(this, [str, ...args]);
            break;
    }
};

const winstonlogger: ILogger = {
    logInfo: log.bind(null, LoggerLevel.info),
    logWarn: log.bind(null, LoggerLevel.warn),
    logDebug: log.bind(null, LoggerLevel.debug),
    logError: log.bind(null, LoggerLevel.error),
    log,
};

export async function runner(argv: string[]): Promise<number> {

    commander
    .version("0.0.1")
    .usage("[options] <valid path to assetchef.json config file>")
    .parse(argv);

    if (commander.args.length !== 1) {

        winstonlogger.logError("Please provide one path to an assetchef config file");
        return -1;
    }

    const res = await Kitchen.setup(winstonlogger, commander.args[0]);

    switch (res.error) {
        case SetupErrorKind.ConfigNotJson:
            return -1;
        case SetupErrorKind.FailedToReadConfig:
            return -1;
        case SetupErrorKind.FailedToSetupWorkingFolder:
            return -1;
        case SetupErrorKind.BaseStructureInvalid:
            return -1;
        case SetupErrorKind.MissingPlugins:
            return -1;
        case SetupErrorKind.PluginIncompatible:
            return -1;
        case SetupErrorKind.PluginsFailedToInstall:
            return -1;
        case SetupErrorKind.FullStructureInvalid:
            return -1;
        case SetupErrorKind.None:
            break;
    }

    const successRes: IKitchenSetupData = res as IKitchenSetupData;

    // create the cooker
    const watch = await WatchmanFSWatch.watchPath(winstonlogger, successRes.projectFolder);

    const recipe = new RecipeCooker();
    await recipe.setup(
        winstonlogger,
        successRes.projectFolder,
        watch, successRes.recipeConfig.roots, new PathTree<Buffer>(), successRes.plugins);

    await recipe.cookOnce();

    await recipe.destroy();

    watch.cancel();

    return 0;
}
