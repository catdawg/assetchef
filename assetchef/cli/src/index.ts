import { winstonlogger } from "@assetchef/core";
import { runner } from "./runner";

runner(process.argv).catch((error) => {
    if (error != null) {
        winstonlogger.logError("error: %s", error);
    }
    process.exit(-1);
});
