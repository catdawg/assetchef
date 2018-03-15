"use strict";
module.exports = (millis) => {
    return new Promise((resolve) => {
        setTimeout(resolve, millis);
    });
};
//# sourceMappingURL=timeout.js.map