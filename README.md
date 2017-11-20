[![Build Status](https://travis-ci.org/catdawg/assetchef.svg?branch=master)](https://travis-ci.org/catdawg/assetchef)
[![Coverage Status](https://coveralls.io/repos/github/catdawg/assetchef/badge.svg?branch=master)](https://coveralls.io/github/catdawg/assetchef?branch=master)

Asset Chef
=========

A library for processing assets through a configurable pipeline. The pipeline is configured by a recipe.json file. The recipe configures a sequence of modules that are executed on assets. Each module is a separate library. Examples of possible libraries are: A downscaler for pngs, a atlas packer, a aws uploader, a json to binary converter.

## Installation

  `npm install @catdawg/assetchef`

## Usage

  This library is still in a very initial stage, but the very basic usage will look like this:

    var assetchef = require('@catdawg/assetchef');

    assetchef.loadRecipe("recipe.json");
    assetchef.cook();

  The idea is to also integrate this library into a running app, so it can be watching a directory, and we can run the assetchef only on files that change.
  
## Roadmap

 - Recipe Loading (In Progress)
  - Validate JSON
  - Resolve Dependencies
 - Recipe Step
  - Define Structure
  - Make recipe loading validate step options section dynamically.
 - ... many other things

## Tests

  `npm test`