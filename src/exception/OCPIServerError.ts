import Constants from '../utils/Constants';

export default class OCPIServerError extends Error {

  ocpiError: {status_code: number, status_message: string};

  constructor(
    readonly action: string,
    readonly message: string,
    readonly httpErrorCode: number = 500,
    readonly module: string = "N/A",
    readonly method: string = "N/A",
    ocpiError?: {status_code: number, status_message: string})
  {
    super(message);
    this.ocpiError = (ocpiError) ? ocpiError : Constants.OCPI_STATUS_CODE.CODE_3000_GENERIC_SERVER_ERROR;
  }
};
