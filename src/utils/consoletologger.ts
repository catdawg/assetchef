import { VError } from "verror";
import { ILogger, ILoggerLevel } from "../plugin/ilogger";

/**
 * used to cancel the redirection. See ConsoleToLogger.redirect
 */
export interface ICancelConsoleToLoggerRedirection {
    cancel: () => void;
}

function redirectStream(stream: any, into: (...obj: any[]) => void): {cancel: () => void} {
    let intercept: () => void = null;
    let removeIntercept: () => void = null;

    let buffer: string = null;

    function specialWrite(chunk: string | Buffer, encoding: string, callback: () => void) {
        if (chunk instanceof Buffer) {
            chunk = chunk.toString(encoding ? encoding : "utf8");
        }

        let tempBuffer: string = null;

        let startIndex = 0;
        while (true) {
            const index = chunk.indexOf("\n", startIndex);

            if (index !== -1) {
                const slice = chunk.slice(startIndex, index);
                buffer = (buffer != null ? buffer : "") + slice;

                tempBuffer = (tempBuffer != null ? tempBuffer : "") + buffer;
                buffer = null;
                startIndex = index + 1;
            } else {
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

    intercept = () => {
        stream.write_original = stream.write;
        stream.isTTY_original = stream.isTTY;
        stream.write = specialWrite;
        stream.isTTY = false;
    };

    removeIntercept = () => {
        stream.isTTY = stream.isTTY_original;
        stream.write = stream.write_original;
        stream.write_original = null;
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
export abstract class ConsoleToLogger {
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
    public static redirect(
        logger: ILogger,
        stderrLevel: ILoggerLevel,
        stdoutLevel: ILoggerLevel): ICancelConsoleToLoggerRedirection {

        if ((process as any).__consoleToLoggerRedirectionActive) {
            throw new VError("only one redirect to console allowed, cancel the previous one");
        }

        if (logger == null) {
            throw new VError("logger parameter can't be null");
        }

        if (stderrLevel == null) {
            throw new VError("stderrLevel parameter can't be null");
        }

        if (stdoutLevel == null) {
            throw new VError("stdoutLevel parameter can't be null");
        }

        (process as any).__consoleToLoggerRedirectionActive = true;

        const stderrRedirectController = redirectStream(process.stderr, logger.log.bind(logger.log, stderrLevel));
        const stdoutRedirectController = redirectStream(process.stdout, logger.log.bind(logger.log, stdoutLevel));

        return {
            cancel: () => {
                if (!(process as any).__consoleToLoggerRedirectionActive) {
                    return;
                }
                (process as any).__consoleToLoggerRedirectionActive = false;
                stderrRedirectController.cancel();
                stdoutRedirectController.cancel();
            },
        };
    }
}
