"use strict";
/* eslint-env node, mocha */

var assetchef = require("../index");

describe("assetchef", function() {
    it("should load recipe", function() {
        assetchef.loadRecipe({});
    });

    it("should cook", function() {
        assetchef.loadRecipe({});
        assetchef.cook();
    });
});