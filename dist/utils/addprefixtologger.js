"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function addPrefixToLogger(logger, prefix) {
    const prefixedLogger = {
        log: (level, str, ...args) => {
            logger.log.apply(this, [level, prefix + str, ...args]);
        },
        logDebug: (str, ...args) => {
            logger.logDebug.apply(this, [prefix + str, ...args]);
        },
        logInfo: (str, ...args) => {
            logger.logInfo.apply(this, [prefix + str, ...args]);
        },
        logError: (str, ...args) => {
            logger.logError.apply(this, [prefix + str, ...args]);
        },
        logWarn: (str, ...args) => {
            logger.logWarn.apply(this, [prefix + str, ...args]);
        },
    };
    return prefixedLogger;
}
exports.default = addPrefixToLogger;
//# sourceMappingURL=addprefixtologger.js.map