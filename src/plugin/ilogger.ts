/**
 * Generic interface for logging.
 */
interface ILogger {
    logInfo: (...args: any[]) => void;
    logWarn: (...args: any[]) => void;
    logDebug: (...args: any[]) => void;
    logError: (...args: any[]) => void;
}
