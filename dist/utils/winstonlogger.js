"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston = __importStar(require("winston"));
const ilogger_1 = require("../plugin/ilogger");
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
const log = (level, ...args) => {
    switch (level) {
        case ilogger_1.ILoggerLevel.info:
            winston.info.apply(this, args);
            break;
        case ilogger_1.ILoggerLevel.warn:
            winston.warn.apply(this, args);
            break;
        case ilogger_1.ILoggerLevel.debug:
            winston.debug.apply(this, args);
            break;
        case ilogger_1.ILoggerLevel.error:
            winston.error.apply(this, args);
            break;
    }
};
const winstonlogger = {
    logInfo: log.bind(null, ilogger_1.ILoggerLevel.info),
    logWarn: log.bind(null, ilogger_1.ILoggerLevel.warn),
    logDebug: log.bind(null, ilogger_1.ILoggerLevel.debug),
    logError: log.bind(null, ilogger_1.ILoggerLevel.error),
    log,
};
exports.default = winstonlogger;
//# sourceMappingURL=winstonlogger.js.map