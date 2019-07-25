import User from "./User";
import ChargingStation from "../entity/ChargingStation";

export default interface Transaction {

  id: number;
  siteID: string;
  siteAreaID: string;
  connectorId: number;
  tagID: string;
  userID: string;
  chargeBoxID: string;

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
    totalConsumption: number;
    totalDurationSecs: number;
    timestamp: Date;
  }
  remotestop?: {
    timestamp: Date;
    tagID: string;
  }
  refundData?: {
    refundId: string;
    refundedAt: Date;
    type: any;
    reportId: string;
  }
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
  currentStateOfCharge: number;
  numberOfMeterValues: number;
  currentConsumption: number;
  currentConsumptionWh?: number;
  currentCumulatedPrice: number;
  currentTotalConsumption: number;
  

  uniqueId?: string;
  errorCode?: number;
}