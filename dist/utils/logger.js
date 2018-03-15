"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
}
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
    timestamp: false,
});
/**
 * Logs the parameters to the console with the info category.
 * Arguments are like {@link https://nodejs.org/api/util.html#util_util_format_format_args|link util.format}.
 * This should support objects with cycles.
 * @param {...any} args -
 * {@link https://nodejs.org/api/util.html#util_util_format_format_args|link util.format} type args.
 * @returns {void}
 */
function logInfo(...args) {
    winston.info.apply(this, args);
}
exports.logInfo = logInfo;
/**
 * Logs the parameters to the console with the warn category.
 * Arguments are like {@link https://nodejs.org/api/util.html#util_util_format_format_args|link util.format}
 * This should support objects with cycles.
 * @param {...any} args -
 * {@link https://nodejs.org/api/util.html#util_util_format_format_args|link util.format} type args.
 * @returns {void}
 */
function logWarn(...args) {
    winston.warn.apply(this, args);
}
exports.logWarn = logWarn;
/**
 * Logs the parameters to the console with the debug category.
 * Arguments are like {@link https://nodejs.org/api/util.html#util_util_format_format_args|link util.format}
 * This should support objects with cycles.
 * @param {...any} args -
 * {@link https://nodejs.org/api/util.html#util_util_format_format_args|link util.format} type args.
 * @returns {void}
 */
function logDebug(...args) {
    winston.debug.apply(this, args);
}
exports.logDebug = logDebug;
//# sourceMappingURL=logger.js.map