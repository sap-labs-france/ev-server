export interface BillingTransactionData {
  status?: string;
  invoiceStatus?: string;
  invoiceItem?: string;
  lastUpdate?: Date;
}

export interface BillingDataStart {
  cancelTransaction?: boolean;
}

export interface BillingDataUpdate {
  cancelTransaction?: boolean;
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
  hasSynchroError?: boolean;
}

export interface BillingPartialUser {
  email: string;
  name: string;
  billingData: {
    customerID: string;
  };
}

export interface BillingUserSynchronizeAction {
  synchronized: number;
  error: number;
}

export interface BillingTax {
  id: string;
  description: string;
  displayName: string;
  percentage: number;
}
