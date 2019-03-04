const pluginapi = require("@assetchef/pluginapi");

const getOutofDatePlugin = () => {

    return {
        apiLevel: -1, // out of date part
        configSchema: {
            properties: {
                prefix: {
                    type: "string",
                },
            },
            additionalProperties: false,
            required: ["prefix"],
        },
        createInstance: () => {
            return null;
        }
    };
};

module.exports = getOutofDatePlugin();