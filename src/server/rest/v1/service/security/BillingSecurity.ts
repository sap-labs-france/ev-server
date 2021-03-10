import { HttpCreateTransactionInvoiceRequest, HttpForceSynchronizeUserInvoicesRequest, HttpSynchronizeUserRequest } from '../../../../../types/requests/HttpUserRequest';

import { HttpBillingInvoiceRequest } from '../../../../../types/requests/HttpBillingRequest';
import HttpByIDRequest from '../../../../../types/requests/HttpByIDRequest';
import Utils from '../../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class BillingSecurity {
  static filterSynchronizeUserRequest(request: any): HttpSynchronizeUserRequest {
    const filteredUser: HttpSynchronizeUserRequest = {} as HttpSynchronizeUserRequest;
    if (Utils.objectHasProperty(request, 'id')) {
      filteredUser.id = sanitize(request.id);
    }
    if (Utils.objectHasProperty(request, 'email')) {
      filteredUser.email = sanitize(request.email);
    }
    return filteredUser;
  }

  static filterGetUserInvoicesRequest(request: any): HttpBillingInvoiceRequest {
    const filteredRequest = {} as HttpBillingInvoiceRequest;
    if (Utils.objectHasProperty(request, 'UserID')) {
      filteredRequest.UserID = sanitize(request.UserID);
    }
    if (Utils.objectHasProperty(request, 'Status')) {
      filteredRequest.Status = sanitize(request.Status);
    }
    if (Utils.objectHasProperty(request, 'StartDateTime')) {
      filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    }
    if (Utils.objectHasProperty(request, 'EndDateTime')) {
      filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    }
    if (Utils.objectHasProperty(request, 'Search')) {
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
