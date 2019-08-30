import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import UtilsSecurity from './UtilsSecurity';

export default class OCPIEndpointSecurity {
  // eslint-disable-next-line no-unused-vars
  static filterOcpiEndpointDeleteRequest(request: any) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterOcpiEndpointRequest(request: any) {
    const filteredRequest: any = {};
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  public static filterOcpiEndpointsRequest(request: any) {
    const filteredRequest: any = {};
    filteredRequest.Search = sanitize(request.Search);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterOcpiEndpointUpdateRequest(request: any) {
    // Set OcpiEndpoint
    const filteredRequest = OCPIEndpointSecurity._filterOcpiEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOcpiEndpointCreateRequest(request: any) {
    return OCPIEndpointSecurity._filterOcpiEndpointRequest(request);
  }

  static filterOcpiEndpointPingRequest(request: any) {
    return OCPIEndpointSecurity._filterOcpiEndpointRequest(request);
  }

  static filterOcpiEndpointSendEVSEStatusesRequest(request: any) {
    // Set OcpiEndpoint
    const filteredRequest = OCPIEndpointSecurity._filterOcpiEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOcpiEndpointRegisterRequest(request: any) {
    // Set OcpiEndpoint
    const filteredRequest = OCPIEndpointSecurity._filterOcpiEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOcpiEndpointGenerateLocalTokenRequest(request: any) {
    return OCPIEndpointSecurity._filterOcpiEndpointRequest(request);
  }

  // eslint-disable-next-line no-unused-vars
  static _filterOcpiEndpointRequest(request: any) {
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

  static filterOcpiEndpointResponse(ocpiEndpoint, loggedUser) {
    let filteredOcpiEndpoint;

    if (!ocpiEndpoint) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadOcpiEndpoint(loggedUser)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser.role)) {
        // Yes: set all params
        filteredOcpiEndpoint = ocpiEndpoint;
      } else {
        // Set only necessary info
        return null;
      }
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredOcpiEndpoint, ocpiEndpoint, loggedUser);
    }
    return filteredOcpiEndpoint;
  }

  static filterOcpiEndpointsResponse(ocpiEndpoints, loggedUser) {
    const filteredOcpiEndpoints = [];

    if (!ocpiEndpoints) {
      return null;
    }
    if (!Authorizations.canListOcpiEndpoints(loggedUser)) {
      return null;
    }
    for (const ocpiendpoint of ocpiEndpoints) {
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

