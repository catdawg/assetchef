import Chance from "chance";

import * as fse from "fs-extra";
import { Stats } from "fs-extra";
import * as pathutils from "path";
import { VError } from "verror";
import { ILogger } from "../src/plugin/ilogger";

export enum RandomChange {
    Wait = "Wait",
    AddFile = "AddFile",
    DeleteFile = "DeleteFile",
    ChangeFile = "ChangeFile",
    AddDirectory = "AddDirectory",
    DeleteDirectory = "RemoveDirectory",
    GoIntoDirectory = "GoIntoDirectory",
    StepOutDirectory = "StepOutDirectory",
}

const weightConfig: Map<RandomChange, number> = new Map();

weightConfig.set(RandomChange.Wait,              30);
weightConfig.set(RandomChange.AddFile,           3);
weightConfig.set(RandomChange.DeleteFile,        7);
weightConfig.set(RandomChange.ChangeFile,        50);
weightConfig.set(RandomChange.AddDirectory,      1);
weightConfig.set(RandomChange.DeleteDirectory,   7);
weightConfig.set(RandomChange.GoIntoDirectory,   40);
weightConfig.set(RandomChange.StepOutDirectory,  5);

const waitTicks = 500;
const waitTicksWriting = 50;

/**
 * Additional options for the randomizer
 */
export interface IRandomFSChangerOptions {
    /**
     * Specify a seed so you can reproduce a test.
     */
    seed?: number;
    /**
     * Specify a worker count - more means more changes
     */
    workerCount?: number;
}

function fillOptionsWithDefault(options: IRandomFSChangerOptions): IRandomFSChangerOptions {
    if (options == null) {
        options = {};
    }

    if (options.seed == null) {
        options.seed = Math.random();
    }

    if (options.workerCount == null) {
        options.workerCount = 4;
    }

    return options;
}

enum WorkerState {
    Idle = "Idle",
    ChangingFile = "ChangingFile",
    Waiting = "Waiting",
}

class Worker {
    private _name: string;
    private _chance: Chance.Chance;
    private _state: WorkerState;
    private _logger: ILogger;

    private _fdBeingChanged: number;
    private _ticksLeft: number;

    private _basePath: string;
    private _currentPath: string;

    constructor(name: string, path: string, seed: number, logger: ILogger) {
        this._chance = new Chance(seed);
        this._state = WorkerState.Idle;
        this._basePath = path;
        this._currentPath = this._basePath;
        this._name = name;
        this._logger = logger;
    }

    public async tick() {
        switch (this._state) {
            case WorkerState.Idle:
                await this._runFromIdle();
                break;
            case WorkerState.ChangingFile:
                const sentence = new Buffer(this._chance.word() + " ");
                await fse.write(this._fdBeingChanged, sentence, 0, sentence.length);

                this._ticksLeft -= 1;
                if (this._ticksLeft < 0) {
                    await fse.close(this._fdBeingChanged);
                    this._state = WorkerState.Idle;
                }
                break;
            case WorkerState.Waiting:
                this._ticksLeft -= 1;
                if (this._ticksLeft < 0) {
                    this._state = WorkerState.Idle;
                }
                break;
        }
    }

    private async _runFromIdle() {

        const entries = await fse.readdir(this._currentPath);
        const directories = [];
        const files = [];

        const workerEntries = entries.filter((e) => e.startsWith(this._name + "_"));

        for (const entry of workerEntries) {
            try {
                const stat = await fse.stat(pathutils.join(this._currentPath, entry));
                if (stat.isDirectory()) {
                    directories.push(entry);
                } else {
                    files.push(entry);
                }
            } catch (e) {
                // Sometimes a file can be deleted and still returned on the next readdir due to a caching issue.
                // We can safely ignore that.
            }
        }

        const actions: RandomChange[] = [];
        const weights: number[] = [];

        actions.push(RandomChange.Wait);
        weights.push(weightConfig.get(RandomChange.Wait));

        actions.push(RandomChange.AddFile);
        weights.push(weightConfig.get(RandomChange.AddFile));
        actions.push(RandomChange.AddDirectory);
        weights.push(weightConfig.get(RandomChange.AddDirectory));

        if (this._basePath !== this._currentPath) {
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

        const nextAction = this._chance.weighted(actions, weights);

        switch (nextAction) {
            case RandomChange.AddDirectory: {
                const newDirectoryPath = pathutils.join(this._currentPath, this._name + "_" + this._chance.guid());
                this._logger.logInfo("%s creating directory %s",
                    this._name,
                    newDirectoryPath.substr(this._basePath.length));
                await fse.mkdir(newDirectoryPath);
                break;
            }
            case RandomChange.AddFile: {
                const newFilePath = pathutils.join(this._currentPath, this._name + "_" + this._chance.guid());
                this._logger.logInfo("%s creating file %s", this._name, newFilePath.substr(this._basePath.length));
                await fse.writeFile(newFilePath, this._chance.sentence);
                break;
            }
            case RandomChange.ChangeFile: {
                const file = pathutils.join(this._currentPath, files[0]);
                this._logger.logInfo("%s changing file %s", this._name, file.substr(this._basePath.length));
                this._state = WorkerState.ChangingFile;
                this._fdBeingChanged = await fse.open(file, "w");
                this._ticksLeft = waitTicksWriting;
                break;
            }
            case RandomChange.DeleteDirectory: {
                const dir = pathutils.join(this._currentPath, directories[0]);
                this._logger.logInfo("%s deleting directory %s", this._name, dir.substr(this._basePath.length));
                await fse.remove(dir);
                break;
            }
            case RandomChange.DeleteFile: {
                const file = pathutils.join(this._currentPath, files[0]);
                this._logger.logInfo("%s deleting file %s", this._name, file.substr(this._basePath.length));
                await fse.remove(file);
                break;
            }
            case RandomChange.GoIntoDirectory: {
                this._currentPath = pathutils.join(this._currentPath, directories[0]);
                this._logger.logInfo("%s going into %s", this._name, this._currentPath.substr(this._basePath.length));
                break;
            }
            case RandomChange.StepOutDirectory: {
                const tokens = this._currentPath.split(pathutils.sep);
                tokens.pop();
                this._logger.logInfo("%s stepping out of %s",
                    this._name, this._currentPath.substr(this._basePath.length));
                this._currentPath = tokens.join(pathutils.sep);
                break;
            }
            case RandomChange.Wait: {
                this._ticksLeft = waitTicks;
                this._state = WorkerState.Waiting;
                break;
            }
        }
    }
}

/**
 * Run randomizer of directory. @see IRandomFSChangerOptions for additional options.
 * @param path the to randomize
 * @param durationInMS the duration
 * @param options the aditional options
 * @throws VError if path or duration are not specified, or if path doesn't exist
 */
export async function runRandomFSChanger(
    path: string,
    durationInMS: number,
    logger: ILogger,
    options: IRandomFSChangerOptions = null) {
    if (path == null) {
        throw new VError("path argument can't be null");
    }

    if (durationInMS == null) {
        throw new VError("durationInMS argument can't be null");
    }

    let pathStat: Stats = null;
    try {
        pathStat = await fse.stat(path);
    } catch (e) {
        throw new VError(e, "could not find path");
    }

    if (!pathStat.isDirectory()) {
        throw new VError("path isn't a directory");
    }

    options = fillOptionsWithDefault(options);

    const startTime = Date.now();

    const chance = new Chance(options.seed);

    const workers = [];

    for (let i = 0; i < options.workerCount; ++i) {
        workers.push(new Worker("worker" + i, path, chance.integer(), logger));
    }
    while (Date.now() - startTime < durationInMS) {
        await Promise.all(workers.map((w) => w.tick()));

        await new Promise((resolve) => {
            setTimeout(resolve, 1);
        });
    }
}
