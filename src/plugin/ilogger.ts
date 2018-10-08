export enum ILoggerLevel {
    info = "info",
    warn = "warn",
    debug = "debug",
    error = "error",
}

/**
 * Generic interface for logging.
 */
export interface ILogger {
    logInfo: (...args: any[]) => void;
    logWarn: (...args: any[]) => void;
    logDebug: (...args: any[]) => void;
    logError: (...args: any[]) => void;
    log: (level: ILoggerLevel, ...args: any[]) => void;
}
