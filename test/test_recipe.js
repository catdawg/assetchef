"use strict";
/* eslint-env node, mocha */

var chai = require("chai");
var expect = chai.expect;

var recipe = require("../recipe");

const simpleRecipe = {
    "steps": [
        {
            "assetchef-simple": {
                "version": "1.0.0",
                "options": ""
            }
        }, {
            "assetchef-simple2": {
                "version": "1.0.0"
            }
        }
    ]
};

const recipeMissingSteps = {
};

const recipeWithSomethingOtherThanSteps = {
    "steps": [
        {
            "assetchef-simple": {
                "version": "1.0.0",
                "somethingElse": "Asdasd"
            }
        }
    ]
};

const recipeWithInvalidStepsArray = {
    "steps": "asd"
};

const recipeWithStepHavingExtraThings = {
    "steps": [
        {
            "assetchef-simple": {
                "version": "1.0.0",
                "somethingElse": "Asdasd"
            }
        }
    ]
};
const recipeWithStepMissingVersion = {
    "steps": [
        {
            "assetchef-simple": {
            }
        }
    ]
};

chai.use(function (_chai, utils) {

    utils.addProperty(chai.Assertion.prototype, "invalidRecipeBaseStructure", function () {
        var obj = utils.flag(this, "object");
        var result = recipe.validateBaseRecipeStructure(obj);
        new _chai.Assertion(result.valid).to.be.false;
        new _chai.Assertion(result.errors).to.be.an("array").that.is.not.empty;
    });
});

chai.use(function (_chai, utils) {

    utils.addProperty(chai.Assertion.prototype, "validRecipeBaseStructure", function () {
        var obj = utils.flag(this, "object");
        var result = recipe.validateBaseRecipeStructure(obj);
        new _chai.Assertion(result.valid).to.be.true;
    });
});

describe("recipe", function () {
    it("should validate base recipe structure", function () {
        expect(simpleRecipe).to.be.validRecipeBaseStructure;
    });
    it("should not validate invalid base recipe structures", function () {
        expect(recipeMissingSteps).to.be.invalidRecipeBaseStructure;
        expect(recipeWithSomethingOtherThanSteps).to.be.invalidRecipeBaseStructure;
        expect(recipeWithInvalidStepsArray).to.be.invalidRecipeBaseStructure;
        expect(recipeWithStepHavingExtraThings).to.be.invalidRecipeBaseStructure;
        expect(recipeWithStepMissingVersion).to.be.invalidRecipeBaseStructure;
    });
});