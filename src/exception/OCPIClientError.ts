import Constants from '../utils/Constants';

export default class OCPIClientError extends Error {

  readonly source: string = 'OCPI Server';
  readonly ocpiError: {status_code: number; status_message: string};

  constructor(
    readonly action: string,
    readonly message: string,
    readonly httpErrorCode: number = 500,
    readonly module: string = "N/A",
    readonly method: string = "N/A",
    ocpiError?: {status_code: number; status_message: string})
  {
    super(message);
    this.ocpiError = (ocpiError) ? ocpiError : Constants.OCPI_STATUS_CODE.CODE_2000_GENERIC_CLIENT_ERROR;
  }
}
