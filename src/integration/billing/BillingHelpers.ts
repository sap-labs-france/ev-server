import { BillingInvoiceItem } from '../../types/Billing';
import Decimal from 'decimal.js';
import { PricedConsumptionData } from '../../types/Pricing';
import Utils from '../../utils/Utils';

export default class BillingHelpers {

  public static getItemPrice(billingInvoiceItem: BillingInvoiceItem): Decimal {
    return BillingHelpers.getBilledPrice(billingInvoiceItem.pricingData);
  }

  public static getBilledPrice(pricedData: PricedConsumptionData[]): Decimal {
    let price = Utils.createDecimal(0);
    if (pricedData) {
      pricedData.forEach((pricedConsumptionData) => {
        price = price.plus(pricedConsumptionData.flatFee?.amountAsDecimal || 0);
        price = price.plus(pricedConsumptionData.energy?.amountAsDecimal || 0);
        price = price.plus(pricedConsumptionData.parkingTime?.amountAsDecimal || 0);
        price = price.plus(pricedConsumptionData.chargingTime?.amountAsDecimal || 0);
      });
    }
    return price;
  }
}
