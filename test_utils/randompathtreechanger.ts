import Chance from "chance";

import * as pathutils from "path";
import { PathTree } from "../src/utils/path/pathtree";

enum RandomChange {
    AddFile = "AddFile",
    DeleteFile = "DeleteFile",
    ChangeFile = "ChangeFile",
    AddDirectory = "AddDirectory",
    DeleteDirectory = "RemoveDirectory",
    GoIntoDirectory = "GoIntoDirectory",
    StepOutDirectory = "StepOutDirectory",
}

const weightConfig: Map<RandomChange, number> = new Map();

weightConfig.set(RandomChange.AddFile,           10);
weightConfig.set(RandomChange.DeleteFile,        9);
weightConfig.set(RandomChange.ChangeFile,        30);
weightConfig.set(RandomChange.AddDirectory,      10);
weightConfig.set(RandomChange.DeleteDirectory,   3);
weightConfig.set(RandomChange.GoIntoDirectory,   20);
weightConfig.set(RandomChange.StepOutDirectory,  18);

export class RandomPathTreeChanger {
    private name: string;
    private chance: Chance.Chance;

    private pathTree: PathTree<string>;
    private currentPath: string;

    constructor(name: string, pathTree: PathTree<string>, seed: number) {
        this.chance = new Chance(seed);
        this.pathTree = pathTree;
        this.currentPath = "";
        this.name = name;
    }

    public tick() {
        const entries = [...this.pathTree.list(this.currentPath)];
        const directories = [];
        const files = [];

        const workerEntries = entries.filter((e) => e.startsWith(this.name + "_"));

        for (const entry of workerEntries) {
            if (this.pathTree.isDir(pathutils.join(this.currentPath, entry))) {
                directories.push(entry);
            } else {
                files.push(entry);
            }
        }

        const actions: RandomChange[] = [];
        const weights: number[] = [];

        actions.push(RandomChange.AddFile);
        weights.push(weightConfig.get(RandomChange.AddFile));
        actions.push(RandomChange.AddDirectory);
        weights.push(weightConfig.get(RandomChange.AddDirectory));

        if ("" !== this.currentPath) {
            actions.push(RandomChange.StepOutDirectory);
            weights.push(weightConfig.get(RandomChange.StepOutDirectory));
        }

        if (directories.length > 0 ) {
            actions.push(RandomChange.DeleteDirectory);
            weights.push(weightConfig.get(RandomChange.DeleteDirectory));

            if (files.length > 0) {
                actions.push(RandomChange.GoIntoDirectory);
                weights.push(weightConfig.get(RandomChange.GoIntoDirectory));
            }
        }

        if (files.length > 0) {
            actions.push(RandomChange.ChangeFile);
            weights.push(weightConfig.get(RandomChange.ChangeFile));
            actions.push(RandomChange.DeleteFile);
            weights.push(weightConfig.get(RandomChange.DeleteFile));
        }

        const nextAction = this.chance.weighted(actions, weights);

        switch (nextAction) {
            case RandomChange.AddDirectory: {
                let newDirectoryPath = pathutils.join(this.currentPath, this.name + "_" + this.chance.d8());
                while (this.pathTree.exists(newDirectoryPath)) {
                    newDirectoryPath += "" + this.chance.d8();
                }
                this.pathTree.mkdir(newDirectoryPath);
                break;
            }
            case RandomChange.AddFile: {
                let newFilePath = pathutils.join(this.currentPath, this.name + "_" + this.chance.d8());
                while (this.pathTree.exists(newFilePath)) {
                    newFilePath += "" + this.chance.d8();
                }
                this.pathTree.set(newFilePath, this.chance.sentence());
                break;
            }
            case RandomChange.ChangeFile: {
                const file = pathutils.join(this.currentPath, files[0]);
                this.pathTree.set(file, this.chance.sentence());
                break;
            }
            case RandomChange.DeleteDirectory: {
                const dir = pathutils.join(this.currentPath, directories[0]);
                this.pathTree.remove(dir);
                break;
            }
            case RandomChange.DeleteFile: {
                const file = pathutils.join(this.currentPath, files[0]);
                this.pathTree.remove(file);
                break;
            }
            case RandomChange.GoIntoDirectory: {
                this.currentPath = pathutils.join(this.currentPath, directories[0]);
                break;
            }
            case RandomChange.StepOutDirectory: {
                const tokens = this.currentPath.split(pathutils.sep);
                tokens.pop();
                this.currentPath = tokens.join(pathutils.sep);
                break;
            }
        }
    }
}
