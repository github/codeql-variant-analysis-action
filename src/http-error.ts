export class HTTPError extends Error {
  httpStatusCode: number | undefined;
  httpMessage: string;
  constructor(httpStatusCode: number | undefined, httpMessage: string) {
    super(`Unexpected HTTP response: ${httpStatusCode}. ${httpMessage}`);
    this.httpStatusCode = httpStatusCode;
    this.httpMessage = httpMessage;
  }
}
