const pluginapi = require("@assetchef/pluginapi");

const getBrokenSchemaPlugin = () => {

    return {
        apiLevel: 1,
        configSchema: {
            properties: {
                prefix: {
                    type: "string",
                },
            },
            additionalProperties: false,
            required: 1, // borken part
        },
        createInstance: () => {
            return null;
        },
    };
};

module.exports = getBrokenSchemaPlugin(true);