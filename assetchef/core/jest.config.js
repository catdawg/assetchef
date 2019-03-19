module.exports = {
    preset: 'ts-jest',
    setupTestFrameworkScriptFile: "jest-extended",
    moduleFileExtensions: [
        "ts",
        "js",
        "json"
    ],
    transform: {
        "^.+\\.(ts|tsx)$": "ts-jest"
    },
    testMatch: [
        "<rootDir>/test/**/*.test.(ts)"
    ],
    testEnvironment: "node",
    collectCoverageFrom: [
        "<rootDir>/src/**/*.(ts)",
        "!<rootDir>/src/index.ts",
        "!<rootDir>/src/**/*.d.ts",
        "!<rootDir>/src/**/*_fork.ts",
        "!<rootDir>/src/testutils/**/*.ts"
    ]
};