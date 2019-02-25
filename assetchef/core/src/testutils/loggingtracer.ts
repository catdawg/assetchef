import * as util from "util";

import { ILogger, LoggerLevel } from "../comm/ilogger";

export interface ILoggerTracer extends ILogger {
    lastLogInfo: () => string;
    lastLogError: () => string;
    lastLogDebug: () => string;
    lastLogWarn: () => string;
}

export function getCallTrackingLogger(originalLogger: ILogger): ILoggerTracer {
    let calledLogInfo: string = null;
    let calledLogError: string = null;
    let calledLogWarn: string = null;
    let calledLogDebug: string = null;

    return {
        logInfo: (...args: any[]) => {
            calledLogInfo = util.format.apply(null, [...args]);
            originalLogger.logInfo.apply(this, args);
        },
        logError: (...args: any[]) => {
            calledLogError = util.format.apply(null, [...args]);
            originalLogger.logError.apply(this, args);
        },
        logWarn: (...args: any[]) => {
            calledLogWarn = util.format.apply(null, [...args]);
            originalLogger.logWarn.apply(this, args);
        },
        logDebug: (...args: any[]) => {
            calledLogDebug = util.format.apply(null, [...args]);
            originalLogger.logDebug.apply(this, args);
        },
        log: (level: LoggerLevel, ...args: any[]) => {
            switch (level) {
                case LoggerLevel.info:
                    calledLogInfo = util.format.apply(null, [...args]);
                    originalLogger.logInfo.apply(this, args);
                    break;
                case LoggerLevel.warn:
                    calledLogWarn = util.format.apply(null, [...args]);
                    originalLogger.logWarn.apply(this, args);
                    break;
                case LoggerLevel.debug:
                    calledLogDebug = util.format.apply(null, [...args]);
                    originalLogger.logDebug.apply(this, args);
                    break;
                case LoggerLevel.error:
                    calledLogError = util.format.apply(null, [...args]);
                    originalLogger.logError.apply(this, args);
                    break;
            }
        },
        lastLogInfo: () => {const ret = calledLogInfo; calledLogInfo = null; return ret; },
        lastLogError: () => {const ret = calledLogError; calledLogError = null; return ret; },
        lastLogDebug: () => {const ret = calledLogDebug; calledLogDebug = null; return ret; },
        lastLogWarn: () => {const ret = calledLogWarn; calledLogWarn = null; return ret; },
    };
}
