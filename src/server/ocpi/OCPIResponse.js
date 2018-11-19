const OCPIConstants = require("./OCPIConstants");
const OCPIClientError = require("./exception/OCPIClientError");
const OCPIServerError = require("./exception/OCPIServerError");
require('source-map-support').install();

/**
 * OCPI JSON Response
 */
class OCPIResponse {

  /**
   * 
   * @param {*} Array or Object or String
   * @param {*} status_code OCPI Status Code from OCPI Constant RESP*
   * @param {*} status_message optional message
   */
  constructor(data = {}, status = OCPIConstants.OCPI_STATUS_CODE.CODE_1000_SUCCESS, additionalMessage) {
    this._data = data;
    this._status_code = status.status_code;

    if (additionalMessage) {
      this._status_message = `${status.status_message} - ${additionalMessage}`;
    } else {
      this._status_message = status.status_message;
    }
  }

  /**
   * Return Success Body Response
   * @param {*} data 
   */
  static success(data) {
    return {
      "data": data,
      "status_code": OCPIConstants.OCPI_STATUS_CODE.CODE_1000_SUCCESS.status_code,
      "status_message": OCPIConstants.OCPI_STATUS_CODE.CODE_1000_SUCCESS.status_message,
      "timestamp": new Date().toISOString()
    }
  }

  /**
   * Return Error Body Response
   * @param {*} error 
   */
  static error(error) {
    const errorBody = {
      "status_message": error.message,
      "timestamp": new Date().toISOString()
    };

    // check type of OCPI error Client vs Server
    if (error instanceof OCPIClientError) {
      errorBody.status_code = OCPIConstants.OCPI_STATUS_CODE.CODE_2000_GENERIC_CLIENT_ERROR.status_code;
    } else if (error instanceof OCPIServerError) {
      errorBody.status_code = OCPIConstants.OCPI_STATUS_CODE.CODE_3000_GENERIC_SERVER_ERROR.status_code;
    }

    // return error Body
    return errorBody;
  }

  toString() {
    return {
      "data": this._data,
      "status_code": this._status_code,
      "status_message": this._status_message,
      "timestamp": new Date().toISOString()
    }
  }


}

module.exports = OCPIResponse;