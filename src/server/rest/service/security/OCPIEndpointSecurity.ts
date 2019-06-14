import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import UtilsSecurity from './UtilsSecurity';

export default class OCPIEndpointSecurity {
  // eslint-disable-next-line no-unused-vars
  static filterOcpiEndpointDeleteRequest(request, loggedUser) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterOcpiEndpointRequest(request, loggedUser) {
    const filteredRequest: any = {};
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  public static filterOcpiEndpointsRequest(request, loggedUser) {
    const filteredRequest: any = {};
    filteredRequest.Search = sanitize(request.Search);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterOcpiEndpointUpdateRequest(request, loggedUser) {
    // Set OcpiEndpoint
    const filteredRequest = OCPIEndpointSecurity._filterOcpiEndpointRequest(request, loggedUser);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOcpiEndpointCreateRequest(request, loggedUser) {
    return OCPIEndpointSecurity._filterOcpiEndpointRequest(request, loggedUser);
  }

  static filterOcpiEndpointPingRequest(request, loggedUser) {
    return OCPIEndpointSecurity._filterOcpiEndpointRequest(request, loggedUser);
  }

  static filterOcpiEndpointSendEVSEStatusesRequest(request, loggedUser) {
    // set ocpiendpoint
    const filteredRequest = OCPIEndpointSecurity._filterOcpiEndpointRequest(request, loggedUser);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }
  
  static filterOcpiEndpointRegisterRequest(request, loggedUser) {
    // Set OcpiEndpoint
    const filteredRequest = OCPIEndpointSecurity._filterOcpiEndpointRequest(request, loggedUser);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOcpiEndpointGenerateLocalTokenRequest(request, loggedUser) {
    return OCPIEndpointSecurity._filterOcpiEndpointRequest(request, loggedUser);
  }

  // eslint-disable-next-line no-unused-vars
  static _filterOcpiEndpointRequest(request, loggedUser) {
    const filteredRequest: any = {};
    filteredRequest.name = sanitize(request.name);
    filteredRequest.baseUrl = sanitize(request.baseUrl);
    filteredRequest.countryCode = sanitize(request.countryCode);
    filteredRequest.partyId = sanitize(request.partyId);
    filteredRequest.localToken = sanitize(request.localToken);
    filteredRequest.token = sanitize(request.token);
    filteredRequest.backgroundPatchJob = sanitize(request.backgroundPatchJob);
    return filteredRequest;
  }

  static filterOcpiEndpointResponse(ocpiendpoint, loggedUser) {
    let filteredOcpiEndpoint;

    if (!ocpiendpoint) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadOcpiEndpoint(loggedUser, ocpiendpoint)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser)) {
        // Yes: set all params
        filteredOcpiEndpoint = ocpiendpoint;
      } else {
        // Set only necessary info
        return null;
      }

      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredOcpiEndpoint, ocpiendpoint, loggedUser);
    }
    return filteredOcpiEndpoint;
  }

  static filterOcpiEndpointsResponse(ocpiendpoints, loggedUser) {
    const filteredOcpiEndpoints = [];

    if (!ocpiendpoints) {
      return null;
    }
    if (!Authorizations.canListOcpiEndpoints(loggedUser)) {
      return null;
    }
    for (const ocpiendpoint of ocpiendpoints) {
      // Filter
      const filteredOcpiEndpoint = OCPIEndpointSecurity.filterOcpiEndpointResponse(ocpiendpoint, loggedUser);
      // Ok?
      if (filteredOcpiEndpoint) {
        // Add
        filteredOcpiEndpoints.push(filteredOcpiEndpoint);
      }
    }
    return filteredOcpiEndpoints;
  }
}


