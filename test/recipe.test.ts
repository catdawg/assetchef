// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;
import { VError } from "verror";

import * as recipe from "../src/recipe";

const simpleRecipe = {
    steps: [
        {
            "assetchef-textsplitter": {
                splits: {
                    _1x: 0.20,
                    _2x: 0.40,
                    _3x: 0.60,
                    _4x: 0.80,
                    _5x: 1.00,
                },
            },
        },
    ],
};

const recipeMissingSteps = {
};

const recipeWithSomethingOtherThanSteps = {
    stepz: [],
};

const recipeWithInvalidStepsArray = {
    steps: "asd",
};

const recipeWithStepNotHavingObject = {
    steps: [
        {
            "assetchef-textsplitter": "lol",
        },
    ],
};

const recipeWithUnknownPlugin = {
    steps: [
        {
            something: {},
        },
    ],
};

const recipeWithBrokenPluginOptions = {
    steps: [
        {
            "assetchef-textsplitter": {
                splits: "lol",
            },
        },
    ],
};

function expectValidBaseRecipeStructure(obj) {
    const result = recipe.validateBaseRecipeStructure(obj);
    expect(result.valid).to.be.true;
}

function expectInvalidBaseRecipeStructure(obj) {
    const result = recipe.validateBaseRecipeStructure(obj);
    expect(result.valid).to.be.false;
    expect(result.errors).to.be.an("array").that.is.not.empty;
}

function expectValidRecipePlugins(obj) {
    const result = recipe.validatePlugins(obj);
    expect(result.valid).to.be.true;
}

function expectInvalidRecipePlugins(obj) {
    const result = recipe.validatePlugins(obj);
    expect(result.valid).to.be.false;
    expect(result.missingPlugins).to.be.an("array").that.is.not.empty;
}

function expectValidRecipePluginConfigs(obj) {
    const result = recipe.validatePluginsRecipeStructure(obj);
    expect(result.valid).to.be.true;
}

function expectInvalidRecipePluginConfigs(obj) {
    const result = recipe.validatePluginsRecipeStructure(obj);
    expect(result.valid).to.be.false;
    expect(result.errors).to.be.an("array").that.is.not.empty;
}

describe("recipe", () => {
    it("should validate base recipe structure", () => {
        expectValidBaseRecipeStructure(simpleRecipe);
    });
    it("should not validate invalid base recipe structures", () => {
        expect(recipe.validateBaseRecipeStructure).to.throw(VError);
        expectInvalidBaseRecipeStructure(recipeMissingSteps);
        expectInvalidBaseRecipeStructure(recipeWithSomethingOtherThanSteps);
        expectInvalidBaseRecipeStructure(recipeWithInvalidStepsArray);
        expectInvalidBaseRecipeStructure(recipeWithStepNotHavingObject);
    });
    it("should be able to load plugins", () => {
        expect(recipe.validatePlugins).to.throw(VError);
        expectValidRecipePlugins(simpleRecipe);
        expectInvalidRecipePlugins(recipeWithUnknownPlugin);
    });

    it("should be able to validate plugins' options", () => {
        expect(recipe.validatePluginsRecipeStructure).to.throw(VError);
        expectValidRecipePluginConfigs(simpleRecipe);
        expectInvalidRecipePluginConfigs(recipeWithBrokenPluginOptions);
    });
});
