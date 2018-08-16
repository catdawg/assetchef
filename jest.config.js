module.exports = {
    globals: {
        "ts-jest": {
            skipBabel: true
        }
    },
    moduleFileExtensions: [
        "ts",
        "js"
    ],
    transform: {
        "^.+\\.(ts|tsx)$": "ts-jest"
    },
    testMatch: [
        "<rootDir>/test/**/*.test.(ts)"
    ],
    testEnvironment: "node",
    modulePaths: [
        "<rootDir>/src"
    ]
};