import { BillingInvoice, BillingOperationResult } from '../../../types/Billing';

import BillingStorage from '../../../storage/mongodb/BillingStorage';
import Stripe from 'stripe';

export interface BillingError {
  message: string
  statusCode: number,
  context?: unknown; // e.g.: payment ==> last_payment_error
}

export default class StripeHelpers {

  public static async handleStripeOperationResult(tenantID: string, billingInvoice: BillingInvoice, operationResult: BillingOperationResult): Promise<void> {
    if (!billingInvoice || !operationResult) {
      return;
    }
    if (!operationResult.succeeded) {
      // The last operation failed
      const error = operationResult.error;
      if (error instanceof Stripe.errors.StripeCardError) {
        // The attempt to pay the invoice failed
        const billingError: BillingError = StripeHelpers.shrinkStripeError(error);
        await BillingStorage.saveLastPaymentFailure(tenantID, billingInvoice.id, billingError);
      }
    }
  }

  public static shrinkStripeError(error: Stripe.StripeCardError): BillingError {
    // Let's extract the data that we might be interested in
    const { statusCode, type, rawType, message, code, decline_code, payment_intent, payment_method, payment_method_type } = error ;
    // Wrap it in a format that we can consume!
    return {
      message,
      statusCode, // c.f.: https://stripe.com/docs/api/errors
      context: {
        type,
        rawType,
        code,
        declineCode: decline_code,
        paymentIntentID: payment_intent?.id,
        paymentMethodID: payment_method?.id,
        paymentMethodType: payment_method_type
      }
    };
  }
}
