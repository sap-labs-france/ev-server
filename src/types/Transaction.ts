import { BillingTransactionData } from './Billing';
import ChargingStation from '../types/ChargingStation';
import Consumption from './Consumption';
import User from './User';
import { InactivityStatusLevel } from './UserNotifications';

export default interface Transaction {
  id: number;
  siteID: string;
  siteAreaID: string;
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
    price: number;
    roundedPrice: number;
    priceUnit: string;
    pricingSource: string;
    stateOfCharge: number;
    totalInactivitySecs: number;
    extraInactivitySecs: number;
    extraInactivityComputed: boolean;
    totalConsumption: number;
    totalDurationSecs: number;
    currentTotalDurationSecs: number;
    inactivityStatusLevel: InactivityStatusLevel;
    timestamp: Date;
    transactionData?: any;
    signedData?: any;
  };
  remotestop?: {
    timestamp: Date;
    tagID: string;
    userID: string;
  };
  refundData?: {
    refundId: string;
    refundedAt: Date;
    type: any;
    reportId?: string;
    status?: any;
  };
  lastMeterValue?: {
    value: number;
    timestamp: Date;
  };
  chargeBox?: ChargingStation;
  meterStart: number;
  timestamp: Date;
  price: number;
  roundedPrice: number;
  priceUnit: string;
  pricingSource: string;
  stateOfCharge: number;
  timezone: string;
  lastUpdate?: Date;
  currentTotalInactivitySecs: number;
  currentInactivityStatusLevel: InactivityStatusLevel;
  currentStateOfCharge: number;
  numberOfMeterValues: number;
  currentConsumption: number;
  currentConsumptionWh?: number;
  currentCumulatedPrice: number;
  currentTotalConsumption: number;
  currentSignedData?: number;
  uniqueId?: string;
  errorCode?: number;
  values?: Consumption[];
  billingData?: BillingTransactionData;
}
