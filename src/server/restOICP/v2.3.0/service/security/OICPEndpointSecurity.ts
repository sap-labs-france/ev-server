import OICPEndpoint from '../../../../../types/oicp/OICPEndpoint';
import sanitize from 'mongo-sanitize';

export default class OICPEndpointSecurity {
  static filterOicpEndpointCreateRequest(request: any): Partial<OICPEndpoint> {
    return OICPEndpointSecurity._filterOicpEndpointRequest(request);
  }

  static filterOicpEndpointPingRequest(request: any): Partial<OICPEndpoint> {
    const filteredRequest = OICPEndpointSecurity._filterOicpEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOicpEndpointTriggerJobRequest(request: any): Partial<OICPEndpoint> {
    const filteredRequest = OICPEndpointSecurity._filterOicpEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOicpEndpointSendEVSEStatusesRequest(request: any): Partial<OICPEndpoint> {
    const filteredRequest = OICPEndpointSecurity._filterOicpEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOicpEndpointSendEVSEsRequest(request: any): Partial<OICPEndpoint> {
    const filteredRequest = OICPEndpointSecurity._filterOicpEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static _filterOicpEndpointRequest(request: any): Partial<OICPEndpoint> {
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
