require('source-map-support').install();

module.exports = {
  // OCPI Available Response Status
  OCPI_STATUS_CODE: {
    // 1*** SUCCESS
    CODE_1000_SUCCESS: { status_code: 1000, status_message: "Success" },

    // 2*** CLIENT ERROR
    CODE_2000_GENERIC_CLIENT_ERROR: { status_code: 2000, status_message: "Generic Client Error" },
    CODE_2001_INVALID_PARAMETER_ERROR: { status_code: 2001, status_message: "Invalid or Missing Parameters" },
    CODE_2002_NOT_ENOUGH_INFORMATION_ERROR: { status_code: 2002, status_message: "Not enough information" },
    CODE_2003_UNKNOW_LOCATION_ERROR: { status_code: 2003, status_message: "Unknown Location" },

    // 3*** SERVER ERROR
    CODE_3000_GENERIC_SERVER_ERROR: { status_code: 3000, status_message: "Generic Server Error" },
    CODE_3001_UNABLE_TO_USE_CLIENT_API_ERROR: { status_code: 3001, status_message: "Unable to Use Client API" },
    CODE_3002_UNSUPPORTED_VERSION_ERROR: { status_code: 3002, status_message: "Unsupported Version" },
    CODE_3003_NO_MATCHING_ENDPOINTS_ERROR: { status_code: 3003, status_message: "No Matching Endpoints" }
  },

  // OCPI EVSE STATUS
  MAPPING_EVSE_STATUS: {
    "Available": "AVAILABLE",
    "Occupied": "BLOCKED",
    CHARGING: "CHARGING",
    "Faulted": "INOPERATIVE",
    // "Faulted": "OUTOFORDER",
    PLANNED: "PLANNED",
    REMOVED: "REMOVED",
    RESERVED: "RESERVED",
    UNKNOWN: "UNKNOWN"
  },

  // CONNECTOR TYPE
  MAPPING_CONNECTOR_TYPE: {
    "CHADEMO": "CHADEMO",
    "T2": "IEC_62196_T2"
  }

  




}