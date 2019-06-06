export default class OCPPError extends Error {
	public stack: any;
  public readonly code: string;
  public readonly message: string;
  public readonly details: string;
  
  constructor(code: string, message: string, details?: string) {
    super(message);

    this.code = code;
    this.message = message;
    this.details = details;

    Object.setPrototypeOf(this, OCPPError.prototype); // for instanceof

    Error.captureStackTrace ? (Error.captureStackTrace(this, this.constructor)) : (this.stack = (new Error()).stack);
  }
}
