// tslint:disable:no-unused-expression
import * as chai from "chai";

import * as fse from "fs-extra";
import * as pathutils from "path";

import {
    PathTree,
    plugintests,
    TmpFolder,
} from "@assetchef/pluginapi";

import { WriteFSPlugin } from "../src/writefs";

const tmpDirPath = TmpFolder.generate();
const testPath = pathutils.join(tmpDirPath, "readfstest");

plugintests("writefs", testPath, new WriteFSPlugin(), {
    simple: {
        config: {
            include: [pathutils.join("**", "*")],
            targetPath: "",
            includeRootAsFile: true,
        },
        fsContentsBefore: null,
        nodeContentsBefore: PathTree.bufferTreeFrom({
            file: Buffer.from("content"),
            dir: {
                fileindir: Buffer.from("other file"),
            },
        }),
        change1: {
            change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
            fsContentsAfter: PathTree.bufferTreeFrom({
                file: Buffer.from("content"),
                dir: {
                    fileindir: Buffer.from("other file"),
                },
            }),
            nodeContentsAfter: null,
        },
        change2: {
            change: async (pluginInstance, testFSPath, prevNodeContents) => {
                prevNodeContents.remove("dir");
                prevNodeContents.set(pathutils.join("dir2", "newfile"), Buffer.from("new file"));
            },
            fsContentsAfter: PathTree.bufferTreeFrom({
                file: Buffer.from("content"),
                dir2: {
                    newfile: Buffer.from("new file"),
                },
            }),
            nodeContentsAfter: null,
        },
    },
    others: [
        {
            name: "exclude",
            config: {
                include: [pathutils.join("**", "*")],
                exclude: [pathutils.join("**", "excludedfile*")],
                targetPath: "",
                includeRootAsFile: true,
            },
            fsContentsBefore: null,
            nodeContentsBefore: PathTree.bufferTreeFrom({
                file: Buffer.from("content"),
                excludedfile: Buffer.from("excludedcontent"),
                dir: {
                    fileindir: Buffer.from("other file"),
                    excludedfile: Buffer.from("excludedcontent"),
                },
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: PathTree.bufferTreeFrom({
                        file: Buffer.from("content"),
                        dir: {
                            fileindir: Buffer.from("other file"),
                        },
                    }),
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        prevNodeContents.remove("excludedfile");
                        prevNodeContents.set("excludedfile", Buffer.from("content"));
                        return;
                    },
                    fsContentsAfter: PathTree.bufferTreeFrom({
                        file: Buffer.from("content"),
                        dir: {
                            fileindir: Buffer.from("other file"),
                        },
                    }),
                    nodeContentsAfter: null,
                },
            ],

        },
        {
            name: "include",
            config: {
                include: [pathutils.join("dir", "*")],
                targetPath: "",
                includeRootAsFile: true,
            },
            fsContentsBefore: null,
            nodeContentsBefore: PathTree.bufferTreeFrom({
                excludedfile: Buffer.from("excludedcontent"),
                dir: {
                    fileindir: Buffer.from("other file"),
                },
                excludedDir: {
                    fileInExcludedDir: Buffer.from("excludedContent"),
                },
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: PathTree.bufferTreeFrom({
                        dir: {
                            fileindir: Buffer.from("other file"),
                        },
                    }),
                    nodeContentsAfter: null,
                },
            ],

        },
        {
            name: "reset root as file",
            config: {
                include: [pathutils.join("**", "*")],
                exclude: [pathutils.join("**", "excludedfile*")],
                targetPath: "",
                includeRootAsFile: true,
            },
            fsContentsBefore: null,
            nodeContentsBefore: PathTree.bufferTreeFrom(Buffer.from("content")),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        pluginInstance.reset();
                        return;
                    },
                    fsContentsAfter: PathTree.bufferTreeFrom(Buffer.from("content")),
                    nodeContentsAfter: null,
                },
            ],

        },
        {
            name: "reset root deleted",
            config: {
                include: [pathutils.join("**", "*")],
                exclude: [pathutils.join("**", "excludedfile*")],
                targetPath: "",
                includeRootAsFile: true,
            },
            fsContentsBefore: null,
            nodeContentsBefore: PathTree.bufferTreeFrom(Buffer.from("content")),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        return;
                    },
                    fsContentsAfter: PathTree.bufferTreeFrom(Buffer.from("content")),
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        prevNodeContents.remove("");
                        pluginInstance.reset();
                        return;
                    },
                    fsContentsAfter: PathTree.bufferTreeFrom(null),
                    nodeContentsAfter: null,
                },
            ],

        },
        {
            name: "reset root deleted2",
            config: {
                include: [pathutils.join("**", "*")],
                exclude: [pathutils.join("**", "excludedfile*")],
                targetPath: "",
                includeRootAsFile: true,
            },
            fsContentsBefore: null,
            nodeContentsBefore: PathTree.bufferTreeFrom({
                file: Buffer.from("content"),
                dir: {
                    fileindir: Buffer.from("other file"),
                },
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        return;
                    },
                    fsContentsAfter: PathTree.bufferTreeFrom({
                        file: Buffer.from("content"),
                        dir: {
                            fileindir: Buffer.from("other file"),
                        },
                    }),
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        prevNodeContents.remove("");
                        pluginInstance.reset();
                        return;
                    },
                    fsContentsAfter: PathTree.bufferTreeFrom(null),
                    nodeContentsAfter: null,
                },
            ],

        },
        {
            name: "nothing to do",
            config: {
                include: [pathutils.join("**", "*")],
                targetPath: "",
                includeRootAsFile: true,
            },
            fsContentsBefore: null,
            nodeContentsBefore: PathTree.bufferTreeFrom({
                file: Buffer.from("content"),
                dir: {
                    fileindir: Buffer.from("other file"),
                },
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        return;
                    },
                    fsContentsAfter: PathTree.bufferTreeFrom({
                        file: Buffer.from("content"),
                        dir: {
                            fileindir: Buffer.from("other file"),
                        },
                    }),
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        return;
                    },
                    fsContentsAfter: PathTree.bufferTreeFrom({
                        file: Buffer.from("content"),
                        dir: {
                            fileindir: Buffer.from("other file"),
                        },
                    }),
                    nodeContentsAfter: null,
                },
            ],

        },
        {
            name: "root deleted mid write",
            config: {
                include: [pathutils.join("**", "*")],
                targetPath: "",
                includeRootAsFile: true,
            },
            fsContentsBefore: null,
            nodeContentsBefore: PathTree.bufferTreeFrom({
                file: Buffer.from("content"),
                dir: {
                    fileindir: Buffer.from("other file"),
                },
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        return;
                    },
                    fsContentsAfter: PathTree.bufferTreeFrom({
                        file: Buffer.from("content"),
                        dir: {
                            fileindir: Buffer.from("other file"),
                        },
                    }),
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        prevNodeContents.set("newfile", Buffer.from("content"));
                        await fse.remove(testFSPath);
                        return;
                    },
                    fsContentsAfter: PathTree.bufferTreeFrom({
                        file: Buffer.from("content"),
                        newfile: Buffer.from("content"),
                        dir: {
                            fileindir: Buffer.from("other file"),
                        },
                    }),
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        prevNodeContents.remove("newfile");
                        await fse.remove(testFSPath);
                        return;
                    },
                    fsContentsAfter: null, // won't regenerate with just an unlink
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        pluginInstance.reset();
                        return;
                    },
                    fsContentsAfter: PathTree.bufferTreeFrom({
                        file: Buffer.from("content"),
                        dir: {
                            fileindir: Buffer.from("other file"),
                        },
                    }),
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        prevNodeContents.remove("dir");
                        await fse.remove(testFSPath);
                        return;
                    },
                    fsContentsAfter: PathTree.bufferTreeFrom(null),
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        pluginInstance.reset();
                        return;
                    },
                    fsContentsAfter: PathTree.bufferTreeFrom({
                        file: Buffer.from("content"),
                    }),
                    nodeContentsAfter: null,
                },
            ],

        },
    ],
});
