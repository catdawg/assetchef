// tslint:disable:no-unused-expression
import * as chai from "chai";

import * as fse from "fs-extra";

import { PathTree, PathUtils, plugintests, timeout, TmpFolder } from "@assetchef/pluginapi";

import { ReadFSPlugin } from "../src/readfs";
import { ReadFSPluginInstance } from "../src/readfsinstance";

const tmpDirPath = TmpFolder.generate();
const testPath = PathUtils.join(tmpDirPath, "readfstest");

plugintests("readfs", testPath, new ReadFSPlugin(), {
    simple: {
        config: {
            path: "dir",
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
                file2: Buffer.from("Content2"),
            }),
        },
        change2: {
            change: async (pluginInstance, testFSPath, prevNodeContents) => {
                await fse.writeFile(PathUtils.join(testFSPath, "dir", "newFile"), "newfileContent");
                prevNodeContents.set("newfilebefore", Buffer.from("new content before"));
            },
            fsContentsAfter: null,
            nodeContentsAfter: PathTree.bufferTreeFrom({
                filebefore: Buffer.from("contentbefore"),
                newfilebefore: Buffer.from("new content before"),
                newFile: Buffer.from("newfileContent"),
                file2: Buffer.from("Content2"),
            }),
        },
    },
    others: [
        {
            name: "exclude",
            config: {
                exclude: [PathUtils.join("**", "excludedfile*")],
                path: "",
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
                include: [PathUtils.join("dir", "**", "*")],
                exclude: [PathUtils.join("**", "excluded")],
                path: "",
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
                        await fse.writeFile(PathUtils.join(testFSPath, "excluded"), Buffer.from("excluded"));
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
                include: [PathUtils.join("dir", "**", "*")],
                path: "",
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
                        await fse.mkdir(PathUtils.join(testFSPath, "dir"));
                        await fse.writeFile(PathUtils.join(testFSPath, "dir", "file"), "content");
                        await fse.mkdir(PathUtils.join(testFSPath, "dir2"));
                        await fse.writeFile(PathUtils.join(testFSPath, "dir2", "file"), "contentignored");
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
                path: "",
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
                path: "",
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
                        await fse.writeFile(PathUtils.join(testFSPath, "file"), "content");
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
                path: "",
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
                        const filePath = PathUtils.join(testFSPath, "file");
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
                path: "",
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
                        const dirPath = PathUtils.join(testFSPath, "dir");
                        await fse.mkdir(dirPath);
                        await fse.writeFile(PathUtils.join(dirPath, "file"), "newfile");
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
                path: "",
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
                        const dirPath = PathUtils.join(testFSPath, "dir");
                        await fse.mkdir(dirPath);
                        await fse.writeFile(PathUtils.join(dirPath, "file"), "newfile");
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
                path: "",
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
                        await fse.writeFile(PathUtils.join(testFSPath, "file"), "newfile");
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
                path: "",
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
                        await fse.writeFile(PathUtils.join(testFSPath, "file"), "newfile");
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
                path: "",
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
                        await fse.writeFile(PathUtils.join(testFSPath, "file"), "newfile");
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
                path: "",
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
