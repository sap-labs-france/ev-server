export interface BillingResponse {
  success: boolean;
  message?: string;
}

export interface BillingTransactionData {
  status?: string;
  errorCode?: string;
  errorCodeDesc?: string;
  invoiceStatus?: string;
  invoiceItem?: string;
  lastUpdate?: Date;
}

export interface BillingDataStart {
  errorCode?: string;
  errorCodeDesc?: string;
}

export interface BillingDataUpdate {
  errorCode?: string;
  errorCodeDesc?: string;
  stopTransaction?: boolean;
}

export interface BillingDataStop {
  status?: string;
  errorCode?: string;
  errorCodeDesc?: string;
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

export interface Tax {
  countryCode: string;
  taxCode: string;
  standard: number;
  reduced: number[];
  allowZero: boolean;
}
