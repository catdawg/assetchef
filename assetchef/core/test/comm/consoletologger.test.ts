// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as sinon from "sinon";
import VError from "verror";

import { LoggerLevel } from "../../src/comm/ilogger";
import { getCallTrackingLogger } from "../../src/testutils/loggingtracer";
import { winstonlogger } from "../../src/testutils/winstonlogger";

import { ConsoleToLogger, ICancelConsoleToLoggerRedirection } from "../../src/comm/consoletologger";

describe("consoletologger", () => {

    let logSpyErr: sinon.SinonSpy = null;
    beforeEach(() => {
        logSpyErr = sinon.spy(process.stderr, "write");
    });

    afterEach(() => {
        logSpyErr.restore();
    });

    it("should turn console into winston", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, LoggerLevel.warn, LoggerLevel.info);

        try {
            // tslint:disable-next-line:no-console
            console.log("test message");
            expect(trackingLogger.lastLogInfo()).to.contain("test message");
        } finally {
            redirect.cancel();
        }
    });

    it("should turn process.stdout into winston", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, LoggerLevel.warn, LoggerLevel.info);

        try {
            process.stdout.write("test message");
            redirect.cancel();
            expect(trackingLogger.lastLogInfo()).to.contain("test message");
        } finally {
            redirect.cancel();
        }
    });

    it("different cases with newline 1", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, LoggerLevel.warn, LoggerLevel.info);

        try {
            process.stdout.write("something\ntest message");
            redirect.cancel();
            expect(trackingLogger.lastLogInfo()).to.contain("test message");
        } finally {
            redirect.cancel();
        }
    });

    it("different cases with newline 2", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, LoggerLevel.warn, LoggerLevel.info);

        try {
            process.stdout.write("something\n");
            process.stdout.write("test message");
            redirect.cancel();
            expect(trackingLogger.lastLogInfo()).to.contain("test message");
        } finally {
            redirect.cancel();
        }
    });

    it("different cases with newline 3", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, LoggerLevel.warn, LoggerLevel.info);

        try {
            process.stdout.write("something\ntest ");
            process.stdout.write("message");
            redirect.cancel();
            expect(trackingLogger.lastLogInfo()).to.contain("test message");
        } finally {
            redirect.cancel();
        }
    });

    it("different cases with newline 4", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, LoggerLevel.warn, LoggerLevel.info);

        try {
            process.stdout.write("\n");
            redirect.cancel();
            expect(trackingLogger.lastLogInfo()).to.be.not.null;
        } finally {
            redirect.cancel();
        }
    });
    it("different cases with newline 5", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, LoggerLevel.warn, LoggerLevel.info);

        try {
            process.stdout.write("something");
            process.stdout.write("\ntest message");
            redirect.cancel();
            expect(trackingLogger.lastLogInfo()).to.contain("test message");
        } finally {
            redirect.cancel();
        }
    });

    it("buffer case 1", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, LoggerLevel.warn, LoggerLevel.info);

        try {
            process.stdout.write(Buffer.from("test message", "utf8"));
            redirect.cancel();
            expect(trackingLogger.lastLogInfo()).to.contain("test message");
        } finally {
            redirect.cancel();
        }
    });

    it("buffer case 2", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, LoggerLevel.warn, LoggerLevel.info);

        try {
            // typescript declaration doesn't allow buffer and encoding for some reason, but we check it anyway
            (process.stdout.write as any)(Buffer.from("test message", "utf8"), "utf8");

            redirect.cancel();
            expect(trackingLogger.lastLogInfo()).to.contain("test message");
        } finally {
            redirect.cancel();
        }
    });

    it("with callback", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, LoggerLevel.warn, LoggerLevel.info);

        try {
            let called = false;
            process.stdout.write("test message", "utf8", () => called = true);
            redirect.cancel();
            expect(trackingLogger.lastLogInfo()).to.contain("test message");
            expect(called).to.be.true;
        } finally {
            redirect.cancel();
        }
    });

    it("double redirect error", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        let redirect = ConsoleToLogger.redirect(trackingLogger, LoggerLevel.warn, LoggerLevel.info);

        try {
            expect(() => redirect = ConsoleToLogger.redirect(trackingLogger, LoggerLevel.warn, LoggerLevel.info))
                .to.throw(VError);
        } finally {
            redirect.cancel();
        }
    });

    it("null parameters error", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        let redirect: ICancelConsoleToLoggerRedirection = null;

        try {
            expect(() => redirect = ConsoleToLogger.redirect(null, null, null))
                .to.throw(VError);
            expect(() => redirect = ConsoleToLogger.redirect(trackingLogger, null, null))
                .to.throw(VError);
            expect(() => redirect = ConsoleToLogger.redirect(trackingLogger, LoggerLevel.warn, null))
                .to.throw(VError);
            expect(() => redirect = ConsoleToLogger.redirect(trackingLogger, null, LoggerLevel.warn))
                .to.throw(VError);
        } finally {
            if (redirect != null) {
                redirect.cancel();
            }
        }
    });
});