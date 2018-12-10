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
winston.add(new winston.transports.Console({
    stderrLevels: ["debug", "error", "info", "warn"],
    level: "debug",
    format: winston.format.combine(winston.format.splat(), winston.format.colorize(), winston.format.padLevels(), winston.format.timestamp(), winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)),
    silent: false,
}));
const log = (level, str, ...args) => {
    switch (level) {
        case ilogger_1.LoggerLevel.info:
            winston.info.apply(this, [str, ...args]);
            break;
        case ilogger_1.LoggerLevel.warn:
            winston.warn.apply(this, [str, ...args]);
            break;
        case ilogger_1.LoggerLevel.debug:
            winston.debug.apply(this, [str, ...args]);
            break;
        case ilogger_1.LoggerLevel.error:
            winston.error.apply(this, [str, ...args]);
            break;
    }
};
const winstonlogger = {
    logInfo: log.bind(null, ilogger_1.LoggerLevel.info),
    logWarn: log.bind(null, ilogger_1.LoggerLevel.warn),
    logDebug: log.bind(null, ilogger_1.LoggerLevel.debug),
    logError: log.bind(null, ilogger_1.LoggerLevel.error),
    log,
};
exports.default = winstonlogger;
//# sourceMappingURL=winstonlogger.js.map