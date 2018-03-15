"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const verror_1 = require("verror");
module.exports = class FileRef {
    /**
     * @param {FileDereferencer} dereferencingMethod the method used to dereference the file
     */
    constructor(dereferencingMethod) {
        if (dereferencingMethod == null) {
            throw new verror_1.VError("derferencingMethod parameter is null");
        }
        this._dereferencingMethod = dereferencingMethod;
        this._data = null;
    }
    /**
     * @returns {Promise<Buffer>} the file data
     */
    dereference() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._data != null) {
                return this._data;
            }
            this._data = yield this._dereferencingMethod();
            this._dereferencingMethod = null;
            return this._data;
        });
    }
    /**
     * @param {FileDereferencer} newDereferencingMethod the new method used to dereference the file
     * @returns {Promise<void>} the returned promise
     */
    changeReference(newDereferencingMethod) {
        if (newDereferencingMethod == null) {
            throw new verror_1.VError("newDereferencingMethod parameter is null");
        }
        this._dereferencingMethod = newDereferencingMethod;
        this._data = null;
    }
};
//# sourceMappingURL=fileref.js.map