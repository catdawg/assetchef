import { ILogger, LoggerLevel } from "../src/plugin/ilogger";

export interface ILoggerTracer extends ILogger {
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
        log: (level: LoggerLevel, ...args: any[]) => {
            switch (level) {
                case LoggerLevel.info:
                    calledLogInfo = true;
                    originalLogger.logInfo.apply(this, args);
                    break;
                case LoggerLevel.warn:
                    calledLogWarn = true;
                    originalLogger.logWarn.apply(this, args);
                    break;
                case LoggerLevel.debug:
                    calledLogDebug = true;
                    originalLogger.logDebug.apply(this, args);
                    break;
                case LoggerLevel.error:
                    calledLogError = true;
                    originalLogger.logError.apply(this, args);
                    break;
            }
        },
        didCallLogInfo: () => {const ret = calledLogInfo; calledLogInfo = false; return ret; },
        didCallLogError: () => {const ret = calledLogError; calledLogError = false; return ret; },
        didCallLogDebug: () => {const ret = calledLogDebug; calledLogDebug = false; return ret; },
        didCallLogWarn: () => {const ret = calledLogWarn; calledLogWarn = false; return ret; },
    };
}
