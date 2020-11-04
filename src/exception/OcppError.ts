/**
 * OCPPError
 * Attributes name are part of the OCPP specification
 */
export default class OCPPError extends Error {
  public constructor(readonly params: {
    source: string;
    module: string;
    method: string;
    code: string;
    message: string;
    details?: any;
  }) {
    super(params.message);

    Object.setPrototypeOf(this, OCPPError.prototype); // For instanceof

    Error.captureStackTrace ? (Error.captureStackTrace(this, this.constructor)) : (this.stack = (new Error()).stack);
  }
}
