import Authorizations from '../../../../authorization/Authorizations';
import { BillingTax } from '../../../../types/Billing';
import UserToken from '../../../../types/UserToken';
import User from "../../../../types/User";
import sanitize from "mongo-sanitize";
import {HttpUserRequest} from "../../../../types/requests/HttpUserRequest";

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
    const filteredTax: BillingTax = {} as BillingTax;
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

  static filterSynchronizeUserRequest(request: any): Partial<HttpUserRequest> {
    const filteredUser: Partial<HttpUserRequest> = {};
    if (request.UserID) {
      filteredUser.id = sanitize(request.UserID);
    }
    return filteredUser;
  }
}
