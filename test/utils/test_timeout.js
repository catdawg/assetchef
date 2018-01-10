"use strict";
/* eslint-env mocha */

const expect = require("chai").expect;

const timeout = require("../../lib/utils/timeout");


describe("timeout", function () {
    
    it("test delay", async function () {
        const timeBefore = Date.now();
        await timeout(1000);
        const timeAfter = Date.now();

        expect(timeAfter - timeBefore).to.be.approximately(1000, 100); 
    });
});