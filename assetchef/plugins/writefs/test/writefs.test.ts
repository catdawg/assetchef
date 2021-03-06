import * as fse from "fs-extra";

import {
    PathTree,
    PathUtils,
    plugintests,
    TmpFolder,
    winstonlogger,
} from "@assetchef/pluginapi";

import { WriteFSPlugin } from "../src/writefs";

const tmpDirPath = TmpFolder.generate();
const testPath = PathUtils.join(tmpDirPath, "writefstest");

plugintests("writefs", testPath, new WriteFSPlugin(), {
    simple: {
        config: {
            targetPath: "export",
        },
        projectContentsBefore: null,
        nodeContentsBefore: PathTree.bufferTreeFrom({
            file: Buffer.from("content"),
            dir: {
                fileindir: Buffer.from("other file"),
            },
        }),
        change1: {
            change: async (pluginInstance, projectTree, prevNodeContents) => { return; },
            projectContentsAfter: PathTree.bufferTreeFrom({
                export : {
                    file: Buffer.from("content"),
                    dir: {
                        fileindir: Buffer.from("other file"),
                    },
                },
            }),
            nodeContentsAfter: null,
        },
        change2: {
            change: async (pluginInstance, projectTree, prevNodeContents) => {
                prevNodeContents.remove("dir");
                prevNodeContents.set(PathUtils.join("dir2", "newfile"), Buffer.from("new file"));
            },
            projectContentsAfter: PathTree.bufferTreeFrom({
                export : {
                    file: Buffer.from("content"),
                    dir2: {
                        newfile: Buffer.from("new file"),
                    },
                },
            }),
            nodeContentsAfter: null,
        },
    },
    others: [
        {
            name: "exclude",
            config: {
                exclude: [PathUtils.join("**", "excludedfile*")],
                targetPath: "",
            },
            projectContentsBefore: null,
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
                    change: async (pluginInstance, projectTree, prevNodeContents) => { return; },
                    projectContentsAfter: PathTree.bufferTreeFrom({
                        file: Buffer.from("content"),
                        dir: {
                            fileindir: Buffer.from("other file"),
                        },
                    }),
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, projectTree, prevNodeContents) => {
                        prevNodeContents.remove("excludedfile");
                        prevNodeContents.set("excludedfile", Buffer.from("content"));
                        return;
                    },
                    projectContentsAfter: PathTree.bufferTreeFrom({
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
                include: [PathUtils.join("dir", "*")],
                targetPath: "",
            },
            projectContentsBefore: null,
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
                    change: async (pluginInstance, projectTree, prevNodeContents) => { return; },
                    projectContentsAfter: PathTree.bufferTreeFrom({
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
                targetPath: "",
            },
            projectContentsBefore: null,
            nodeContentsBefore: PathTree.bufferTreeFrom(Buffer.from("content")),
            changes: [
                {
                    change: async (pluginInstance, projectTree, prevNodeContents) => {
                        pluginInstance.reset();
                        return;
                    },
                    projectContentsAfter: PathTree.bufferTreeFrom(Buffer.from("content")),
                    nodeContentsAfter: null,
                },
            ],

        },
        {
            name: "reset root deleted",
            config: {
                targetPath: "",
            },
            projectContentsBefore: null,
            nodeContentsBefore: PathTree.bufferTreeFrom(Buffer.from("content")),
            changes: [
                {
                    change: async (pluginInstance, projectTree, prevNodeContents) => {
                        return;
                    },
                    projectContentsAfter: PathTree.bufferTreeFrom(Buffer.from("content")),
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, projectTree, prevNodeContents) => {
                        prevNodeContents.remove("");
                        pluginInstance.reset();
                        return;
                    },
                    projectContentsAfter: PathTree.bufferTreeFrom(null),
                    nodeContentsAfter: null,
                },
            ],

        },
        {
            name: "reset root deleted2",
            config: {
                targetPath: "",
            },
            projectContentsBefore: null,
            nodeContentsBefore: PathTree.bufferTreeFrom({
                file: Buffer.from("content"),
                dir: {
                    fileindir: Buffer.from("other file"),
                },
            }),
            changes: [
                {
                    change: async (pluginInstance, projectTree, prevNodeContents) => {
                        return;
                    },
                    projectContentsAfter: PathTree.bufferTreeFrom({
                        file: Buffer.from("content"),
                        dir: {
                            fileindir: Buffer.from("other file"),
                        },
                    }),
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, projectTree, prevNodeContents) => {
                        prevNodeContents.remove("");
                        pluginInstance.reset();
                        return;
                    },
                    projectContentsAfter: PathTree.bufferTreeFrom(null),
                    nodeContentsAfter: null,
                },
            ],

        },
        {
            name: "nothing to do",
            config: {
                targetPath: "",
            },
            projectContentsBefore: null,
            nodeContentsBefore: PathTree.bufferTreeFrom({
                file: Buffer.from("content"),
                dir: {
                    fileindir: Buffer.from("other file"),
                },
            }),
            changes: [
                {
                    change: async (pluginInstance, projectTree, prevNodeContents) => {
                        return;
                    },
                    projectContentsAfter: PathTree.bufferTreeFrom({
                        file: Buffer.from("content"),
                        dir: {
                            fileindir: Buffer.from("other file"),
                        },
                    }),
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, projectTree, prevNodeContents) => {
                        return;
                    },
                    projectContentsAfter: PathTree.bufferTreeFrom({
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
                targetPath: "",
            },
            projectContentsBefore: null,
            nodeContentsBefore: PathTree.bufferTreeFrom({
                file: Buffer.from("content"),
                dir: {
                    fileindir: Buffer.from("other file"),
                },
            }),
            changes: [
                {
                    change: async (pluginInstance, projectTree, prevNodeContents) => {
                        return;
                    },
                    projectContentsAfter: PathTree.bufferTreeFrom({
                        file: Buffer.from("content"),
                        dir: {
                            fileindir: Buffer.from("other file"),
                        },
                    }),
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, projectTree, prevNodeContents) => {
                        prevNodeContents.set("newfile", Buffer.from("content"));
                        await projectTree.remove("");
                        winstonlogger.logError("HEREREEE");
                        return;
                    },
                    projectContentsAfter: PathTree.bufferTreeFrom({
                        file: Buffer.from("content"),
                        newfile: Buffer.from("content"),
                        dir: {
                            fileindir: Buffer.from("other file"),
                        },
                    }),
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, projectTree, prevNodeContents) => {
                        winstonlogger.logError("NOWW");
                        prevNodeContents.remove("newfile");
                        await projectTree.remove("");
                        return;
                    },
                    projectContentsAfter: null, // won't regenerate with just an unlink
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, projectTree, prevNodeContents) => {
                        pluginInstance.reset();
                        return;
                    },
                    projectContentsAfter: PathTree.bufferTreeFrom({
                        file: Buffer.from("content"),
                        dir: {
                            fileindir: Buffer.from("other file"),
                        },
                    }),
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, projectTree, prevNodeContents) => {
                        prevNodeContents.remove("dir");
                        await projectTree.remove("");
                        return;
                    },
                    projectContentsAfter: PathTree.bufferTreeFrom(null),
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        pluginInstance.reset();
                        return;
                    },
                    projectContentsAfter: PathTree.bufferTreeFrom({
                        file: Buffer.from("content"),
                    }),
                    nodeContentsAfter: null,
                },
            ],

        },
        {
            name: "target path goes from file to dir",
            config: {
                targetPath: "target",
            },
            projectContentsBefore: PathTree.bufferTreeFrom({
                somefile: Buffer.from("content"),
                target: Buffer.from("file"),
            }),
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
                    projectContentsAfter: PathTree.bufferTreeFrom({
                        somefile: Buffer.from("content"),
                        target: {
                            file: Buffer.from("content"),
                            dir: {
                                fileindir: Buffer.from("other file"),
                            },
                        },
                    }),
                    nodeContentsAfter: null,
                },
            ],

        },
        {
            name: "target path goes from file to file",
            config: {
                targetPath: "target",
            },
            projectContentsBefore: PathTree.bufferTreeFrom({
                somefile: Buffer.from("content"),
                target: Buffer.from("file"),
            }),
            nodeContentsBefore: PathTree.bufferTreeFrom(Buffer.from("new target")),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        return;
                    },
                    projectContentsAfter: PathTree.bufferTreeFrom({
                        somefile: Buffer.from("content"),
                        target: Buffer.from("new target"),
                    }),
                    nodeContentsAfter: null,
                },
            ],

        },
        {
            name: "target path goes from dir to file",
            config: {
                targetPath: "target",
            },
            projectContentsBefore: PathTree.bufferTreeFrom({
                somefile: Buffer.from("content"),
                target: {
                    filetowrite: Buffer.from("file1"),
                    dirtowrite: {
                        another: Buffer.from("a"),
                    },
                },
            }),
            nodeContentsBefore: PathTree.bufferTreeFrom(Buffer.from("new target")),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        return;
                    },
                    projectContentsAfter: PathTree.bufferTreeFrom({
                        somefile: Buffer.from("content"),
                        target: Buffer.from("new target"),
                    }),
                    nodeContentsAfter: null,
                },
            ],

        },
        {
            name: "target path was dir",
            config: {
                targetPath: "target",
            },
            projectContentsBefore: PathTree.bufferTreeFrom({
                somefile: Buffer.from("content"),
                target: {
                    file: Buffer.from("file1"),
                    dir: {
                        another: Buffer.from("a"),
                    },
                },
            }),
            nodeContentsBefore: PathTree.bufferTreeFrom({
                file1: Buffer.from("file1"),
                dir: {
                    another1: Buffer.from("b"),
                },
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        return;
                    },
                    projectContentsAfter: PathTree.bufferTreeFrom({
                        somefile: Buffer.from("content"),
                        target: {
                            file1: Buffer.from("file1"),
                            dir: {
                                another1: Buffer.from("b"),
                            },
                        },
                    }),
                    nodeContentsAfter: null,
                },
            ],

        },
    ],
});
