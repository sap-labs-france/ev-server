const Constants = require("../../utils/Constants");
const OCPIClientError = require("../../exception/OCPIClientError");
const OCPIServerError = require("../../exception/OCPIServerError");
require('source-map-support').install();

/**
 * OCPI Utils
 */
class OCPIUtils {

  /**
   * Return OCPI Success Body Response
   * @param {*} data 
   */
  static success(data) {
    return {
      "data": data,
      "status_code": Constants.OCPI_STATUS_CODE.CODE_1000_SUCCESS.status_code,
      "status_message": Constants.OCPI_STATUS_CODE.CODE_1000_SUCCESS.status_message,
      "timestamp": new Date().toISOString()
    }
  }

  /**
   * Return OCPI Error Body Response
   * @param {*} error 
   */
  static error(error) {
    const errorBody = {
      "status_message": error.message,
      "timestamp": new Date().toISOString()
    };

    // check type of OCPI error Client vs Server
    if (error instanceof OCPIClientError) {
      errorBody.status_code = error.ocpiError.status_code;
    } else if (error instanceof OCPIServerError) {
      errorBody.status_code = error.ocpiError.status_code;
    }

    // return error Body
    return errorBody;
  }



}

module.exports = OCPIUtils;