import { HttpCreateTransactionInvoiceRequest, HttpForceSynchronizeUserInvoicesRequest, HttpSynchronizeUserRequest } from '../../../../../types/requests/HttpUserRequest';

import { HttpBillingInvoiceRequest } from '../../../../../types/requests/HttpBillingRequest';
import HttpByIDRequest from '../../../../../types/requests/HttpByIDRequest';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class BillingSecurity {
  static filterSynchronizeUserRequest(request: any): HttpSynchronizeUserRequest {
    const filteredUser: HttpSynchronizeUserRequest = {} as HttpSynchronizeUserRequest;
    if (request.id) {
      filteredUser.id = sanitize(request.id);
    }
    if (request.email) {
      filteredUser.email = sanitize(request.email);
    }
    return filteredUser;
  }

  static filterGetUserInvoicesRequest(request: any): HttpBillingInvoiceRequest {
    const filteredRequest = {} as HttpBillingInvoiceRequest;
    if (request.UserID) {
      filteredRequest.UserID = sanitize(request.UserID);
    }
    if (request.Status) {
      filteredRequest.Status = sanitize(request.Status);
    }
    if (request.StartDateTime) {
      filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    }
    if (request.EndDateTime) {
      filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    }
    if (request.Search) {
      filteredRequest.Search = sanitize(request.Search);
    }
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterForceSynchronizeUserInvoicesRequest(request: any): HttpForceSynchronizeUserInvoicesRequest {
    return {
      userID: sanitize(request.userID)
    };
  }

  static filterLinkTransactionToInvoiceRequest(request: any): HttpCreateTransactionInvoiceRequest {
    return {
      transactionID: sanitize(request.transactionID)
    };
  }

  static filterDownloadInvoiceRequest(request: any): HttpByIDRequest {
    return {
      ID: sanitize(request.ID)
    };
  }
}
