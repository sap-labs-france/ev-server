import Constants from '../utils/Constants';

export default class OCPIServerError extends Error {

  public ocpiError: {status_code: number; status_message: string};
  public readonly detailedMessages: any; // TODO: in codebase sometimes passes array of strings, sometimes payload,... be consistent, type this.

  constructor(
    readonly action: string,
    readonly message: string,
    readonly httpErrorCode: number = Constants.HTTP_GENERAL_ERROR,
    readonly module: string = "N/A",
    readonly method: string = "N/A",
    ocpiError?: {status_code: number; status_message: string},
    detailedMessages?: any) {
    super(message);
    this.detailedMessages = detailedMessages;
    this.ocpiError = (ocpiError) ? ocpiError : Constants.OCPI_STATUS_CODE.CODE_3000_GENERIC_SERVER_ERROR;
  }
}
