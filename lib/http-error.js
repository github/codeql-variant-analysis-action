"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPError = void 0;
class HTTPError extends Error {
    constructor(httpStatusCode, httpMessage) {
        super(`Unexpected HTTP response: ${httpStatusCode}. ${httpMessage}`);
        this.httpStatusCode = httpStatusCode;
        this.httpMessage = httpMessage;
    }
}
exports.HTTPError = HTTPError;
//# sourceMappingURL=http-error.js.map