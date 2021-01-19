/**
 * OCPPError
 * Attributes name are part of the OCPP specification
 */
export default class OCPPError extends Error {
  code: string;
  details?: any;

  public constructor(readonly params: {
    source: string;
    module: string;
    method: string;
    code: string;
    message: string;
    details?: any;
  }) {
    super(params.message);
    this.code = params.code;
    this.details = params.details;

    Object.setPrototypeOf(this, OCPPError.prototype); // For instanceof

    Error.captureStackTrace ? (Error.captureStackTrace(this, this.constructor)) : (this.stack = (new Error()).stack);
  }
}
