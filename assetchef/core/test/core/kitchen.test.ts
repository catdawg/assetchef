import * as fse from "fs-extra";

import { ASSETCHEF_CONFIG_FILE, ASSETCHEF_FOLDER_NAME, ASSETCHEF_FOLDER_VERSION_FILE } from "../../src/core/defines";
import { Kitchen, SetupErrorKind } from "../../src/core/kitchen";
import { NodePackageHelper } from "../../src/nodepackagehelper";
import { PathUtils } from "../../src/path/pathutils";
import { TmpFolder } from "../../src/testutils/tmpfolder";
import { winstonlogger } from "../../src/testutils/winstonlogger";

jest.setTimeout(20000);

describe("kitchen", () => {

    let tmpDirPath: string;
    let configPath: string;
    const printingPluginPath =
        PathUtils.resolve(__dirname, PathUtils.join("..", "..", "test_libs", "printingplugin"));
    const brokenSchemaPluginPath =
        PathUtils.resolve(__dirname, PathUtils.join("..", "..", "test_libs", "brokenschemaplugin"));
    const nullPluginPath =
        PathUtils.resolve(__dirname, PathUtils.join("..", "..", "test_libs", "nullplugin"));
    const outofdatePluginPath =
        PathUtils.resolve(__dirname, PathUtils.join("..", "..", "test_libs", "outofdateplugin"));

    beforeEach(async () => {
        tmpDirPath = TmpFolder.generate();
        configPath = PathUtils.join(tmpDirPath, ASSETCHEF_CONFIG_FILE);

        winstonlogger.logInfo("using %s", configPath);
    });

    it("doesn't exist", async () => {
        const res = await Kitchen.setup(winstonlogger, "asdasdasd");

        expect(res.error).toEqual(SetupErrorKind.ConfigNotFound);
    });

    it("is not json", async () => {
        await fse.writeFile(configPath, "{");
        const res = await Kitchen.setup(winstonlogger, configPath);

        expect(res.error).toEqual(SetupErrorKind.ConfigNotJson);
    });

    it("is directory", async () => {
        await fse.mkdir(configPath);
        const res = await Kitchen.setup(winstonlogger, configPath);

        expect(res.error).toEqual(SetupErrorKind.FailedToReadConfig);
    });

    it("format not valid", async () => {
        await fse.writeFile(configPath, "{\"a\":1}");
        const res = await Kitchen.setup(winstonlogger, configPath);

        expect(res.error).toEqual(SetupErrorKind.BaseStructureInvalid);
    });

    it("empty should work", async () => {
        const config = {
            dependencies: {},
            peerDependencies: {},
            roots: [] as object[],
        };
        await fse.writeFile(configPath, JSON.stringify(config));
        const res = await Kitchen.setup(winstonlogger, configPath);

        expect(res.error).toEqual(SetupErrorKind.None);
    });

    it("working folder already there", async () => {
        const config = {
            dependencies: {},
            peerDependencies: {},
            roots: [] as object[],
        };
        await fse.writeFile(configPath, JSON.stringify(config));
        await Kitchen.setup(winstonlogger, configPath); // makes the working folder

        const res = await Kitchen.setup(winstonlogger, configPath);
        expect(res.error).toEqual(SetupErrorKind.None);
    });

    it("working folder failure", async () => {
        const config = {
            dependencies: {},
            peerDependencies: {},
            roots: [] as object[],
        };
        await fse.writeFile(configPath, JSON.stringify(config));
        await fse.writeFile(PathUtils.join(tmpDirPath, ASSETCHEF_FOLDER_NAME), "content");
        const res = await Kitchen.setup(winstonlogger, configPath); // makes the working folder
        expect(res.error).toEqual(SetupErrorKind.FailedToSetupWorkingFolder);

    });
    it("working folder out of date", async () => {
        const config = {
            dependencies: {},
            peerDependencies: {},
            roots: [] as object[],
        };
        await fse.writeFile(configPath, JSON.stringify(config));
        await Kitchen.setup(winstonlogger, configPath); // makes the working folder

        await fse.writeFile(
            PathUtils.join(tmpDirPath, ASSETCHEF_FOLDER_NAME, ASSETCHEF_FOLDER_VERSION_FILE), "-1");

        const testFile = PathUtils.join(tmpDirPath, ASSETCHEF_FOLDER_NAME, "otherfiletoconfirm");
        await fse.writeFile(testFile, "confirm");

        const res = await Kitchen.setup(winstonlogger, configPath); // should still work
        expect(res.error).toEqual(SetupErrorKind.None);

        expect(fse.existsSync(testFile)).toBeFalse();
    });
    it("dependency doesn't exist", async () => {
        const config = {
            dependencies: {doesntexist: "1.0.0"},
            peerDependencies: {},
            roots: [] as object[],
        };
        await fse.writeFile(configPath, JSON.stringify(config));
        const res = await Kitchen.setup(winstonlogger, configPath);

        expect(res.error).toEqual(SetupErrorKind.PluginsFailedToInstall);
    });

    it("one peer dependency setup", async () => {
        const config = {
            dependencies: {},
            peerDependencies: {printingplugin: "1.0.0"},
            roots: [] as object[],
        };
        await fse.writeFile(configPath, JSON.stringify(config));

        expect(await NodePackageHelper.install(winstonlogger, tmpDirPath, {
           printingplugin: "file:" + printingPluginPath,
        })).toBeTrue();

        const res = await Kitchen.setup(winstonlogger, configPath);

        expect(res.error).toEqual(SetupErrorKind.None);
    }, 9999999);

    it("broken schema setup", async () => {
        const config = {
            dependencies: {brokenschemaplugin: "file:" + brokenSchemaPluginPath},
            peerDependencies: {},
            roots: [] as object[],
        };
        await fse.writeFile(configPath, JSON.stringify(config));

        const res = await Kitchen.setup(winstonlogger, configPath);

        expect(res.error).toEqual(SetupErrorKind.FullStructureInvalid);
    }, 9999999);

    it("broken config setup", async () => {
        const config = {
            dependencies: {printingplugin: "file:" + printingPluginPath},
            peerDependencies: {},
            roots: [
                {
                    printingplugin: {
                        config: {
                            prefixNot: "something", // broken part
                        },
                        next: [],
                    },
                },
            ] as object[],
        };
        await fse.writeFile(configPath, JSON.stringify(config));

        const res = await Kitchen.setup(winstonlogger, configPath);

        expect(res.error).toEqual(SetupErrorKind.FullStructureInvalid);
    }, 9999999);

    it("missing plugin setup", async () => {
        const config = {
            dependencies: {},
            peerDependencies: {unknownplugin: "1.0.0"},
            roots: [] as object[],
        };
        await fse.writeFile(configPath, JSON.stringify(config));

        const res = await Kitchen.setup(winstonlogger, configPath);

        expect(res.error).toEqual(SetupErrorKind.MissingPlugins);
    }, 9999999);

    it("null plugin setup", async () => {
        const config = {
            dependencies: {nullplugin: "file:" + nullPluginPath},
            peerDependencies: {},
            roots: [] as object[],
        };
        await fse.writeFile(configPath, JSON.stringify(config));

        const res = await Kitchen.setup(winstonlogger, configPath);

        expect(res.error).toEqual(SetupErrorKind.MissingPlugins);
    }, 9999999);

    it("outofdate plugin setup", async () => {
        const config = {
            dependencies: {outofdateplugin: "file:" + outofdatePluginPath},
            peerDependencies: {},
            roots: [] as object[],
        };
        await fse.writeFile(configPath, JSON.stringify(config));

        const res = await Kitchen.setup(winstonlogger, configPath);

        expect(res.error).toEqual(SetupErrorKind.PluginIncompatible);
    }, 9999999);
});
