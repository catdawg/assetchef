import * as winston from "winston";

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

const logger: ILogger = {
    logInfo: (...args) => winston.info.apply(this, args),
    logWarn: (...args) => winston.warn.apply(this, args),
    logDebug: (...args) => winston.debug.apply(this, args),
    logError: (...args) => winston.error.apply(this, args),
};

export default logger;
