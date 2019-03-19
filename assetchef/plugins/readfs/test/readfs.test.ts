// tslint:disable:no-unused-expression
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
                dir: {
                    file2: Buffer.from("Content2"),
                },
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
                dir: {
                    newFile: Buffer.from("newfileContent"),
                    file2: Buffer.from("Content2"),
                },
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

        },
    ],
});
