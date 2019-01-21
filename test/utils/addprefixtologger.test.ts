// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import { ILogger, LoggerLevel } from "../../src/plugin/ilogger";
import addPrefixToLogger from "../../src/utils/addprefixtologger";
import { getCallTrackingLogger, ILoggerTracer } from "../../test_utils/loggingtracer";
import winstonlogger from "../../test_utils/winstonlogger";

describe("addprefixtologger", () => {

    let logger: ILogger = null;
    let trackedWinstonLogger: ILoggerTracer = null;
    beforeEach(() => {
        trackedWinstonLogger = getCallTrackingLogger(winstonlogger);
        logger = addPrefixToLogger(trackedWinstonLogger, "TEST_PREFIX:");
    });

    it("should log info simple string prefixed", () => {
        logger.logInfo("test message");
        expect(trackedWinstonLogger.lastLogInfo()).to.contain("TEST_PREFIX:test message");
    });

    it("should log warn simple string prefixed", () => {
        logger.logWarn("test message");
        expect(trackedWinstonLogger.lastLogWarn()).to.contain("TEST_PREFIX:test message");
    });

    it("should log debug simple string prefixed", () => {
        logger.logDebug("test message");
        expect(trackedWinstonLogger.lastLogDebug()).to.contain("TEST_PREFIX:test message");
    });

    it("should log error simple string prefixed", () => {
        logger.logError("test message");
        expect(trackedWinstonLogger.lastLogError()).to.contain("TEST_PREFIX:test message");
    });

    it("should log info string with parameters prefixed", () => {
        logger.logInfo("test message %s %d", "string", 123);
        expect(trackedWinstonLogger.lastLogInfo()).to.contain("TEST_PREFIX:test message string 123");
    });

    it("should log warn string with parameters prefixed", () => {
        logger.logWarn("test message %s %d", "string", 123);
        expect(trackedWinstonLogger.lastLogWarn()).to.contain("TEST_PREFIX:test message string 123");
    });

    it("should log debug string with parameters prefixed", () => {
        logger.logDebug("test message %s %d", "string", 123);
        expect(trackedWinstonLogger.lastLogDebug()).to.contain("TEST_PREFIX:test message string 123");
    });

    it("should log error string with parameters prefixed", () => {
        logger.logError("test message %s %d", "string", 123);
        expect(trackedWinstonLogger.lastLogError()).to.contain("TEST_PREFIX:test message string 123");
    });

    it("should log generic string with parameters prefixed", () => {
        logger.log(LoggerLevel.info, "test message %s %d", "string", 123);
        expect(trackedWinstonLogger.lastLogInfo()).to.contain("TEST_PREFIX:test message string 123");
    });
});
