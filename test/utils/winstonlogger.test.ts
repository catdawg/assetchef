// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as sinon from "sinon";

import logger from "../../src/utils/winstonlogger";

describe("winstonlogger", () => {

    let logSpyErr: sinon.SinonSpy = null;
    beforeEach(() => {
        logSpyErr = sinon.spy(process.stderr, "write");
    });

    afterEach(() => {
        logSpyErr.restore();
    });

    it("should log info simple string", () => {
        logger.logInfo("test message");
        expect(logSpyErr.lastCall.args[0]).to.contain("test message");
    });

    it("should log warn simple string", () => {
        logger.logWarn("test message");
        expect(logSpyErr.lastCall.args[0]).to.contain("test message");
    });

    it("should log debug simple string", () => {
        logger.logDebug("test message");
        expect(logSpyErr.lastCall.args[0]).to.contain("test message");
    });

    it("should log error simple string", () => {
        logger.logError("test message");
        expect(logSpyErr.lastCall.args[0]).to.contain("test message");
    });

    it("should log info string with parameters", () => {
        logger.logInfo("test message %s %d", "string", 123);
        expect(logSpyErr.lastCall.args[0]).to.contain("test message string 123");
    });

    it("should log warn string with parameters", () => {
        logger.logWarn("test message %s %d", "string", 123);
        expect(logSpyErr.lastCall.args[0]).to.contain("test message string 123");
    });

    it("should log debug string with parameters", () => {
        logger.logDebug("test message %s %d", "string", 123);
        expect(logSpyErr.lastCall.args[0]).to.contain("test message string 123");
    });

    it("should log error string with parameters", () => {
        logger.logError("test message %s %d", "string", 123);
        expect(logSpyErr.lastCall.args[0]).to.contain("test message string 123");
    });
});
