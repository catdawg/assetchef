"use strict";
const winston = require("winston");

const logger = module.exports = {};

winston.addColors({
    silly: "magenta",
    debug: "blue",
    verbose: "cyan",
    info: "green",
    warn: "yellow",
    error: "red"
});
  
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
    level: process.env.LOG_LEVEL,
    prettyPrint: true,
    colorize: true,
    silent: false,
    timestamp: false
});

/**
 * Logs the parameters to the console with the info category. 
 * Arguments are like {@link https://nodejs.org/api/util.html#util_util_format_format_args|link util.format}. 
 * This should support objects with cycles.
 * @param {...any} args - {@link https://nodejs.org/api/util.html#util_util_format_format_args|link util.format} type args.
 * @returns {void}
 */
logger.logInfo = function (...args) {
    winston.info.apply(this, args);
};

/**
 * Logs the parameters to the console with the warn categorby. Arguments are like {@link https://nodejs.org/api/util.html#util_util_format_format_args|link util.format}
 * This should support objects with cycles.
 * @param {...any} args - {@link https://nodejs.org/api/util.html#util_util_format_format_args|link util.format} type args.
 * @returns {void}
 */
logger.logWarn = function (...args) {
    winston.warn.apply(this, args);
};
