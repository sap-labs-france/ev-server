const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../authorization/Authorizations');
const UtilsSecurity = require('./UtilsSecurity');

class OCPIEndpointSecurity {
  // eslint-disable-next-line no-unused-vars
  static filterOcpiendpointDeleteRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterOcpiendpointRequest(request, loggedUser) {
    const filteredRequest = {};
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterOcpiendpointsRequest(request, loggedUser) {
    const filteredRequest = {};
    filteredRequest.Search = sanitize(request.Search);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterOcpiendpointUpdateRequest(request, loggedUser) {
    // Set Ocpiendpoint
    const filteredRequest = OCPIEndpointSecurity._filterOcpiendpointRequest(request, loggedUser);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOcpiendpointCreateRequest(request, loggedUser) {
    return OCPIEndpointSecurity._filterOcpiendpointRequest(request, loggedUser);
  }

  static filterOcpiendpointPingRequest(request, loggedUser) {
    return OCPIEndpointSecurity._filterOcpiendpointRequest(request, loggedUser);
  }

  static filterOcpiendpointSendEVSEStatusesRequest(request, loggedUser) {
    // set ocpiendpoint
    const filteredRequest = OCPIEndpointSecurity._filterOcpiendpointRequest(request, loggedUser);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }
  
  static filterOcpiendpointRegisterRequest(request, loggedUser) {
    // Set Ocpiendpoint
    const filteredRequest = OCPIEndpointSecurity._filterOcpiendpointRequest(request, loggedUser);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOcpiendpointGenerateLocalTokenRequest(request, loggedUser) {
    return OCPIEndpointSecurity._filterOcpiendpointRequest(request, loggedUser);
  }

  // eslint-disable-next-line no-unused-vars
  static _filterOcpiendpointRequest(request, loggedUser) {
    const filteredRequest = {};
    filteredRequest.name = sanitize(request.name);
    filteredRequest.baseUrl = sanitize(request.baseUrl);
    filteredRequest.countryCode = sanitize(request.countryCode);
    filteredRequest.partyId = sanitize(request.partyId);
    filteredRequest.localToken = sanitize(request.localToken);
    filteredRequest.token = sanitize(request.token);
    filteredRequest.backgroundPatchJob = sanitize(request.backgroundPatchJob);
    return filteredRequest;
  }

  static filterOcpiendpointResponse(ocpiendpoint, loggedUser) {
    let filteredOcpiendpoint;

    if (!ocpiendpoint) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadOcpiendpoint(loggedUser, ocpiendpoint)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser)) {
        // Yes: set all params
        filteredOcpiendpoint = ocpiendpoint;
      } else {
        // Set only necessary info
        return null;
      }

      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredOcpiendpoint, ocpiendpoint, loggedUser);
    }
    return filteredOcpiendpoint;
  }

  static filterOcpiendpointsResponse(ocpiendpoints, loggedUser) {
    const filteredOcpiendpoints = [];

    if (!ocpiendpoints) {
      return null;
    }
    if (!Authorizations.canListOcpiendpoints(loggedUser)) {
      return null;
    }
    for (const ocpiendpoint of ocpiendpoints) {
      // Filter
      const filteredOcpiendpoint = OCPIEndpointSecurity.filterOcpiendpointResponse(ocpiendpoint, loggedUser);
      // Ok?
      if (filteredOcpiendpoint) {
        // Add
        filteredOcpiendpoints.push(filteredOcpiendpoint);
      }
    }
    return filteredOcpiendpoints;
  }
}

module.exports = OCPIEndpointSecurity;
