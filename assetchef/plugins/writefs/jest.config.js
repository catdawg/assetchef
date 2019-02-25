module.exports = {
    moduleFileExtensions: [
        "ts",
        "js",
        "json"
    ],
    transform: {
        "^.+\\.(ts|tsx)$": "ts-jest"
    },
    testMatch: [
        "**/test/**/*.test.(ts)"
    ],
    testEnvironment: "node",
    collectCoverageFrom: [
        "**/src/**/*.(ts)",
        "!**/src/index.ts",
        "!**/src/**/*.d.ts",
        "!**/src/**/*_fork.ts"
    ]
};