// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as sinon from "sinon";

import * as logger from "../../src/utils/logger";

describe("logger", () => {

    let logSpy = null;
    let logSpyErr = null;
    beforeEach(() => {
        logSpy = sinon.spy(process.stdout, "write");
        logSpyErr = sinon.spy(process.stderr, "write");
    });

    afterEach(() => {
        logSpy.restore();
        logSpyErr.restore();
    });

    it("should log info simple string", () => {
        logger.logInfo("test message");
        expect(logSpy.lastCall.args[0]).to.contain("test message");
    });

    it("should log warn simple string", () => {
        logger.logWarn("test message");
        expect(logSpy.lastCall.args[0]).to.contain("test message");
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
        expect(logSpy.lastCall.args[0]).to.contain("test message string 123");
    });

    it("should log warn string with parameters", () => {
        logger.logWarn("test message %s %d", "string", 123);
        expect(logSpy.lastCall.args[0]).to.contain("test message string 123");
    });

    it("should log debug string with parameters", () => {
        logger.logDebug("test message %s %d", "string", 123);
        expect(logSpyErr.lastCall.args[0]).to.contain("test message string 123");
    });

    it("should log error string with parameters", () => {
        logger.logError("test message %s %d", "string", 123);
        expect(logSpyErr.lastCall.args[0]).to.contain("test message string 123");
    });

    it("should log info complex types", () => {
        logger.logInfo({test: ["message"] });
        expect(logSpy.lastCall.args[0]).to.contain("test");
        expect(logSpy.lastCall.args[0]).to.contain("message");
    });

    it("should log warn complex types", () => {
        logger.logWarn({test: ["message"] });
        expect(logSpy.lastCall.args[0]).to.contain("test");
        expect(logSpy.lastCall.args[0]).to.contain("message");
    });

    it("should log debug complex types", () => {
        logger.logDebug({test: ["message"] });
        expect(logSpyErr.lastCall.args[0]).to.contain("test");
        expect(logSpyErr.lastCall.args[0]).to.contain("message");
    });

    it("should log error complex types", () => {
        logger.logError({test: ["message"] });
        expect(logSpyErr.lastCall.args[0]).to.contain("test");
        expect(logSpyErr.lastCall.args[0]).to.contain("message");
    });

    it("should log info object with cyclic references", () => {
        const obj = {test: "object", cycle: null};
        obj.cycle = obj;
        logger.logInfo(obj);
        expect(logSpy.lastCall.args[0]).to.contain("test");
        expect(logSpy.lastCall.args[0]).to.contain("object");
    });

    it("should log warn object with cyclic references", () => {
        const obj = {test: "object", cycle: null};
        obj.cycle = obj;
        logger.logWarn(obj);
        expect(logSpy.lastCall.args[0]).to.contain("test");
        expect(logSpy.lastCall.args[0]).to.contain("object");
    });

    it("should log debug object with cyclic references", () => {
        const obj = {test: "object", cycle: null};
        obj.cycle = obj;
        logger.logDebug(obj);
        expect(logSpyErr.lastCall.args[0]).to.contain("test");
        expect(logSpyErr.lastCall.args[0]).to.contain("object");
    });

    it("should log error object with cyclic references", () => {
        const obj = {test: "object", cycle: null};
        obj.cycle = obj;
        logger.logError(obj);
        expect(logSpyErr.lastCall.args[0]).to.contain("test");
        expect(logSpyErr.lastCall.args[0]).to.contain("object");
    });
});
