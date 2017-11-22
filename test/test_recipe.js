"use strict";
/* eslint-env node, mocha */

const chai = require("chai");
const expect = chai.expect;
const VError = require("verror").VError;

const recipe = require("../recipe");

const simpleRecipe = {
    "steps": [
        {
            "assetchef-simple": {}
        }
    ]
};

const recipeMissingSteps = {
};

const recipeWithSomethingOtherThanSteps = {
    "stepz": []
};

const recipeWithInvalidStepsArray = {
    "steps": "asd"
};

const recipeWithStepNotHavingObject = {
    "steps": [
        {
            "assetchef-simple": "lol"
        }
    ]
};

const recipeWithUnknownDependency = {
    "steps": [
        {
            "something": {}
        }
    ]
};

chai.use(function (_chai, utils) {

    utils.addProperty(chai.Assertion.prototype, "invalidRecipeBaseStructure", function () {
        const obj = utils.flag(this, "object");
        const result = recipe.validateBaseRecipeStructure(obj);
        new _chai.Assertion(result.valid).to.be.false;
        new _chai.Assertion(result.errors).to.be.an("array").that.is.not.empty;
    });

    utils.addProperty(chai.Assertion.prototype, "validRecipeBaseStructure", function () {
        const obj = utils.flag(this, "object");
        const result = recipe.validateBaseRecipeStructure(obj);
        new _chai.Assertion(result.valid).to.be.true;
    });

    utils.addProperty(chai.Assertion.prototype, "validRecipeDependencies", function () {
        const obj = utils.flag(this, "object");
        const result = recipe.validateDependencies(obj);
        new _chai.Assertion(result.valid).to.be.true;
    });

    utils.addProperty(chai.Assertion.prototype, "invalidRecipeDependencies", function () {
        const obj = utils.flag(this, "object");
        const result = recipe.validateDependencies(obj);
        new _chai.Assertion(result.valid).to.be.false;
        new _chai.Assertion(result.missingDependencies).to.be.an("array").that.is.not.empty;
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
        expect(recipeWithStepNotHavingObject).to.be.invalidRecipeBaseStructure;
    });
    it("should be able to load dependencies", function () {
        expect(recipe.validateDependencies).to.throw(VError);
        expect(simpleRecipe).to.be.validRecipeDependencies;
        expect(recipeWithUnknownDependency).to.be.invalidRecipeDependencies;
    });
});