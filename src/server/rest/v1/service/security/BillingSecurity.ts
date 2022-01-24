import { HttpBillingInvoiceRequest, HttpBillingRequest, HttpBillingWebHookRequest, HttpDeletePaymentMethod, HttpPaymentMethods, HttpSetupPaymentIntent, HttpSetupPaymentMethod } from '../../../../../types/requests/HttpBillingRequest';
import { HttpCreateTransactionInvoiceRequest, HttpForceSynchronizeUserInvoicesRequest, HttpSynchronizeUserRequest } from '../../../../../types/requests/HttpUserRequest';

import Utils from '../../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class BillingSecurity {
  public static filterSynchronizeUserRequest(requestBody: any): HttpSynchronizeUserRequest {
    const filteredUser: HttpSynchronizeUserRequest = {} as HttpSynchronizeUserRequest;
    if (Utils.objectHasProperty(requestBody, 'id')) {
      filteredUser.id = sanitize(requestBody.id);
    }
    if (Utils.objectHasProperty(requestBody, 'email')) {
      filteredUser.email = sanitize(requestBody.email);
    }
    return filteredUser;
  }

  public static filterGetInvoicesRequest(requestQuery: any): HttpBillingInvoiceRequest {
    const filteredRequest = {} as HttpBillingInvoiceRequest;
    if (Utils.objectHasProperty(requestQuery, 'UserID')) {
      filteredRequest.UserID = sanitize(requestQuery.UserID);
    }
    if (Utils.objectHasProperty(requestQuery, 'Status')) {
      filteredRequest.Status = sanitize(requestQuery.Status);
    }
    if (Utils.objectHasProperty(requestQuery, 'StartDateTime')) {
      filteredRequest.StartDateTime = sanitize(requestQuery.StartDateTime);
    }
    if (Utils.objectHasProperty(requestQuery, 'EndDateTime')) {
      filteredRequest.EndDateTime = sanitize(requestQuery.EndDateTime);
    }
    if (Utils.objectHasProperty(requestQuery, 'Search')) {
      filteredRequest.Search = sanitize(requestQuery.Search);
    }
    UtilsSecurity.filterSkipAndLimit(requestQuery, filteredRequest);
    UtilsSecurity.filterSort(requestQuery, filteredRequest);
    return filteredRequest;
  }

  public static filterGetInvoiceRequest(requestQuery: any): HttpBillingInvoiceRequest {
    return {
      ID: sanitize(requestQuery.ID)
    } as HttpBillingInvoiceRequest;
  }

  public static filterForceSynchronizeUserInvoicesRequest(requestBody: any): HttpForceSynchronizeUserInvoicesRequest {
    return {
      userID: sanitize(requestBody.userID)
    };
  }

  public static filterLinkTransactionToInvoiceRequest(requestBody: any): HttpCreateTransactionInvoiceRequest {
    return {
      transactionID: sanitize(requestBody.transactionID)
    };
  }

  public static filterDownloadInvoiceRequest(requestQuery: any): HttpBillingRequest {
    return {
      ID: sanitize(requestQuery.ID)
    };
  }

  public static filterBillingWebHookRequest(requestQuery: any): HttpBillingWebHookRequest {
    return {
      tenantID: sanitize(requestQuery.TenantID)
    };
  }

  public static filterSetupPaymentMethodRequest(requestBody: any): HttpSetupPaymentMethod {
    return {
      userID: sanitize(requestBody.userID),
      paymentMethodId: sanitize(requestBody.paymentMethodId),
      keepDefaultUnchanged: sanitize(requestBody.keepDefaultUnchanged),
    };
  }

  public static filterPaymentMethodsRequest(requestQuery: any): HttpPaymentMethods {
    const filteredRequest: HttpPaymentMethods = {
      userID: sanitize(requestQuery.userID)
    };
    UtilsSecurity.filterSkipAndLimit(requestQuery, filteredRequest);
    return filteredRequest;
  }

  public static filterDeletePaymentMethodRequest(requestBody: any): HttpDeletePaymentMethod {
    return {
      userID: sanitize(requestBody.userID),
      paymentMethodId: sanitize(requestBody.paymentMethodId),
    };
  }

  static filterInvoicePaymentRequest(requestQuery: any): HttpSetupPaymentIntent {
    return {
      userID: sanitize(requestQuery.userID),
      invoiceID: sanitize(requestQuery.invoiceID),
      paymentMethodID: sanitize(requestQuery.paymentMethodID)
    };
  }
}
