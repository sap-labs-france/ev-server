const OCPIConstants = require("./OCPIConstants");
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