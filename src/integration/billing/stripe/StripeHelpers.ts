import { BillingError, BillingErrorCode, BillingErrorType, BillingInvoice, BillingInvoiceItem, BillingSessionData } from '../../../types/Billing';

import Constants from '../../../utils/Constants';
import Countries from 'i18n-iso-countries';
import I18nManager from '../../../utils/I18nManager';
import Stripe from 'stripe';
import User from '../../../types/User';
import Utils from '../../../utils/Utils';

export interface StripeChargeOperationResult {
  succeeded: boolean
  error?: Error
  invoice?: Stripe.Invoice // the invoice after the payment attempt
}

export default class StripeHelpers {

  public static enrichInvoiceWithAdditionalData(billingInvoice: BillingInvoice, operationResult: StripeChargeOperationResult, billingInvoiceItem?: BillingInvoiceItem): void {
    if (operationResult && !operationResult.succeeded) {
    // The operation failed
      const billingError = StripeHelpers.convertToBillingError(operationResult.error);
      if (billingError) {
        billingInvoice.lastError = billingError;
      }
    }
    if (billingInvoiceItem) {
      const session: BillingSessionData = {
        transactionID: billingInvoiceItem.transactionID,
        pricingData: billingInvoiceItem.pricingData,
        accountData: billingInvoiceItem.accountData,
      };
      if (billingInvoice.sessions) {
        billingInvoice.sessions.push(session);
      } else {
        billingInvoice.sessions = [ session ];
      }
    }
  }

  public static convertToBillingError(error: Error): BillingError {
    // Let's extract the data that we might be interested in
    const { errorCode, errorType } = StripeHelpers.guessRootCause(error);
    const rootCause = StripeHelpers.shrinkRootCause(error);
    // Wrap it in a format that we can consume!
    return {
      message: error.message,
      when: new Date(),
      errorType,
      errorCode,
      rootCause,
    };
  }

  public static guessRootCause(error: Error): { errorType: BillingErrorType, errorCode:BillingErrorCode } {
    if (error instanceof Stripe.errors.StripeError) {
      return StripeHelpers.guessStripeRootCause(error);
    }
    // Well this is not a STRIPE error
    return {
      errorType: BillingErrorType.APPLICATION_ERROR,
      errorCode: BillingErrorCode.UNKNOWN_ERROR
    };
  }

  public static guessStripeRootCause(error: Stripe.errors.StripeError): { errorType: BillingErrorType, errorCode:BillingErrorCode } {
    let errorType: BillingErrorType, errorCode: BillingErrorCode;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { statusCode, type, rawType, code, decline_code, } = error ;
    // ----------------------------------------------------------------------------
    // statusCode potential values: https://stripe.com/docs/api/errors
    // ----------------------------------------------------------------------------
    if (statusCode >= 500) {
      errorType = BillingErrorType.PLATFORM_SERVER_ERROR;
      errorCode = BillingErrorCode.UNEXPECTED_ERROR;
    } else {
      errorType = BillingErrorType.PLATFORM_APPLICATION_ERROR;
      errorCode = BillingErrorCode.UNKNOWN_ERROR;
    }
    // ----------------------------------------------------------------------------
    // TODO - Extract from the root cause the information that we need!
    // type: c.f.: https://stripe.com/docs/api/errors/handling
    // code: c.f.: https://stripe.com/docs/error-codes
    // declineCode: c,f. https://stripe.com/docs/api/payouts/failures
    // ----------------------------------------------------------------------------
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      if (code === 'missing') {
        // https://stripe.com/docs/error-codes#missing
        errorCode = BillingErrorCode.NO_PAYMENT_METHOD;
      }
    } else if (error instanceof Stripe.errors.StripeCardError) {
      errorType = BillingErrorType.PLATFORM_PAYMENT_ERROR;
      errorCode = BillingErrorCode.CARD_ERROR;
    }
    // Let's return what we could determine as being the root cause!
    return {
      errorType,
      errorCode
    };
  }

  public static shrinkRootCause(error: Error): unknown {
    // Reduce the size of the data that we save on our side!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shrinkError: any = { ...error };
    if (error instanceof Stripe.errors.StripeError) {
      // Get rid of some properties
      delete shrinkError.headers;
      delete shrinkError.raw;
    }
    // Remove null and undefined properties
    Object.keys(shrinkError).forEach((key) => {
      const value = shrinkError[key];
      // eslint-disable-next-line no-undefined
      if (value === undefined || value === null) {
        delete shrinkError[key];
      }
    });
    return shrinkError;
  }

  public static async isConnectedToALiveAccount(stripeFacade: Stripe): Promise<boolean> {
    // TODO - find a way to avoid that call
    const list = await stripeFacade.customers.list({ limit: 1 });
    return !!list.data?.[0]?.livemode;
  }

  public static buildCustomerCommonProperties(user: User): { name: string, description: string, preferred_locales: string[], email: string, address: Stripe.Address } {
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customer: any = {
      name: Utils.buildUserFullName(user, false, false),
      description: i18nManager.translate('billing.generatedUser', { email: user.email }),
      preferred_locales: [ Utils.getLanguageFromLocale(user.locale) ],
      email: user.email,
    };
    // Assign the address (if any)
    if (user.address) {
      customer.address = StripeHelpers.buildStripeAddress(user);
    }
    return customer;
  }

  public static buildBillingDetails(user: User): Stripe.PaymentMethodUpdateParams.BillingDetails {
    const billingDetails: Stripe.PaymentMethodUpdateParams.BillingDetails = {
      name: Utils.buildUserFullName(user, false, false),
      email: user.email,
      /* phone: user.phone, */
    };
    const address = StripeHelpers.buildStripeAddress(user);
    if (address) {
      billingDetails.address = address;
    }
    return billingDetails;
  }

  public static buildStripeAddress(user: User): Stripe.Address {
    if (!user.address?.country) {
      // Stripe does not support addresses where the country is not set!
      return null;
    }
    const { address1: line1, address2: line2, postalCode: postal_code, city, /* department, */ region, country } = user.address;
    const countryAlpha2Code = StripeHelpers.getAlpha2CountryCode(country, user?.locale);
    const address: Stripe.Address = {
      line1,
      line2,
      postal_code,
      city,
      state: region,
      country: countryAlpha2Code // Stripe may throw exceptions when the country code is inconsistent! - null is supported
    };
    return address;
  }

  public static getAlpha2CountryCode(countryName: string, locale: string): string {
    // -----------------------------------------------------------------
    // Stripe expects a Two-letter country code (ISO 3166-1 alpha-2)
    // -----------------------------------------------------------------
    let countryCode: string = null;
    countryName = countryName?.trim();
    if (countryName) {
      if (locale) {
        // Try it with the user language
        const lang = Utils.getLanguageFromLocale(locale);
        countryCode = Countries.getAlpha2Code(countryName, lang); // converts 'Deutschland' to 'DE' when lang is 'de'
      }
      if (!countryCode && locale !== Constants.DEFAULT_LOCALE) {
        // Fallback - try it again with the default language
        countryCode = Countries.getAlpha2Code(countryName, Constants.DEFAULT_LANGUAGE); // converts 'Germany' to 'DE' when lang is 'en'
      }
    }
    return countryCode;
  }

  public static isResourceMissingError(error: any): boolean {
    // TODO - Find a better way to handle such specific Stripe Errors
    return (error.statusCode === 404 && error.code === 'resource_missing');
  }
}
