import * as watchman from "fb-watchman";
import * as pathutils from "path";
import * as util from "util";

import { IPathChangeEvent, PathEventType } from "../../plugin/ipathchangeevent";
import {
    IFSEventMessage,
    ILogMessage,
    ILogWarnMessage,
    IStartedMessage,
    IStartMessage } from "./fswatchmessages_watchman";

function log(msg: string, ...args: any[]) {
    const formattedMsg = util.format.apply(null, [msg, ...args]);
    process.send({type: "Log", msg: formattedMsg} as ILogMessage);
}
function logWarn(msg: string, ...args: any[]) {
    const formattedMsg = util.format.apply(null, [msg, ...args]);
    process.send({type: "LogWarn", msg: formattedMsg} as ILogWarnMessage);
}
function sendEvent(ev: IPathChangeEvent) {
    process.send({type: "FSEvent", ev} as IFSEventMessage);
}

const client = new watchman.Client();

function startWatchman(directory: string) {

    client.command(["watch-project", directory],
        (watchError, watchResp) => {
            if (watchError) {
                logWarn("Error initiating: %s", watchError);
                return;
            }

            if ("warning" in watchResp) {
                logWarn("Warning initiating: %s", watchResp.warning);
            }

            client.command(["clock", watchResp.watch], (clockError, clockResp) => {

                if (clockError != null) {
                    logWarn("Error on getting clock: ", clockError);
                    return;
                }

                const sub: any = {
                    fields: ["name", "mtime_ms", "exists", "type", "new"],
                    since: clockResp.clock,
                };

                if (watchResp.relative_path) {
                    sub.relative_root = watchResp.relative_path;
                }
                client.command(
                    ["subscribe", watchResp.watch, "dirwatcher", sub],
                    (subscribeError, subscribeResp) => {
                        if (subscribeError) {
                            // Probably an error in the subscription criteria
                            logWarn("Error failed to subscribe: %s", subscribeError);
                            return;
                        }
                        process.send({type: "Started"} as IStartedMessage);
                    },
                );
                client.on("subscription", (subscriptionEvent) => {
                    if (subscriptionEvent.subscription !== "dirwatcher") {
                        return;
                    }

                    if (subscriptionEvent.files == null) {
                        return;
                    }

                    for (const file of subscriptionEvent.files) {
                        const name = (file.name as string).split("/").join(pathutils.sep);
                        if (file.type === "d") {
                            if (file.exists) {
                                log("detected addDir %s", name);
                                sendEvent({eventType: PathEventType.AddDir, path: name});
                            } else {
                                log("detected unlinkDir %s", name);
                                sendEvent({eventType: PathEventType.UnlinkDir, path: name});
                            }
                        } else if (file.type === "f") {
                            if (file.exists) {
                                if (file.new) {
                                    log("detected add %s", name);
                                    sendEvent({eventType: PathEventType.Add, path: name});
                                } else {
                                    log("detected change %s", name);
                                    sendEvent({eventType: PathEventType.Change, path: name});
                                }
                            } else {
                                log("detected unlink %s", name);
                                sendEvent({eventType: PathEventType.Unlink, path: name});
                            }
                        }
                    }
                });

            });

        },
    );
}

process.on("message", (msg) => {
    if (msg.type == null) {
        return;
    }

    if (msg.type === "Start") {
        const typedMessage: IStartMessage = msg;
        startWatchman(typedMessage.path);
        return;
    }

    if (msg.type === "DebugExit") {
        process.exit(1);
    }
});
