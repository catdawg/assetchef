import { ILogger, LoggerLevel } from "./ilogger";

export function addPrefixToLogger(logger: ILogger, prefix: string): ILogger {

    const prefixedLogger: ILogger = {
        log: (level: LoggerLevel, str: string, ...args: any[]) => {
            logger.log.apply(this, [level, prefix + str, ...args]);
        },
        logDebug: (str: string, ...args: any[]) => {
            logger.logDebug.apply(this, [prefix + str, ...args]);
        },
        logInfo: (str: string, ...args: any[]) => {
            logger.logInfo.apply(this, [prefix + str, ...args]);
        },
        logError: (str: string, ...args: any[]) => {
            logger.logError.apply(this, [prefix + str, ...args]);
        },
        logWarn: (str: string, ...args: any[]) => {
            logger.logWarn.apply(this, [prefix + str, ...args]);
        },
    };

    return prefixedLogger;
}
