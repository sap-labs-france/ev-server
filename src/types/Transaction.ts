import { BillingTransactionData } from './Billing';
import { ChargePointStatus } from './ocpp/OCPPServer';
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
    timestamp: Date;
    meterStop: number;
    tagID: string;
    userID: string;
    user?: User;
    price?: number;
    roundedPrice?: number;
    priceUnit?: string;
    pricingSource?: string;
    stateOfCharge?: number;
    totalInactivitySecs?: number;
    extraInactivitySecs?: number;
    extraInactivityComputed?: boolean;
    totalConsumptionWh?: number;
    totalDurationSecs?: number;
    inactivityStatus?: InactivityStatus;
    transactionData?: any;
    signedData?: any;
  };
  remotestop?: {
    timestamp: Date;
    tagID: string;
    userID: string;
  };
  refundData?: RefundTransactionData;
  lastEnergyActiveImportMeterValue?: {
    value: number;
    timestamp: Date;
  };
  chargeBox?: ChargingStation;
  meterStart: number;
  timestamp: Date;
  price?: number;
  roundedPrice?: number;
  priceUnit?: string;
  pricingSource?: string;
  stateOfCharge: number;
  timezone: string;
  currentTimestamp?: Date;
  currentTotalInactivitySecs: number;
  currentInactivityStatus?: InactivityStatus;
  currentStateOfCharge: number;
  currentTotalDurationSecs?: number;
  currentInstantWatts: number;
  currentVoltage?: number;
  currentVoltageL1?: number;
  currentVoltageL2?: number;
  currentVoltageL3?: number;
  currentVoltageDC?: number;
  currentAmperage?: number;
  currentAmperageL1?: number;
  currentAmperageL2?: number;
  currentAmperageL3?: number;
  currentAmperageDC?: number;
  currentConsumptionWh?: number;
  currentCumulatedPrice?: number;
  currentTotalConsumptionWh: number;
  currentSignedData?: string;
  status?: ChargePointStatus;
  numberOfMeterValues: number;
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
  voltage: number;
  voltageL1: number;
  voltageL2: number;
  voltageL3: number;
  voltageDC: number;
  amperage: number;
  amperageL1: number;
  amperageL2: number;
  amperageL3: number;
  amperageDC: number;
}
