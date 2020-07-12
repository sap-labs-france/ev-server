import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import { BillingInvoice, BillingTax } from '../../../../types/Billing';
import { DataResult } from '../../../../types/DataResult';
import { HttpBillingInvoiceRequest } from '../../../../types/requests/HttpBillingRequest';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import { HttpForceSynchronizeUserInvoicesRequest, HttpSynchronizeUserRequest } from '../../../../types/requests/HttpUserRequest';
import UserToken from '../../../../types/UserToken';
import UserSecurity from './UserSecurity';
import UtilsSecurity from './UtilsSecurity';


export default class BillingSecurity {
  static filterTaxesResponse(taxes: BillingTax[], loggedUser: UserToken): BillingTax[] {
    const filteredTaxes: BillingTax[] = [];
    if (!taxes) {
      return null;
    }
    for (const tax of taxes) {
      // Filter
      const filteredTax = BillingSecurity.filterTaxResponse(tax, loggedUser);
      if (filteredTax) {
        filteredTaxes.push(filteredTax);
      }
    }
    return filteredTaxes;
  }

  static filterTaxResponse(tax: BillingTax, loggedUser: UserToken): BillingTax {
    const filteredTax = {} as BillingTax;
    if (!tax) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadTaxesBilling(loggedUser)) {
      // Set only necessary info
      filteredTax.id = tax.id;
      filteredTax.description = tax.description;
      filteredTax.displayName = tax.displayName;
      filteredTax.percentage = tax.percentage;
    }
    return filteredTax;
  }

  static filterInvoicesResponse(invoices: DataResult<BillingInvoice>, loggedUser: UserToken): void {
    const filteredInvoices: BillingInvoice[] = [];
    if (!invoices) {
      return null;
    }
    for (const invoice of invoices.result) {
      // Filter
      const filteredInvoice = BillingSecurity.filterInvoiceResponse(invoice, loggedUser);
      if (filteredInvoices) {
        filteredInvoices.push(filteredInvoice);
      }
    }
    invoices.result = filteredInvoices;
  }

  static filterInvoiceResponse(invoice: BillingInvoice, loggedUser: UserToken): BillingInvoice {
    const filteredInvoice = {} as BillingInvoice;
    if (!invoice) {
      return null;
    }
    // Check auth
    if (Authorizations.canListInvoicesBilling(loggedUser)) {
      // Set only necessary info
      filteredInvoice.id = invoice.id;
      filteredInvoice.userID = invoice.userID;
      filteredInvoice.number = invoice.number;
      filteredInvoice.status = invoice.status;
      filteredInvoice.amount = invoice.amount;
      filteredInvoice.createdOn = invoice.createdOn;
      filteredInvoice.nbrOfItems = invoice.nbrOfItems;
      filteredInvoice.currency = invoice.currency;
      filteredInvoice.downloadable = invoice.downloadable;
      filteredInvoice.user = UserSecurity.filterMinimalUserResponse(invoice.user, loggedUser);
    }
    return filteredInvoice;
  }

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

  static filterDownloadInvoiceRequest(request: any): HttpByIDRequest {
    return {
      ID: sanitize(request.ID)
    };
  }
}
