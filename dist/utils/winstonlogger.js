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
const logger = {
    logInfo: (...args) => winston.info.apply(this, args),
    logWarn: (...args) => winston.warn.apply(this, args),
    logDebug: (...args) => winston.debug.apply(this, args),
    logError: (...args) => winston.error.apply(this, args),
};
exports.default = logger;
//# sourceMappingURL=winstonlogger.js.map