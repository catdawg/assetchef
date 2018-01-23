"use strict";
/* eslint-env mocha */

const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
chai.use(sinonChai);

const logger = require("../../lib/utils/logger");

describe("logger", function () {

    let logSpy = null;
    let logSpyErr = null;
    beforeEach(function () {
        logSpy = sinon.spy(process.stdout, "write");
        logSpyErr = sinon.spy(process.stderr, "write");
    });

    afterEach(function () {
        logSpy.restore();
        logSpyErr.restore();
    });

    it("should log info simple string", function () {
        logger.logInfo("test message");
        expect(logSpy.lastCall.args[0]).to.contain("test message");
    });

    it("should log warn simple string", function () {
        logger.logWarn("test message");
        expect(logSpy.lastCall.args[0]).to.contain("test message");
    });

    it("should log debug simple string", function () {
        logger.logDebug("test message");
        expect(logSpyErr.lastCall.args[0]).to.contain("test message");
    });

    it("should log info string with parameters", function () {
        logger.logInfo("test message %s %d", "string", 123);
        expect(logSpy.lastCall.args[0]).to.contain("test message string 123");
    });
    
    it("should log warn string with parameters", function () {
        logger.logWarn("test message %s %d", "string", 123);
        expect(logSpy.lastCall.args[0]).to.contain("test message string 123");
    });

    it("should log debug string with parameters", function () {
        logger.logDebug("test message %s %d", "string", 123);
        expect(logSpyErr.lastCall.args[0]).to.contain("test message string 123");
    });

    it("should log info complex types", function () {
        logger.logInfo({ "test": ["message"] });
        expect(logSpy.lastCall.args[0]).to.contain("test");
        expect(logSpy.lastCall.args[0]).to.contain("message");
    });

    it("should log warn complex types", function () {
        logger.logWarn({ "test": ["message"] });
        expect(logSpy.lastCall.args[0]).to.contain("test");
        expect(logSpy.lastCall.args[0]).to.contain("message");
    });

    it("should log debug complex types", function () {
        logger.logDebug({ "test": ["message"] });
        expect(logSpyErr.lastCall.args[0]).to.contain("test");
        expect(logSpyErr.lastCall.args[0]).to.contain("message");
    });

    it("should log info object with cyclic references", function () {
        const obj = { "test": "object" };
        obj["cycle"] = obj;
        logger.logInfo(obj);
        expect(logSpy.lastCall.args[0]).to.contain("test");
        expect(logSpy.lastCall.args[0]).to.contain("object");
    });

    it("should log warn object with cyclic references", function () {
        const obj = { "test": "object" };
        obj["cycle"] = obj;
        logger.logWarn(obj);
        expect(logSpy.lastCall.args[0]).to.contain("test");
        expect(logSpy.lastCall.args[0]).to.contain("object");
    });

    it("should log debug object with cyclic references", function () {
        const obj = { "test": "object" };
        obj["cycle"] = obj;
        logger.logDebug(obj);
        expect(logSpyErr.lastCall.args[0]).to.contain("test");
        expect(logSpyErr.lastCall.args[0]).to.contain("object");
    });
});