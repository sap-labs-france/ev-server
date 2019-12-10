import { HttpBillingRequest } from '../../../../types/requests/HttpBillingRequest';
import sanitize from 'mongo-sanitize';

export default class BillingSecurity {
  static filterBillingRequest(request: any): HttpBillingRequest {
    const filteredRequest = {} as HttpBillingRequest;

    if (request.user && request.user.tenantID) {
      filteredRequest.tenantID = sanitize(request.user.tenantID);
    }

    return filteredRequest;
  }
}
