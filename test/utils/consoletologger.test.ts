// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as sinon from "sinon";
import VError from "verror";

import { ILoggerLevel } from "../../src/plugin/ilogger";
import { ConsoleToLogger, ICancelConsoleToLoggerRedirection } from "../../src/utils/consoletologger";
import winstonlogger from "../../src/utils/winstonlogger";
import { getCallTrackingLogger } from "../loggingtracer";

describe("consoletologger", () => {

    let logSpy: sinon.SinonSpy = null;
    let logSpyErr: sinon.SinonSpy = null;
    beforeEach(() => {
        logSpy = sinon.spy(process.stdout, "write");
        logSpyErr = sinon.spy(process.stderr, "write");
    });

    afterEach(() => {
        logSpy.restore();
        logSpyErr.restore();
    });

    it("should turn console into winston", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, ILoggerLevel.warn, ILoggerLevel.info);

        try {
            // tslint:disable-next-line:no-console
            console.log("test message");
            expect(logSpy.lastCall.args[0]).to.contain("test message");
            expect(trackingLogger.didCallLogInfo()).to.be.true;
        } finally {
            redirect.cancel();
        }
    });

    it("should turn process.stdout into winston", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, ILoggerLevel.warn, ILoggerLevel.info);

        try {
            process.stdout.write("test message");
            redirect.cancel();
            expect(logSpy.lastCall.args[0]).to.contain("test message");
            expect(trackingLogger.didCallLogInfo()).to.be.true;
        } finally {
            redirect.cancel();
        }
    });

    it("different cases with newline 1", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, ILoggerLevel.warn, ILoggerLevel.info);

        try {
            process.stdout.write("something\ntest message");
            redirect.cancel();
            expect(logSpy.lastCall.args[0]).to.contain("test message");
            expect(trackingLogger.didCallLogInfo()).to.be.true;
        } finally {
            redirect.cancel();
        }
    });

    it("different cases with newline 2", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, ILoggerLevel.warn, ILoggerLevel.info);

        try {
            process.stdout.write("something\n");
            process.stdout.write("test message");
            redirect.cancel();
            expect(logSpy.lastCall.args[0]).to.contain("test message");
            expect(trackingLogger.didCallLogInfo()).to.be.true;
        } finally {
            redirect.cancel();
        }
    });

    it("different cases with newline 3", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, ILoggerLevel.warn, ILoggerLevel.info);

        try {
            process.stdout.write("something\ntest ");
            process.stdout.write("message");
            redirect.cancel();
            expect(logSpy.lastCall.args[0]).to.contain("test message");
            expect(trackingLogger.didCallLogInfo()).to.be.true;
        } finally {
            redirect.cancel();
        }
    });

    it("different cases with newline 4", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, ILoggerLevel.warn, ILoggerLevel.info);

        try {
            process.stdout.write("\n");
            redirect.cancel();
            expect(trackingLogger.didCallLogInfo()).to.be.true;
        } finally {
            redirect.cancel();
        }
    });
    it("different cases with newline 5", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, ILoggerLevel.warn, ILoggerLevel.info);

        try {
            process.stdout.write("something");
            process.stdout.write("\ntest message");
            redirect.cancel();
            expect(logSpy.lastCall.args[0]).to.contain("test message");
            expect(trackingLogger.didCallLogInfo()).to.be.true;
        } finally {
            redirect.cancel();
        }
    });

    it("buffer case 1", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, ILoggerLevel.warn, ILoggerLevel.info);

        try {
            process.stdout.write(Buffer.from("test message", "utf8"));
            redirect.cancel();
            expect(logSpy.lastCall.args[0]).to.contain("test message");
            expect(trackingLogger.didCallLogInfo()).to.be.true;
        } finally {
            redirect.cancel();
        }
    });

    it("buffer case 2", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, ILoggerLevel.warn, ILoggerLevel.info);

        try {
            // typescript declaration doesn't allow buffer and encoding for some reason, but we check it anyway
            (process.stdout.write as any)(Buffer.from("test message", "utf8"), "utf8");

            redirect.cancel();
            expect(logSpy.lastCall.args[0]).to.contain("test message");
            expect(trackingLogger.didCallLogInfo()).to.be.true;
        } finally {
            redirect.cancel();
        }
    });

    it("with callback", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        const redirect = ConsoleToLogger.redirect(trackingLogger, ILoggerLevel.warn, ILoggerLevel.info);

        try {
            let called = false;
            process.stdout.write("test message", "utf8", () => called = true);
            redirect.cancel();
            expect(logSpy.lastCall.args[0]).to.contain("test message");
            expect(trackingLogger.didCallLogInfo()).to.be.true;
            expect(called).to.be.true;
        } finally {
            redirect.cancel();
        }
    });

    it("double redirect error", () => {
        const trackingLogger = getCallTrackingLogger(winstonlogger);
        let redirect = ConsoleToLogger.redirect(trackingLogger, ILoggerLevel.warn, ILoggerLevel.info);

        try {
            expect(() => redirect = ConsoleToLogger.redirect(trackingLogger, ILoggerLevel.warn, ILoggerLevel.info))
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
            expect(() => redirect = ConsoleToLogger.redirect(trackingLogger, ILoggerLevel.warn, null))
                .to.throw(VError);
            expect(() => redirect = ConsoleToLogger.redirect(trackingLogger, null, ILoggerLevel.warn))
                .to.throw(VError);
        } finally {
            if (redirect != null) {
                redirect.cancel();
            }
        }
    });
});