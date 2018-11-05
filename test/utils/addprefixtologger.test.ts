// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as sinon from "sinon";

import { ILogger, LoggerLevel } from "../../src/plugin/ilogger";
import addPrefixToLogger from "../../src/utils/addprefixtologger";
import winstonlogger from "../../src/utils/winstonlogger";

describe("addprefixtologger", () => {

    let logSpyErr: sinon.SinonSpy = null;

    let logger: ILogger = null;
    beforeEach(() => {
        logSpyErr = sinon.spy(process.stderr, "write");

        logger = addPrefixToLogger(winstonlogger, "TEST_PREFIX:");
    });

    afterEach(() => {
        logSpyErr.restore();
    });

    it("should log info simple string prefixed", () => {
        logger.logInfo("test message");
        expect(logSpyErr.lastCall.args[0]).to.contain("TEST_PREFIX:test message");
    });

    it("should log warn simple string prefixed", () => {
        logger.logWarn("test message");
        expect(logSpyErr.lastCall.args[0]).to.contain("TEST_PREFIX:test message");
    });

    it("should log debug simple string prefixed", () => {
        logger.logDebug("test message");
        expect(logSpyErr.lastCall.args[0]).to.contain("TEST_PREFIX:test message");
    });

    it("should log error simple string prefixed", () => {
        logger.logError("test message");
        expect(logSpyErr.lastCall.args[0]).to.contain("TEST_PREFIX:test message");
    });

    it("should log info string with parameters prefixed", () => {
        logger.logInfo("test message %s %d", "string", 123);
        expect(logSpyErr.lastCall.args[0]).to.contain("TEST_PREFIX:test message string 123");
    });

    it("should log warn string with parameters prefixed", () => {
        logger.logWarn("test message %s %d", "string", 123);
        expect(logSpyErr.lastCall.args[0]).to.contain("TEST_PREFIX:test message string 123");
    });

    it("should log debug string with parameters prefixed", () => {
        logger.logDebug("test message %s %d", "string", 123);
        expect(logSpyErr.lastCall.args[0]).to.contain("TEST_PREFIX:test message string 123");
    });

    it("should log error string with parameters prefixed", () => {
        logger.logError("test message %s %d", "string", 123);
        expect(logSpyErr.lastCall.args[0]).to.contain("TEST_PREFIX:test message string 123");
    });

    it("should log generic string with parameters prefixed", () => {
        logger.log(LoggerLevel.info, "test message %s %d", "string", 123);
        expect(logSpyErr.lastCall.args[0]).to.contain("TEST_PREFIX:test message string 123");
    });
});
