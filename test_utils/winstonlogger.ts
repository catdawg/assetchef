import * as winston from "winston";
import { ILogger, LoggerLevel } from "../src/plugin/ilogger";

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

export default winstonlogger;
