// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as sinon from "sinon";

import { logDebug, logError, logInfo, logWarn } from "../../src/utils/logger";

describe("logger", () => {

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

    it("should log info simple string", () => {
        logInfo("test message");
        expect(logSpy.lastCall.args[0]).to.contain("test message");
    });

    it("should log warn simple string", () => {
        logWarn("test message");
        expect(logSpy.lastCall.args[0]).to.contain("test message");
    });

    it("should log debug simple string", () => {
        logDebug("test message");
        expect(logSpyErr.lastCall.args[0]).to.contain("test message");
    });

    it("should log error simple string", () => {
        logError("test message");
        expect(logSpyErr.lastCall.args[0]).to.contain("test message");
    });

    it("should log info string with parameters", () => {
        logInfo("test message %s %d", "string", 123);
        expect(logSpy.lastCall.args[0]).to.contain("test message string 123");
    });

    it("should log warn string with parameters", () => {
        logWarn("test message %s %d", "string", 123);
        expect(logSpy.lastCall.args[0]).to.contain("test message string 123");
    });

    it("should log debug string with parameters", () => {
        logDebug("test message %s %d", "string", 123);
        expect(logSpyErr.lastCall.args[0]).to.contain("test message string 123");
    });

    it("should log error string with parameters", () => {
        logError("test message %s %d", "string", 123);
        expect(logSpyErr.lastCall.args[0]).to.contain("test message string 123");
    });

    it("should log info complex types", () => {
        logInfo({test: ["message"] });
        expect(logSpy.lastCall.args[0]).to.contain("test");
        expect(logSpy.lastCall.args[0]).to.contain("message");
    });

    it("should log warn complex types", () => {
        logWarn({test: ["message"] });
        expect(logSpy.lastCall.args[0]).to.contain("test");
        expect(logSpy.lastCall.args[0]).to.contain("message");
    });

    it("should log debug complex types", () => {
        logDebug({test: ["message"] });
        expect(logSpyErr.lastCall.args[0]).to.contain("test");
        expect(logSpyErr.lastCall.args[0]).to.contain("message");
    });

    it("should log error complex types", () => {
        logError({test: ["message"] });
        expect(logSpyErr.lastCall.args[0]).to.contain("test");
        expect(logSpyErr.lastCall.args[0]).to.contain("message");
    });

    it("should log info object with cyclic references", () => {
        const obj: any = {test: "object", cycle: null};
        obj.cycle = obj;
        logInfo(obj);
        expect(logSpy.lastCall.args[0]).to.contain("test");
        expect(logSpy.lastCall.args[0]).to.contain("object");
    });

    it("should log warn object with cyclic references", () => {
        const obj: any = {test: "object", cycle: null};
        obj.cycle = obj;
        logWarn(obj);
        expect(logSpy.lastCall.args[0]).to.contain("test");
        expect(logSpy.lastCall.args[0]).to.contain("object");
    });

    it("should log debug object with cyclic references", () => {
        const obj: any = {test: "object", cycle: null};
        obj.cycle = obj;
        logDebug(obj);
        expect(logSpyErr.lastCall.args[0]).to.contain("test");
        expect(logSpyErr.lastCall.args[0]).to.contain("object");
    });

    it("should log error object with cyclic references", () => {
        const obj: any = {test: "object", cycle: null};
        obj.cycle = obj;
        logError(obj);
        expect(logSpyErr.lastCall.args[0]).to.contain("test");
        expect(logSpyErr.lastCall.args[0]).to.contain("object");
    });
});
