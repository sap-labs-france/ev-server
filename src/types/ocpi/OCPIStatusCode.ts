export class OCPIStatusCode {
  // 1*** SUCCESS
  public static readonly CODE_1000_SUCCESS = new OCPIStatusCode(1000, 'Success');

  // 2*** CLIENT ERROR
  public static readonly CODE_2000_GENERIC_CLIENT_ERROR = new OCPIStatusCode(2000, 'Generic Client Error');
  public static readonly CODE_2001_INVALID_PARAMETER_ERROR = new OCPIStatusCode(2001, 'Invalid or Missing Parameters');
  public static readonly CODE_2002_NOT_ENOUGH_INFORMATION_ERROR = new OCPIStatusCode(2002, 'Not enough information');
  public static readonly CODE_2003_UNKNOWN_LOCATION_ERROR = new OCPIStatusCode(2003, 'Unknown Location');

  // 3*** SERVER ERROR
  public static readonly CODE_3000_GENERIC_SERVER_ERROR = new OCPIStatusCode(3000, 'Generic Server Error');
  public static readonly CODE_3001_UNABLE_TO_USE_CLIENT_API_ERROR = new OCPIStatusCode(3001, 'Unable to Use Client API');
  public static readonly CODE_3002_UNSUPPORTED_VERSION_ERROR = new OCPIStatusCode(3002, 'Unsupported Version');
  public static readonly CODE_3003_NO_MATCHING_ENDPOINTS_ERROR = new OCPIStatusCode(3003, 'No Matching Endpoints');

  // Private to disallow creating other instances of this type
  private constructor(public readonly status_code: number, public readonly status_message: string) {
  }
}
