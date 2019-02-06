// tslint:disable:no-unused-expression
import * as chai from "chai";

import * as fse from "fs-extra";
import * as pathutils from "path";

import { ReadFSPlugin } from "../../src/assetchef-readfs/readfs";
import { ReadFSPluginInstance } from "../../src/assetchef-readfs/readfsinstance";
import { WriteFSPlugin } from "../../src/assetchef-writefs/writefs";
import { timeout } from "../../src/utils/timeout";
import { PathTreeSetup } from "../../test_utils/pathtreesetup";
import { plugintests } from "../../test_utils/plugintestsuite";
import { TmpFolder } from "../../test_utils/tmpfolder";

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
        nodeContentsBefore: PathTreeSetup.create({
            file: Buffer.from("content"),
            dir: {
                fileindir: Buffer.from("other file"),
            },
        }),
        change1: {
            change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
            fsContentsAfter: PathTreeSetup.create({
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
            fsContentsAfter: PathTreeSetup.create({
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
            nodeContentsBefore: PathTreeSetup.create({
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
                    fsContentsAfter: PathTreeSetup.create({
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
                    fsContentsAfter: PathTreeSetup.create({
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
            nodeContentsBefore: PathTreeSetup.create({
                excludedfile: Buffer.from("excludedcontent"),
                dir: {
                    fileindir: Buffer.from("other file"),
                },
            }),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => { return; },
                    fsContentsAfter: PathTreeSetup.create({
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
            nodeContentsBefore: PathTreeSetup.create(Buffer.from("content")),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        pluginInstance.reset();
                        return;
                    },
                    fsContentsAfter: PathTreeSetup.create(Buffer.from("content")),
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
            nodeContentsBefore: PathTreeSetup.create(Buffer.from("content")),
            changes: [
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        return;
                    },
                    fsContentsAfter: PathTreeSetup.create(Buffer.from("content")),
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        prevNodeContents.remove("");
                        pluginInstance.reset();
                        return;
                    },
                    fsContentsAfter: PathTreeSetup.create(null),
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
            nodeContentsBefore: PathTreeSetup.create({
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
                    fsContentsAfter: PathTreeSetup.create({
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
                    fsContentsAfter: PathTreeSetup.create(null),
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
            nodeContentsBefore: PathTreeSetup.create({
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
                    fsContentsAfter: PathTreeSetup.create({
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
                    fsContentsAfter: PathTreeSetup.create({
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
                    fsContentsAfter: PathTreeSetup.create({
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
                    fsContentsAfter: PathTreeSetup.create(null),
                    nodeContentsAfter: null,
                },
                {
                    change: async (pluginInstance, testFSPath, prevNodeContents) => {
                        pluginInstance.reset();
                        return;
                    },
                    fsContentsAfter: PathTreeSetup.create({
                        file: Buffer.from("content"),
                    }),
                    nodeContentsAfter: null,
                },
            ],

        },
    ],
});
