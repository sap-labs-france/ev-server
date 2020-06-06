import { ChargePointStatus, OCPPNormalizedMeterValue } from './ocpp/OCPPServer';

import { BillingTransactionData } from './Billing';
import ChargingStation from '../types/ChargingStation';
import { OCPICdr } from './ocpi/OCPICdr';
import { OCPISession } from './ocpi/OCPISession';
import { RefundTransactionData } from './Refund';
import User from './User';

export type InactivityStatusLevel =
 'info' |
 'warning' |
 'danger'
;

export enum InactivityStatus {
  INFO = 'I',
  WARNING = 'W',
  ERROR = 'E'
}

export enum TransactionAction {
  START = 'start',
  UPDATE = 'update',
  STOP = 'stop'
}

export default interface Transaction {
  id?: number;
  siteID?: string;
  siteAreaID?: string;
  issuer: boolean;
  connectorId: number;
  tagID: string;
  userID: string;
  chargeBoxID: string;
  signedData?: any;
  user?: User;
  stop?: {
    tagID: string;
    userID: string;
    user?: User;
    meterStop: number;
    price?: number;
    roundedPrice?: number;
    priceUnit?: string;
    pricingSource?: string;
    stateOfCharge: number;
    totalInactivitySecs: number;
    extraInactivitySecs?: number;
    extraInactivityComputed?: boolean;
    totalConsumptionWh: number;
    totalDurationSecs: number;
    inactivityStatus?: InactivityStatus;
    timestamp: Date;
    transactionData?: any;
    signedData?: any;
  };
  remotestop?: {
    timestamp: Date;
    tagID: string;
    userID: string;
  };
  refundData?: RefundTransactionData;
  lastMeterValue?: Partial<OCPPNormalizedMeterValue>;
  chargeBox?: ChargingStation;
  meterStart: number;
  timestamp: Date;
  price?: number;
  roundedPrice?: number;
  priceUnit?: string;
  pricingSource?: string;
  stateOfCharge: number;
  timezone: string;
  lastUpdate?: Date;
  currentTotalInactivitySecs: number;
  currentInactivityStatus?: InactivityStatus;
  currentStateOfCharge: number;
  currentTotalDurationSecs?: number;
  status?: ChargePointStatus;
  numberOfMeterValues: number;
  currentInstantWatts: number;
  currentConsumptionWh?: number;
  currentCumulatedPrice?: number;
  currentTotalConsumptionWh: number;
  currentSignedData?: string;
  uniqueId?: string;
  values?: TransactionConsumption[];
  billingData?: BillingTransactionData;
  ocpiData?: {
    session?: OCPISession;
    cdr?: OCPICdr;
    sessionCheckedOn?: Date;
    cdrCheckedOn?: Date;
  };
}

export interface TransactionConsumption {
  date: Date;
  instantWatts: number;
  instantAmps: number;
  limitWatts: number;
  limitAmps: number;
  cumulatedConsumptionWh: number;
  cumulatedConsumptionAmps: number;
  stateOfCharge: number;
  cumulatedAmount: number;
}
