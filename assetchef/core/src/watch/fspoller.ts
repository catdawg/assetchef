import * as fse from "fs-extra";
import { VError } from "verror";

const POLLING_TIMEOUT = 1000;

/**
 * Token for interaction with a polling instance.
 */
export interface IActiveFSPoll {
    getLast: () => fse.Stats;
    cancel: () => void;
}

async function getStat(path: string): Promise<fse.Stats> {
    let rootStat: fse.Stats = null;
    try {
        rootStat = await fse.stat(path);
    } catch (e) {
        return null;
    }

    return rootStat;
}

function timeout(millis: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, millis);
    });
}

/**
 * Holder for helper methods to poll a path
 */
export class FSPoller {

    /**
     * This method will setup a poller for a given path, returning every second the current fs.Stats of the path.
     * To cancel, just call cancel on what is returned here.
     * It is asynchronous so that the first value for stat is already set, since the stat call is asynchronous.
     * @param path the path
     * @param statCb the callback for the stats
     * @return token that allows you to query the current state, and to cancel the polling.
     */
    public static async poll(path: string, statCb: (stat?: fse.Stats) => void): Promise<IActiveFSPoll> {
        if (path == null) {
            throw new VError("path is null");
        }

        if (statCb == null) {
            throw new VError("statCb is null");
        }
        let lastStat: fse.Stats = await getStat(path);
        let cancel = false;

        (async () => {
            await timeout(POLLING_TIMEOUT);
            while (!cancel) {
                lastStat = await getStat(path);
                statCb(lastStat);
                await timeout(POLLING_TIMEOUT);
            }
        })();

        return {
            getLast: () => lastStat,
            cancel: () => cancel = true,
        };
    }
}
