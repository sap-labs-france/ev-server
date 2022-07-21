import { PricedConsumptionData } from '../../types/Pricing';
import Utils from '../../utils/Utils';

export default class BillingHelpers {

  public static getBilledPrice(pricedData: PricedConsumptionData[]): number {
    let price = Utils.createDecimal(0);
    if (pricedData) {
      // --------------------------------------------------------------------------------
      // TODO - this code is tax agnostic - This should not be!
      // Right now the result may include the taxes or not!
      // This depends on the tax rate settings (exclusive/inclusive)
      // --------------------------------------------------------------------------------
      pricedData.forEach((pricedConsumptionData) => {
        price = price.plus(pricedConsumptionData.flatFee?.amountAsDecimal || 0);
        price = price.plus(pricedConsumptionData.energy?.amountAsDecimal || 0);
        price = price.plus(pricedConsumptionData.parkingTime?.amountAsDecimal || 0);
        price = price.plus(pricedConsumptionData.chargingTime?.amountAsDecimal || 0);
      });
    }
    return price.toNumber();
  }
}
