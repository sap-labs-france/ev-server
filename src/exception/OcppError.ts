/**
 * OCPPError
 * Attributes name are part of the OCPP specification
 */
export default class OCPPError extends Error {
  public code: string;
  public details?: any;

  public constructor(public readonly params: {
    module: string;
    method: string;
    code: string;
    message: string;
    details?: any;
    chargingStationID?: string;
    siteID?: string;
    siteAreaID?: string;
    companyID?: string;
    detailedMessages?: any;
  }) {
    super(params.message);
    this.code = params.code;
    this.details = params.details;

    Object.setPrototypeOf(this, OCPPError.prototype); // For instanceof

    Error.captureStackTrace ? (Error.captureStackTrace(this, this.constructor)) : (this.stack = (new Error()).stack);
  }
}
