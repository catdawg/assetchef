'use strict';

var expect = require('chai').expect;
var assetchef = require('../index');

describe('assetchef', function() {
    it('should load recipe', function() {
        assetchef.loadRecipe({});
    });

    it('should cook', function() {
        assetchef.loadRecipe({});
        assetchef.cook();
    });
});