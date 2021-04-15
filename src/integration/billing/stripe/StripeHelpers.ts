import { BillingAdditionalData, BillingError, BillingErrorCode, BillingErrorType, BillingInvoice, BillingInvoiceItem, BillingOperationResult, BillingSessionData } from '../../../types/Billing';

import BillingStorage from '../../../storage/mongodb/BillingStorage';
import Stripe from 'stripe';

export default class StripeHelpers {

  public static async updateInvoiceAdditionalData(tenantID: string,
      billingInvoice: BillingInvoice,
      operationResult: BillingOperationResult,
      billingInvoiceItem?: BillingInvoiceItem): Promise<void> {
    // Do we have an error to preserve
    let billingError: BillingError;
    if (operationResult && !operationResult.succeeded) {
      // The operation failed
      billingError = StripeHelpers.convertToBillingError(operationResult.error);
    }
    // Do we have a new charging session?
    let session: BillingSessionData;
    if (billingInvoiceItem) {
      session = {
        transactionID: billingInvoiceItem.transactionID,
        description: billingInvoiceItem.description,
        pricingData: billingInvoiceItem.pricingData,
      };
    }
    // Is there anything to update?
    if (session || billingError) {
      const additionalData: BillingAdditionalData = {
        session,
        lastError: billingError
      };
      await BillingStorage.updateInvoiceAdditionalData(tenantID, billingInvoice, additionalData);
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

  public static guessStripeRootCause(error: Stripe.StripeError): { errorType: BillingErrorType, errorCode:BillingErrorCode } {
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
}
