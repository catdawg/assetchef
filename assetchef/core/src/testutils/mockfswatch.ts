import { ChangeEmitter, ChangeEmitterOf1, createChangeEmitter } from "change-emitter";

import { IPathChangeEvent } from "../path/ipathchangeevent";
import { ICancelWatch, IFSWatch, IFSWatchListener } from "../watch/ifswatch";

export class MockFSWatch implements IFSWatch {
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
