import HttpDatabaseRequest from "./HttpDatabaseRequest";
import { BillingInvoiceStatus } from "../Billing";

export interface HttpBillingRequest {
}


export interface HttpBillingInvoiceRequest extends HttpDatabaseRequest {
  Status?: BillingInvoiceStatus;
  StartDateTime?: Date;
  EndDateTime?: Date;
  Search?: string;
}
