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
    level: "info",
    prettyPrint: true,
    silent: false,
    timestamp: true,
});

/**
 * Logs the parameters to the console with the info category.
 * Arguments are like {@link https://nodejs.org/api/util.html#util_util_format_format_args|link util.format}.
 * This should support objects with cycles.
 * @param {...any} args -
 * {@link https://nodejs.org/api/util.html#util_util_format_format_args|link util.format} type args.
 * @returns {void}
 */
export function logInfo(...args: any[]) {
    winston.info.apply(this, args);
}

/**
 * Logs the parameters to the console with the warn category.
 * Arguments are like {@link https://nodejs.org/api/util.html#util_util_format_format_args|link util.format}
 * This should support objects with cycles.
 * @param {...any} args -
 * {@link https://nodejs.org/api/util.html#util_util_format_format_args|link util.format} type args.
 * @returns {void}
 */
export function logWarn(...args: any[]) {
    winston.warn.apply(this, args);
}

/**
 * Logs the parameters to the console with the debug category.
 * Arguments are like {@link https://nodejs.org/api/util.html#util_util_format_format_args|link util.format}
 * This should support objects with cycles.
 * @param {...any} args -
 * {@link https://nodejs.org/api/util.html#util_util_format_format_args|link util.format} type args.
 * @returns {void}
 */
export function logDebug(...args: any[]) {
    winston.debug.apply(this, args);
}
