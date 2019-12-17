export interface BillingTransactionData {
  status?: string;
  invoiceStatus?: string;
  invoiceItem?: string;
  lastUpdate?: Date;
}

export interface BillingDataStart {
}

export interface BillingDataUpdate {
  stopTransaction?: boolean;
}

export interface BillingDataStop {
  status?: string;
  invoiceStatus?: string;
  invoiceItem?: string;
}

export interface BillingUserData {
  customerID?: string;
  method?: string;
  cardID?: string;
  subscriptionID?: string;
  lastChangedOn?: Date;
}

export interface BillingPartialUser {
  email: string;
  billingData: {
      customerID: string;
    }
  }
}
