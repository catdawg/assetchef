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
        projectContentsBefore: PathTree.bufferTreeFrom({
            file: Buffer.from("content"),
            dir: {
                file2: Buffer.from("Content2"),
            },
        }),
        nodeContentsBefore: PathTree.bufferTreeFrom({
            filebefore: Buffer.from("contentbefore"),
        }),
        change1: {
            change: async (pluginInstance, projectTree, prevNodeContents) => { return; },
            projectContentsAfter: null,
            nodeContentsAfter: PathTree.bufferTreeFrom({
                filebefore: Buffer.from("contentbefore"),
                file2: Buffer.from("Content2"),
            }),
        },
        change2: {
            change: async (pluginInstance, projectTree, prevNodeContents) => {
                await projectTree.set(PathUtils.join("dir", "newFile"), Buffer.from("newfileContent"));
                prevNodeContents.set("newfilebefore", Buffer.from("new content before"));
            },
            projectContentsAfter: null,
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
            projectContentsBefore: PathTree.bufferTreeFrom({
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
                    change: async (pluginInstance, projectTree, prevNodeContents) => { return; },
                    projectContentsAfter: null,
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
            projectContentsBefore: PathTree.bufferTreeFrom({
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
                    change: async (pluginInstance, projectTree, prevNodeContents) => { return; },
                    projectContentsAfter: null,
                    nodeContentsAfter: PathTree.bufferTreeFrom({
                        filebefore: Buffer.from("contentbefore"),
                        dir: {
                            file2: Buffer.from("Content2"),
                        },
                    }),
                },
                {
                    change: async (pluginInstance, projectTree, prevNodeContents) => {
                        await projectTree.set("excluded", Buffer.from("excluded"));
                    },
                    projectContentsAfter: null,
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
            projectContentsBefore: PathTree.bufferTreeFrom({
                file: Buffer.from("content"),
            }),
            nodeContentsBefore: PathTree.bufferTreeFrom({
                filebefore: Buffer.from("contentbefore"),
            }),
            changes: [
                {
                    change: async (pluginInstance, projectTree, prevNodeContents) => {
                        await projectTree.createFolder("dir");
                        await projectTree.set(PathUtils.join("dir", "file"), Buffer.from("content"));
                        await projectTree.createFolder("dir2");
                        await projectTree.set(PathUtils.join("dir2", "file"), Buffer.from("contentignored"));
                    },
                    projectContentsAfter: null,
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
