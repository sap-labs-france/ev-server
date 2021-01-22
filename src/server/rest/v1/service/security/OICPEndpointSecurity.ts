import { HttpOICPEndpointsRequest } from '../../../../../types/requests/HttpOICPEndpointRequest';
import OICPEndpoint from '../../../../../types/oicp/OICPEndpoint';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class OICPEndpointSecurity {
  static filterOicpEndpointDeleteRequest(request: any): HttpOICPEndpointsRequest {
    const filteredRequest: HttpOICPEndpointsRequest = {} as HttpOICPEndpointsRequest;
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  static filterOicpEndpointRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  static filterOicpEndpointUpdateRequest(request: any): Partial<OICPEndpoint> {
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOicpEndpointCreateRequest(request: any): Partial<OICPEndpoint> {
    return OICPEndpointSecurity.filterOicpEndpointRequest(request);
  }

  public static filterOicpEndpointsRequest(request: any): Partial<HttpOICPEndpointsRequest> {
    const filteredRequest: Partial<HttpOICPEndpointsRequest> = {
      Search: sanitize(request.Search)
    };
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterOicpEndpointPingRequest(request: any): Partial<OICPEndpoint> {
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOicpEndpointTriggerJobRequest(request: any): Partial<OICPEndpoint> {
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOicpEndpointSendEVSEStatusesRequest(request: any): Partial<OICPEndpoint> {
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOicpEndpointSendEVSEsRequest(request: any): Partial<OICPEndpoint> {
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOicpEndpointRegisterRequest(request: any): Partial<OICPEndpoint> {
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  private static filterOicpEndpointRequest(request: any): Partial<OICPEndpoint> {
    const filteredRequest: Partial<OICPEndpoint> = {};
    filteredRequest.name = sanitize(request.name);
    filteredRequest.role = sanitize(request.role);
    filteredRequest.baseUrl = sanitize(request.baseUrl);
    filteredRequest.countryCode = sanitize(request.countryCode);
    filteredRequest.partyId = sanitize(request.partyId);
    filteredRequest.backgroundPatchJob = sanitize(request.backgroundPatchJob);
    return filteredRequest;
  }
}
