import Authorizations from '../../../../authorization/Authorizations';
import { BillingTax } from '../../../../types/Billing';
import UserToken from '../../../../types/UserToken';

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
}
