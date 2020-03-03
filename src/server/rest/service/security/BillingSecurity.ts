import { BillingInvoice, BillingTax } from '../../../../types/Billing';
import { HttpGetUserInvoicesRequest, HttpSynchronizeUserRequest } from '../../../../types/requests/HttpUserRequest';
import Authorizations from '../../../../authorization/Authorizations';
import UserToken from '../../../../types/UserToken';
import sanitize from 'mongo-sanitize';

export default class BillingSecurity {
  static filterTaxesResponse(taxes: BillingTax[], loggedUser: UserToken): BillingTax[] {
    const filteredTaxes = [];
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
    if (Authorizations.canReadBillingTaxes(loggedUser)) {
      // Set only necessary info
      filteredTax.id = tax.id;
      filteredTax.description = tax.description;
      filteredTax.displayName = tax.displayName;
      filteredTax.percentage = tax.percentage;
    }
    return filteredTax;
  }

  static filterInvoicesResponse(invoices: BillingInvoice[], loggedUser: UserToken): BillingInvoice[] {
    const filteredInvoices = [];
    if (!invoices) {
      return null;
    }
    for (const invoice of invoices) {
      // Filter
      const filteredInvoice = BillingSecurity.filterInvoiceResponse(invoice, loggedUser);
      if (filteredInvoices) {
        filteredInvoices.push(filteredInvoice);
      }
    }
    return filteredInvoices;
  }

  static filterInvoiceResponse(invoice: BillingInvoice, loggedUser: UserToken): BillingInvoice {
    const filteredInvoice = {} as BillingInvoice;
    if (!invoice) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadBillingInvoices(loggedUser)) {
      // Set only necessary info
      filteredInvoice.id = invoice.id;
      filteredInvoice.number = invoice.number;
      filteredInvoice.status = invoice.status;
      filteredInvoice.amountDue = invoice.amountDue;
      filteredInvoice.createdOn = invoice.createdOn;
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

  static filterGetUserInvoicesRequest(request: any): HttpGetUserInvoicesRequest {
    const filteredRequest = {} as HttpGetUserInvoicesRequest;
    if (request.Status) {
      filteredRequest.status = sanitize(request.Status);
    }
    return filteredRequest;
  }
}
