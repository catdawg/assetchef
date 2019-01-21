import { ChangeEmitter, ChangeEmitterOf1, createChangeEmitter } from "change-emitter";

import { ICancelWatch, IFSWatch, IFSWatchListener } from "../src/plugin/ifswatch";
import { IPathChangeEvent } from "../src/plugin/ipathchangeevent";

export class FakeFSWatch implements IFSWatch {
    public emitEv: ChangeEmitterOf1<IPathChangeEvent> = createChangeEmitter<IPathChangeEvent>();
    public emitReset: ChangeEmitter = createChangeEmitter();
    public addListener(listener: IFSWatchListener): ICancelWatch {

        const evCancel = this.emitEv.listen(listener.onEvent);
        const resetCancel = this.emitReset.listen(listener.onReset);
        return {
            cancel: () => {
                evCancel();
                resetCancel();
            },
        };
    }
}
