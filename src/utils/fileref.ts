import { VError } from "verror";

/**
 * This callback will be called lazily, when the data for the file is needed.
 * @typedef {function():Buffer} FileDereferencer
 * @returns {Buffer} the file content
 */

/**
 * Represents a File Reference. The dereferencing method is passed in on the constructor.
 * This can be used to reference a file in a memory, where the dereferencing method is
 * simply a method that returns the data in memory.
 * Or used to reference a file in the disk, where the dereferencing method can be reading from disk.
 */
export = class FileRef {
    private _dereferencingMethod: () => Buffer;
    private _data: Buffer;
    /**
     * @param {FileDereferencer} dereferencingMethod the method used to dereference the file
     */
    constructor(dereferencingMethod: () => Buffer) {
        if (dereferencingMethod == null) {
            throw new VError("derferencingMethod parameter is null");
        }
        this._dereferencingMethod = dereferencingMethod;
        this._data = null;
    }

    /**
     * @returns {Promise<Buffer>} the file data
     */
    public async dereference() {
        if (this._data != null)  {
            return this._data;
        }

        this._data = await this._dereferencingMethod();
        this._dereferencingMethod = null;

        return this._data;
    }

    /**
     * @param {FileDereferencer} newDereferencingMethod the new method used to dereference the file
     * @returns {Promise<void>} the returned promise
     */
    public changeReference(newDereferencingMethod: () => Buffer) {
        if (newDereferencingMethod == null) {
            throw new VError("newDereferencingMethod parameter is null");
        }
        this._dereferencingMethod = newDereferencingMethod;
        this._data = null;
    }
};
