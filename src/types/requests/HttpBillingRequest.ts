import { BillingInvoiceStatus } from '../Billing';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpBillingRequest {
}


export interface HttpBillingInvoiceRequest extends HttpDatabaseRequest {
  UserIDs?: string;
  Status?: BillingInvoiceStatus;
  StartDateTime?: Date;
  EndDateTime?: Date;
  Search?: string;
}
