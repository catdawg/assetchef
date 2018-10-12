"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const verror_1 = require("verror");
function redirectProcess(stdout, into) {
    let intercept = null;
    let removeIntercept = null;
    let buffer = null;
    function specialWrite(chunk, encoding, callback) {
        if (chunk instanceof Buffer) {
            chunk = chunk.toString(encoding ? encoding : "utf8");
        }
        let tempBuffer = null;
        let startIndex = 0;
        while (true) {
            const index = chunk.indexOf("\n", startIndex);
            if (index !== -1) {
                const slice = chunk.slice(startIndex, index);
                buffer = (buffer != null ? buffer : "") + slice;
                tempBuffer = (tempBuffer != null ? tempBuffer : "") + buffer;
                buffer = null;
                startIndex = index + 1;
            }
            else {
                const slice = chunk.slice(startIndex);
                buffer = (buffer != null ? buffer : "") + slice;
                break;
            }
        }
        if (callback != null) {
            callback();
        }
        if (tempBuffer != null) {
            removeIntercept();
            into(tempBuffer);
            intercept();
        }
    }
    const writeOriginal = stdout ? process.stdout.write : process.stderr.write;
    const isTTYOriginal = stdout ? process.stdout.isTTY : process.stderr.isTTY;
    intercept = () => {
        if (stdout) {
            process.stdout.write = specialWrite;
            process.stdout.isTTY = false;
        }
        else {
            process.stderr.write = specialWrite;
            process.stderr.isTTY = false;
        }
    };
    removeIntercept = () => {
        if (stdout) {
            process.stdout.write = writeOriginal;
            process.stdout.isTTY = isTTYOriginal;
        }
        else {
            process.stderr.write = writeOriginal;
            process.stderr.isTTY = isTTYOriginal;
        }
    };
    intercept();
    return {
        cancel: () => {
            removeIntercept();
            if (buffer != null && buffer.length > 0) {
                into(buffer);
            }
        },
    };
}
/**
 * See redirect static method.
 */
class ConsoleToLogger {
    /**
     * This method will redirect the stdout and stderr to the logger method.
     * Only one can be active at a time, so if this method is called twice, before
     * calling cancel on the first in the returned object, it will throw.
     * The level where the stdout and stderr will go respectively is given by the two parameters.
     * @param logger logger to redirect
     * @param stderrLevel logger level where stderr will go to
     * @param stdoutLevel logger level where stdout will go to
     * @returns token object to cancel the process and flush any outstanding data.
     */
    static redirect(logger, stderrLevel, stdoutLevel) {
        if (process.__consoleToLoggerRedirectionActive) {
            throw new verror_1.VError("only one redirect to console allowed, cancel the previous one");
        }
        if (logger == null) {
            throw new verror_1.VError("logger parameter can't be null");
        }
        if (stderrLevel == null) {
            throw new verror_1.VError("stderrLevel parameter can't be null");
        }
        if (stdoutLevel == null) {
            throw new verror_1.VError("stdoutLevel parameter can't be null");
        }
        process.__consoleToLoggerRedirectionActive = true;
        const stderrRedirectController = redirectProcess(false, logger.log.bind(logger.log, stderrLevel));
        const stdoutRedirectController = redirectProcess(false, logger.log.bind(logger.log, stdoutLevel));
        return {
            cancel: () => {
                if (!process.__consoleToLoggerRedirectionActive) {
                    return;
                }
                process.__consoleToLoggerRedirectionActive = false;
                stderrRedirectController.cancel();
                stdoutRedirectController.cancel();
            },
        };
    }
}
exports.ConsoleToLogger = ConsoleToLogger;
//# sourceMappingURL=consoletologger.js.map