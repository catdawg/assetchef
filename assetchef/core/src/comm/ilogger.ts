export enum LoggerLevel {
    info = "info",
    warn = "warn",
    debug = "debug",
    error = "error",
}

/**
 * Generic interface for logging.
 */
export interface ILogger {
    logInfo: (str: string, ...args: any[]) => void;
    logWarn: (str: string, ...args: any[]) => void;
    logDebug: (str: string, ...args: any[]) => void;
    logError: (str: string, ...args: any[]) => void;
    log: (level: LoggerLevel, str: string, ...args: any[]) => void;
}
