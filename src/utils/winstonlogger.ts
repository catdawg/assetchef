import * as winston from "winston";
import { ILogger, ILoggerLevel } from "../plugin/ilogger";

winston.addColors({
    debug: "blue",
    error: "red",
    info: "green",
    silly: "magenta",
    verbose: "cyan",
    warn: "yellow",
});

winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
    colorize: true,
    level: "debug",
    prettyPrint: true,
    silent: false,
    timestamp: true,
});

const log = (level: ILoggerLevel, ...args: any[]) => {
    switch (level) {
        case ILoggerLevel.info:
            winston.info.apply(this, args);
            break;
        case ILoggerLevel.warn:
            winston.warn.apply(this, args);
            break;
        case ILoggerLevel.debug:
            winston.debug.apply(this, args);
            break;
        case ILoggerLevel.error:
            winston.error.apply(this, args);
            break;
    }
};

const winstonlogger: ILogger = {
    logInfo: log.bind(null, ILoggerLevel.info),
    logWarn: log.bind(null, ILoggerLevel.warn),
    logDebug: log.bind(null, ILoggerLevel.debug),
    logError: log.bind(null, ILoggerLevel.error),
    log,
};

export default winstonlogger;
