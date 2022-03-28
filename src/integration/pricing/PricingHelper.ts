/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable max-len */
import { DimensionType, PricedConsumptionData, PricedDimensionData, PricingContext, PricingDimensions } from '../../types/Pricing';

import ChargingStation from '../../types/ChargingStation';
import Decimal from 'decimal.js';
import Tenant from '../../types/Tenant';
import Transaction from '../../types/Transaction';
import User from '../../types/User';
import Utils from '../../utils/Utils';

export default class PricingHelper {

  public static buildTransactionPricingContext(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation): PricingContext {
    return {
      tenant,
      userID: transaction.userID,
      companyID: transaction.companyID,
      siteID : transaction.siteID,
      siteAreaID: transaction.siteAreaID,
      chargingStationID : transaction.chargeBoxID,
      connectorId : transaction.connectorId,
      timestamp : transaction.timestamp,
      timezone : transaction.timezone,
      chargingStation : chargingStation,
    };
  }

  public static buildUserPricingContext(tenant: Tenant, user: User, chargingStation: ChargingStation, connectorId: number, timestamp: Date): PricingContext {
    return {
      tenant,
      userID: user.id,
      companyID: chargingStation.companyID,
      siteID : chargingStation.siteID,
      siteAreaID: chargingStation.siteAreaID,
      chargingStationID : chargingStation.id,
      connectorId : connectorId,
      timestamp,
      timezone : Utils.getTimezone(chargingStation.coordinates),
      chargingStation,
    };
  }

  public static checkContextConsistency(pricingContext: PricingContext): boolean {
    if (pricingContext.tenant && pricingContext.userID && pricingContext.companyID && pricingContext.siteID && pricingContext.siteAreaID
      && pricingContext.chargingStationID && pricingContext.chargingStation && pricingContext.chargingStation.coordinates
      && pricingContext.connectorId && pricingContext.timestamp
      && pricingContext.timestamp) {
      return true;
    }
    return false;
  }

  public static accumulatePricingDimensions(pricingDimensions: PricingDimensions[]): { cumulatedAmount: number, cumulatedRoundedAmount: number } {
    // Apply the same logic than the invoice to avoid rounding issues
    const flatFee = PricingHelper.accumulatePricingDimension(pricingDimensions, DimensionType.FLAT_FEE);
    const energy = PricingHelper.accumulatePricingDimension(pricingDimensions, DimensionType.ENERGY);
    const chargingTime = PricingHelper.accumulatePricingDimension(pricingDimensions, DimensionType.CHARGING_TIME);
    const parkingTime = PricingHelper.accumulatePricingDimension(pricingDimensions, DimensionType.PARKING_TIME);
    // The final invoice shows individual lines per dimensions - each amount are truncated
    const cumulatedAmount = new Decimal(0).plus(flatFee.cumulatedAmount).plus(energy.cumulatedAmount).plus(chargingTime.cumulatedAmount).plus(parkingTime.cumulatedAmount).toNumber();
    const cumulatedRoundedAmount = new Decimal(0).plus(flatFee.cumulatedRoundedAmount).plus(energy.cumulatedRoundedAmount).plus(chargingTime.cumulatedRoundedAmount).plus(parkingTime.cumulatedRoundedAmount).toNumber();
    return {
      cumulatedAmount,
      cumulatedRoundedAmount,
    };
  }

  public static accumulatePricingDimension(pricingDimensions: PricingDimensions[], dimensionType: DimensionType): { cumulatedAmount: number, cumulatedRoundedAmount: number } {
    let cumulatedAmount = 0;
    let cumulatedRoundedAmount = 0;
    pricingDimensions.forEach((pricingDimension) => {
      cumulatedAmount = Utils.createDecimal(cumulatedAmount).plus(pricingDimension[dimensionType]?.pricedData?.amount || 0).toNumber();
      cumulatedRoundedAmount = Utils.createDecimal(cumulatedRoundedAmount).plus(pricingDimension[dimensionType]?.pricedData?.roundedAmount || 0).toNumber();
    });
    return {
      cumulatedAmount,
      cumulatedRoundedAmount,
    };
  }

  public static accumulatePricedConsumption(pricingData: PricedConsumptionData[]): PricedConsumptionData {
    const accumulatedConsumptionData: PricedConsumptionData = {};
    for (const pricingConsumptionData of pricingData) {
      PricingHelper.accumulatePricedConsumptionData(accumulatedConsumptionData, pricingConsumptionData, DimensionType.FLAT_FEE);
      PricingHelper.accumulatePricedConsumptionData(accumulatedConsumptionData, pricingConsumptionData, DimensionType.ENERGY);
      PricingHelper.accumulatePricedConsumptionData(accumulatedConsumptionData, pricingConsumptionData, DimensionType.CHARGING_TIME);
      PricingHelper.accumulatePricedConsumptionData(accumulatedConsumptionData, pricingConsumptionData, DimensionType.PARKING_TIME);
    }
    return accumulatedConsumptionData;
  }

  private static accumulatePricedConsumptionData(accumulatedData: PricedConsumptionData, pricedData: PricedConsumptionData, dimensionType: DimensionType): void {
    if (pricedData[dimensionType]) {
      if (!accumulatedData[dimensionType]) {
        const emptyDimensionData: PricedDimensionData = {
          quantity:0,
          amountAsDecimal: Utils.createDecimal(0),
          amount: 0,
          roundedAmount: 0
        };
        accumulatedData[dimensionType] = emptyDimensionData;
      }
      let persistedAmount: Decimal;
      if (Utils.isNullOrUndefined(pricedData[dimensionType].amountAsDecimal)) {
        // amountAsDecimal is NOT set - let's use the amount instead
        persistedAmount = Utils.createDecimal(pricedData[dimensionType].amount);
      } else {
        // Normal situation - amountAsDecimal is set
        persistedAmount = Utils.createDecimal(pricedData[dimensionType].amountAsDecimal);
      }
      accumulatedData[dimensionType].quantity = Utils.createDecimal(accumulatedData[dimensionType].quantity).plus(pricedData[dimensionType].quantity).toNumber();
      accumulatedData[dimensionType].amountAsDecimal = Utils.createDecimal(accumulatedData[dimensionType].amountAsDecimal).plus(persistedAmount);
      accumulatedData[dimensionType].amount = Utils.createDecimal(accumulatedData[dimensionType].amountAsDecimal).toNumber();
      accumulatedData[dimensionType].roundedAmount = Utils.truncTo(accumulatedData[dimensionType].amount, 2);
    }
  }
}
