// tslint:disable:no-unused-expression
import * as chai from "chai";

import * as fse from "fs-extra";
import * as pathutils from "path";

import { ReadFSPlugin } from "../../src/assetchef-readfs/readfs";
import { ReadFSPluginInstance } from "../../src/assetchef-readfs/readfsinstance";
import { timeout } from "../../src/utils/timeout";
import { PathTreeSetup } from "../../test_utils/pathtreesetup";
import { plugintests } from "../../test_utils/plugintestsuite";
import { TmpFolder } from "../../test_utils/tmpfolder";

const tmpDirPath = TmpFolder.generate();
const testPath = pathutils.join(tmpDirPath, "readfstest");

plugintests("readfs", testPath, new ReadFSPlugin(), {
    simple: {
        config: {
            include: [pathutils.join("**", "*")],
            includeRootAsFile: true,
        },
        fsContentsBefore: PathTreeSetup.create({
            file: Buffer.from("content"),
            dir: {
                file2: Buffer.from("Content2"),
            },
        }),
        nodeContentsBefore: PathTreeSetup.create({
            filebefore: Buffer.from("contentbefore"),
        }),
        change1: {
            change: async (pluginInstance, testFSPath, prevNodeContents) => {return; },
            fsContentsAfter: null,
            nodeContentsAfter: PathTreeSetup.create({
                filebefore: Buffer.from("contentbefore"),
                file: Buffer.from("content"),
                dir: {
                    file2: Buffer.from("Content2"),
                },
            }),
        },
        change2: {
            change: async (pluginInstance, testFSPath, prevNodeContents) => {
                await fse.writeFile(pathutils.join(testFSPath, "newFile"), "newfileContent");
                prevNodeContents.set("newfilebefore", Buffer.from("new content before"));
            },
            fsContentsAfter: null,
            nodeContentsAfter: PathTreeSetup.create({
                filebefore: Buffer.from("contentbefore"),
                file: Buffer.from("content"),
                newfilebefore: Buffer.from("new content before"),
                newFile: Buffer.from("newfileContent"),
                dir: {
                    file2: Buffer.from("Content2"),
                },
            }),
        },
    },
    others: [
        {
            name: "exclude",
            config: {
                include: [pathutils.join("**", "*")],
                exclude: [pathutils.join("**", "excludedfile*")],
                includeRootAsFile: true,
            },
            fsContentsBefore: PathTreeSetup.create({
                file: Buffer.from("content"),
                dir: {
                    file2: Buffer.from("Content2"),
                },
                excludedfile1: Buffer.from("excludedcontent"),
            }),
            nodeContentsBefore: PathTreeSetup.create({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create({
                        filebefore: Buffer.from("contentbefore"),
                        file: Buffer.from("content"),
                        dir: {
                            file2: Buffer.from("Content2"),
                        },
                    }),
                },
            ],

        }, {

            name: "include only dir",
            config: {
                include: [pathutils.join("dir", "**", "*")],
                includeRootAsFile: true,
            },
            fsContentsBefore: PathTreeSetup.create({
                file: Buffer.from("content"),
                dir: {
                    file2: Buffer.from("Content2"),
                },
            }),
            nodeContentsBefore: PathTreeSetup.create({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create({
                        filebefore: Buffer.from("contentbefore"),
                        dir: {
                            file2: Buffer.from("Content2"),
                        },
                    }),
                },
            ],

        }, {

            name: "include only dir while creating other dir",
            config: {
                include: [pathutils.join("dir", "**", "*")],
                includeRootAsFile: true,
            },
            fsContentsBefore: PathTreeSetup.create({
                file: Buffer.from("content"),
            }),
            nodeContentsBefore: PathTreeSetup.create({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        await fse.mkdir (pathutils.join(testFSPath, "dir"));
                        await fse.writeFile(pathutils.join(testFSPath, "dir", "file"), "content");
                        await fse.mkdir (pathutils.join(testFSPath, "dir2"));
                        await fse.writeFile(pathutils.join(testFSPath, "dir2", "file"), "contentignored");
                     },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create({
                        filebefore: Buffer.from("contentbefore"),
                        dir: {
                            file: Buffer.from("content"),
                        },
                    }),
                },
            ],

        }, {

            name: "root is file",
            config: {
                include: [pathutils.join("**", "*")],
                includeRootAsFile: true,
            },
            fsContentsBefore: PathTreeSetup.create(Buffer.from("content")),
            nodeContentsBefore: PathTreeSetup.create({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create(Buffer.from("content")),
                },
            ],

        }, {

            name: "root deleted",
            config: {
                include: [pathutils.join("**", "*")],
                includeRootAsFile: true,
            },
            fsContentsBefore: PathTreeSetup.create({
                file: Buffer.from("content"),
                dir: {
                    file2: Buffer.from("Content2"),
                },
            }),
            nodeContentsBefore: PathTreeSetup.create({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        await fse.remove(testFSPath);
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create({
                        filebefore: Buffer.from("contentbefore"),
                    }),
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        await fse.mkdir(testFSPath);
                        await fse.writeFile(pathutils.join(testFSPath, "file"), "content");
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create({
                        filebefore: Buffer.from("contentbefore"),
                        file: Buffer.from("content"),
                    }),
                },
            ],

        }, {

            name: "file deleted while reading",
            config: {
                include: [pathutils.join("**", "*")],
                includeRootAsFile: true,
            },
            fsContentsBefore: PathTreeSetup.create({}),
            nodeContentsBefore: PathTreeSetup.create({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create({
                        filebefore: Buffer.from("contentbefore"),
                    }),
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        const filePath = pathutils.join(testFSPath, "file");
                        await fse.writeFile(filePath, "content");
                        const readFS = pluginInstance as ReadFSPluginInstance;
                        readFS._syncActionForTestingBeforeFileRead = async () => {
                            await fse.remove(filePath);
                            await timeout(500);
                        };
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create({
                        filebefore: Buffer.from("contentbefore"),
                    }),
                },
            ],

        }, {

            name: "dir deleted while reading",
            config: {
                include: [pathutils.join("**", "*")],
                includeRootAsFile: true,
            },
            fsContentsBefore: PathTreeSetup.create({
                file: Buffer.from("content"),
            }),
            nodeContentsBefore: PathTreeSetup.create({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create({
                        file: Buffer.from("content"),
                        filebefore: Buffer.from("contentbefore"),
                    }),
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        const dirPath = pathutils.join(testFSPath, "dir");
                        await fse.mkdir(dirPath);
                        await fse.writeFile(pathutils.join(dirPath, "file"), "newfile");
                        const readFS = pluginInstance as ReadFSPluginInstance;
                        readFS._syncActionForTestingBeforeDirRead = async () => {
                            await fse.remove(dirPath);
                            await timeout(500);
                        };
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create({
                        file: Buffer.from("content"),
                        filebefore: Buffer.from("contentbefore"),
                    }),
                },
            ],

        }, {

            name: "dir deleted while stat",
            config: {
                include: [pathutils.join("**", "*")],
                includeRootAsFile: true,
            },
            fsContentsBefore: PathTreeSetup.create({
                file: Buffer.from("content"),
            }),
            nodeContentsBefore: PathTreeSetup.create({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create({
                        file: Buffer.from("content"),
                        filebefore: Buffer.from("contentbefore"),
                    }),
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        const dirPath = pathutils.join(testFSPath, "dir");
                        await fse.mkdir(dirPath);
                        await fse.writeFile(pathutils.join(dirPath, "file"), "newfile");
                        const readFS = pluginInstance as ReadFSPluginInstance;
                        readFS._syncActionForTestingBeforeStat = async () => {
                            await fse.remove(dirPath);
                            await timeout(500);
                        };
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create({
                        file: Buffer.from("content"),
                        filebefore: Buffer.from("contentbefore"),
                    }),
                },
            ],

        }, {

            name: "root dir deleted and reset test",
            config: {
                include: [pathutils.join("**", "*")],
                includeRootAsFile: true,
            },
            fsContentsBefore: PathTreeSetup.create({
                file: Buffer.from("content"),
            }),
            nodeContentsBefore: PathTreeSetup.create({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create({
                        file: Buffer.from("content"),
                        filebefore: Buffer.from("contentbefore"),
                    }),
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        await fse.remove(testFSPath);
                        pluginInstance.reset();
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create({
                        filebefore: Buffer.from("contentbefore"),
                    }),
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        await fse.mkdir(testFSPath);
                        await fse.writeFile(pathutils.join(testFSPath, "file"), "newfile");
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create({
                        file: Buffer.from("newfile"),
                        filebefore: Buffer.from("contentbefore"),
                    }),
                },
            ],

        }, {

            name: "root file deleted and reset test",
            config: {
                include: [pathutils.join("**", "*")],
                includeRootAsFile: true,
            },
            fsContentsBefore: PathTreeSetup.create(Buffer.from("content")),
            nodeContentsBefore: PathTreeSetup.create({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create(Buffer.from("content")),
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        await fse.remove(testFSPath);
                        pluginInstance.reset();
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create({
                        filebefore: Buffer.from("contentbefore"),
                    }),
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        await fse.mkdir(testFSPath);
                        await fse.writeFile(pathutils.join(testFSPath, "file"), "newfile");
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create({
                        file: Buffer.from("newfile"),
                        filebefore: Buffer.from("contentbefore"),
                    }),
                },
            ],

        }, {

            name: "root file now dir with reset test",
            config: {
                include: [pathutils.join("**", "*")],
                includeRootAsFile: true,
            },
            fsContentsBefore: PathTreeSetup.create(Buffer.from("content")),
            nodeContentsBefore: PathTreeSetup.create({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create(Buffer.from("content")),
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        await fse.remove(testFSPath);
                        await fse.mkdir(testFSPath);
                        await fse.writeFile(pathutils.join(testFSPath, "file"), "newfile");
                        pluginInstance.reset();
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create({
                        file: Buffer.from("newfile"),
                        filebefore: Buffer.from("contentbefore"),
                    }),
                },
            ],

        }, {

            name: "root dir now file with reset test",
            config: {
                include: [pathutils.join("**", "*")],
                includeRootAsFile: true,
            },
            fsContentsBefore: PathTreeSetup.create({
                file: Buffer.from("content"),
            }),
            nodeContentsBefore: PathTreeSetup.create({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create({
                        file: Buffer.from("content"),
                        filebefore: Buffer.from("contentbefore"),
                    }),
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        await fse.remove(testFSPath);
                        await fse.writeFile(testFSPath, "newfile");
                        pluginInstance.reset();
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTreeSetup.create(Buffer.from("newfile")),
                },
            ],

        },
    ],
});
