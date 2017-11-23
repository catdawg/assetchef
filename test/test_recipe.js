"use strict";
/* eslint-env mocha */

const chai = require("chai");
const expect = chai.expect;
const VError = require("verror").VError;

const recipe = require("../lib/recipe");

const simpleRecipe = {
    "steps": [
        {
            "assetchef-textsplitter": {
                "splits": {
                    "_1x": 0.20,
                    "_2x": 0.40,
                    "_3x": 0.60,
                    "_4x": 0.80,
                    "_5x": 1.00
                }
            }
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
            "assetchef-textsplitter": "lol"
        }
    ]
};

const recipeWithUnknownPlugin = {
    "steps": [
        {
            "something": {}
        }
    ]
};

const recipeWithBrokenPluginOptions = {
    "steps": [
        {
            "assetchef-textsplitter": {
                "splits": "lol"
            }
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

    utils.addProperty(chai.Assertion.prototype, "validRecipePlugins", function () {
        const obj = utils.flag(this, "object");
        const result = recipe.validatePlugins(obj);
        new _chai.Assertion(result.valid).to.be.true;
    });

    utils.addProperty(chai.Assertion.prototype, "invalidRecipePlugins", function () {
        const obj = utils.flag(this, "object");
        const result = recipe.validatePlugins(obj);
        new _chai.Assertion(result.valid).to.be.false;
        new _chai.Assertion(result.missingPlugins).to.be.an("array").that.is.not.empty;
    });

    utils.addProperty(chai.Assertion.prototype, "validRecipePluginConfigs", function () {
        const obj = utils.flag(this, "object");
        const result = recipe.validatePluginsRecipeStructure(obj);
        new _chai.Assertion(result.valid).to.be.true;
    });

    utils.addProperty(chai.Assertion.prototype, "invalidRecipePluginConfigs", function () {
        const obj = utils.flag(this, "object");
        const result = recipe.validatePluginsRecipeStructure(obj);
        new _chai.Assertion(result.valid).to.be.false;
        new _chai.Assertion(result.errors).to.be.an("array").that.is.not.empty;
    });
});

describe("recipe", function () {
    it("should validate base recipe structure", function () {
        expect(simpleRecipe).to.be.validRecipeBaseStructure;
    });
    it("should not validate invalid base recipe structures", function () {
        expect(recipe.validateBaseRecipeStructure).to.throw(VError);
        expect(recipeMissingSteps).to.be.invalidRecipeBaseStructure;
        expect(recipeWithSomethingOtherThanSteps).to.be.invalidRecipeBaseStructure;
        expect(recipeWithInvalidStepsArray).to.be.invalidRecipeBaseStructure;
        expect(recipeWithStepNotHavingObject).to.be.invalidRecipeBaseStructure;
    });
    it("should be able to load plugins", function () {
        expect(recipe.validatePlugins).to.throw(VError);
        expect(simpleRecipe).to.be.validRecipePlugins;
        expect(recipeWithUnknownPlugin).to.be.invalidRecipePlugins;
    });

    it("should be able to validate plugins' options", function () {
        expect(recipe.validatePluginsRecipeStructure).to.throw(VError);
        expect(simpleRecipe).to.be.validRecipePluginConfigs;
        expect(recipeWithBrokenPluginOptions).to.be.invalidRecipePluginConfigs;
    });
});