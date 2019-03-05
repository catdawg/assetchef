// tslint:disable:no-unused-expression
import * as chai from "chai";

import * as fse from "fs-extra";
import * as pathutils from "path";

import { PathTree, plugintests, timeout, TmpFolder } from "@assetchef/pluginapi";

import { ReadFSPlugin } from "../src/readfs";
import { ReadFSPluginInstance } from "../src/readfsinstance";

const tmpDirPath = TmpFolder.generate();
const testPath = pathutils.join(tmpDirPath, "readfstest");

plugintests("readfs", testPath, new ReadFSPlugin(), {
    simple: {
        config: {
            include: [pathutils.join("**", "*")],
            includeRootAsFile: true,
        },
        fsContentsBefore: PathTree.bufferTreeFrom({
            file: Buffer.from("content"),
            dir: {
                file2: Buffer.from("Content2"),
            },
        }),
        nodeContentsBefore: PathTree.bufferTreeFrom({
            filebefore: Buffer.from("contentbefore"),
        }),
        change1: {
            change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
            fsContentsAfter: null,
            nodeContentsAfter: PathTree.bufferTreeFrom({
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
            nodeContentsAfter: PathTree.bufferTreeFrom({
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
            fsContentsBefore: PathTree.bufferTreeFrom({
                file: Buffer.from("content"),
                dir: {
                    file2: Buffer.from("Content2"),
                },
                excludedfile1: Buffer.from("excludedcontent"),
            }),
            nodeContentsBefore: PathTree.bufferTreeFrom({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom({
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
                exclude: [pathutils.join("**", "excluded")],
                includeRootAsFile: true,
            },
            fsContentsBefore: PathTree.bufferTreeFrom({
                file: Buffer.from("content"),
                dir: {
                    file2: Buffer.from("Content2"),
                },
            }),
            nodeContentsBefore: PathTree.bufferTreeFrom({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom({
                        filebefore: Buffer.from("contentbefore"),
                        dir: {
                            file2: Buffer.from("Content2"),
                        },
                    }),
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        await fse.writeFile(pathutils.join(testFSPath, "excluded"), Buffer.from("excluded"));
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom({
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
            fsContentsBefore: PathTree.bufferTreeFrom({
                file: Buffer.from("content"),
            }),
            nodeContentsBefore: PathTree.bufferTreeFrom({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        await fse.mkdir(pathutils.join(testFSPath, "dir"));
                        await fse.writeFile(pathutils.join(testFSPath, "dir", "file"), "content");
                        await fse.mkdir(pathutils.join(testFSPath, "dir2"));
                        await fse.writeFile(pathutils.join(testFSPath, "dir2", "file"), "contentignored");
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom({
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
            fsContentsBefore: PathTree.bufferTreeFrom(Buffer.from("content")),
            nodeContentsBefore: PathTree.bufferTreeFrom({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom(Buffer.from("content")),
                },
            ],

        }, {

            name: "root deleted",
            config: {
                include: [pathutils.join("**", "*")],
                includeRootAsFile: true,
            },
            fsContentsBefore: PathTree.bufferTreeFrom({
                file: Buffer.from("content"),
                dir: {
                    file2: Buffer.from("Content2"),
                },
            }),
            nodeContentsBefore: PathTree.bufferTreeFrom({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        await fse.remove(testFSPath);
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom({
                        filebefore: Buffer.from("contentbefore"),
                    }),
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        await fse.mkdir(testFSPath);
                        await fse.writeFile(pathutils.join(testFSPath, "file"), "content");
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom({
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
            fsContentsBefore: PathTree.bufferTreeFrom({}),
            nodeContentsBefore: PathTree.bufferTreeFrom({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom({
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
                    nodeContentsAfter: PathTree.bufferTreeFrom({
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
            fsContentsBefore: PathTree.bufferTreeFrom({
                file: Buffer.from("content"),
            }),
            nodeContentsBefore: PathTree.bufferTreeFrom({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom({
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
                    nodeContentsAfter: PathTree.bufferTreeFrom({
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
            fsContentsBefore: PathTree.bufferTreeFrom({
                file: Buffer.from("content"),
            }),
            nodeContentsBefore: PathTree.bufferTreeFrom({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom({
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
                    nodeContentsAfter: PathTree.bufferTreeFrom({
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
            fsContentsBefore: PathTree.bufferTreeFrom({
                file: Buffer.from("content"),
            }),
            nodeContentsBefore: PathTree.bufferTreeFrom({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom({
                        file: Buffer.from("content"),
                        filebefore: Buffer.from("contentbefore"),
                    }),
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        await fse.remove(testFSPath);
                        await pluginInstance.reset();
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom({
                        filebefore: Buffer.from("contentbefore"),
                    }),
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        await fse.mkdir(testFSPath);
                        await fse.writeFile(pathutils.join(testFSPath, "file"), "newfile");
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom({
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
            fsContentsBefore: PathTree.bufferTreeFrom(Buffer.from("content")),
            nodeContentsBefore: PathTree.bufferTreeFrom({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom(Buffer.from("content")),
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        await fse.remove(testFSPath);
                        await pluginInstance.reset();
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom({
                        filebefore: Buffer.from("contentbefore"),
                    }),
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        await fse.mkdir(testFSPath);
                        await fse.writeFile(pathutils.join(testFSPath, "file"), "newfile");
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom({
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
            fsContentsBefore: PathTree.bufferTreeFrom(Buffer.from("content")),
            nodeContentsBefore: PathTree.bufferTreeFrom({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom(Buffer.from("content")),
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        await fse.remove(testFSPath);
                        await timeout(500);
                        await fse.mkdir(testFSPath);
                        await fse.writeFile(pathutils.join(testFSPath, "file"), "newfile");
                        await pluginInstance.reset();
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom({
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
            fsContentsBefore: PathTree.bufferTreeFrom({
                file: Buffer.from("content"),
            }),
            nodeContentsBefore: PathTree.bufferTreeFrom({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom({
                        file: Buffer.from("content"),
                        filebefore: Buffer.from("contentbefore"),
                    }),
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        await fse.remove(testFSPath);
                        await timeout(500);
                        await fse.writeFile(testFSPath, "newfile");
                        await pluginInstance.reset();
                    },
                    fsContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom(Buffer.from("newfile")),
                },
            ],

        },
    ],
});
