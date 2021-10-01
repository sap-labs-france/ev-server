import { DimensionType, PricedConsumptionData, PricedDimensionData, PricingDimensions } from '../../types/Pricing';

import Decimal from 'decimal.js';
import Utils from '../../utils/Utils';

export default class PricingHelper {

  public static accumulatePricingDimensions(pricingDimensions: PricingDimensions[]): number {
    // Apply the same logic than the invoice to avoid rounding issues
    const flatFee = PricingHelper.accumulatePricingDimension(pricingDimensions, DimensionType.FLAT_FEE);
    const energy = PricingHelper.accumulatePricingDimension(pricingDimensions, DimensionType.ENERGY);
    const chargingTime = PricingHelper.accumulatePricingDimension(pricingDimensions, DimensionType.CHARGING_TIME);
    const parkingTime = PricingHelper.accumulatePricingDimension(pricingDimensions, DimensionType.PARKING_TIME);
    // The final invoice shows individual lines per dimensions - each amount are truncated
    const total = new Decimal(0).plus(flatFee).plus(energy).plus(chargingTime).plus(parkingTime);
    return PricingHelper.truncTo(total.toNumber(), 2);
  }

  public static accumulatePricingDimension(pricingDimensions: PricingDimensions[], dimensionType: DimensionType): number {
    let total = new Decimal(0);
    pricingDimensions.forEach((pricingDimension) => {
      total = total.plus(pricingDimension[dimensionType]?.pricedData?.amount || 0);
    });
    return PricingHelper.truncTo(total.toNumber(), 2);
  }

  public static truncTo(value: number, scale: number): number {
    const truncPower = Math.pow(10, scale);
    return Utils.createDecimal(value).times(truncPower).trunc().div(truncPower).toNumber();
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
          unitPrice: 0,
          quantity:0,
          amount: 0,
          roundedAmount: 0
        };
        accumulatedData[dimensionType] = emptyDimensionData;
      }
      accumulatedData[dimensionType].quantity = Utils.createDecimal(accumulatedData[dimensionType].quantity).plus(pricedData[dimensionType].quantity).toNumber();
      accumulatedData[dimensionType].amount = Utils.createDecimal(accumulatedData[dimensionType].amount).plus(pricedData[dimensionType].amount).toNumber();
      accumulatedData[dimensionType].roundedAmount = Utils.createDecimal(accumulatedData[dimensionType].roundedAmount).plus(pricedData[dimensionType].roundedAmount).toNumber();
    }
  }
}
