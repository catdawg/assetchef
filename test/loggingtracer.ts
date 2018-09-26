import { ILogger } from "../src/plugin/ilogger";

export interface ILoggerTracer extends ILogger {
    logInfo: (...args: any[]) => void;
    logWarn: (...args: any[]) => void;
    logDebug: (...args: any[]) => void;
    logError: (...args: any[]) => void;
    didCallLogInfo: () => boolean;
    didCallLogError: () => boolean;
    didCallLogDebug: () => boolean;
    didCallLogWarn: () => boolean;
}

export function getCallTrackingLogger(originalLogger: ILogger): ILoggerTracer {
    let calledLogInfo = false;
    let calledLogError = false;
    let calledLogWarn = false;
    let calledLogDebug = false;

    return {
        logInfo: (...args: any[]) => {
            calledLogInfo = true;
            originalLogger.logInfo.apply(this, args);
        },
        logError: (...args: any[]) => {
            calledLogError = true;
            originalLogger.logError.apply(this, args);
        },
        logWarn: (...args: any[]) => {
            calledLogWarn = true;
            originalLogger.logWarn.apply(this, args);
        },
        logDebug: (...args: any[]) => {
            calledLogDebug = true;
            originalLogger.logDebug.apply(this, args);
        },
        didCallLogInfo: () => calledLogInfo,
        didCallLogError: () => calledLogError,
        didCallLogDebug: () => calledLogDebug,
        didCallLogWarn: () => calledLogWarn,
    };
}
