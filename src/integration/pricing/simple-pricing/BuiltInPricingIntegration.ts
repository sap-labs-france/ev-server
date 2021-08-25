import FeatureToggles, { Feature } from '../../../utils/FeatureToggles';
import { PricedConsumption, PricingDefinition, PricingSource, ResolvedPricingModel } from '../../../types/Pricing';

import Consumption from '../../../types/Consumption';
import PricingEngine from '../PricingEngine';
import PricingIntegration from '../PricingIntegration';
import { SimplePricingSetting } from '../../../types/Setting';
import Tenant from '../../../types/Tenant';
import Transaction from '../../../types/Transaction';
import Utils from '../../../utils/Utils';

// --------------------------------------------------------------------------------------------------
// TODO - POC - BuiltInPricingIntegration is hidden behind a feature toggle
// This concrete implementation of the PricingIntegration still relies on the SimplePricingSettings
// --------------------------------------------------------------------------------------------------
export default class BuiltInPricingIntegration extends PricingIntegration<SimplePricingSetting> {
  constructor(tenant: Tenant, readonly settings: SimplePricingSetting) {
    super(tenant, settings);
  }

  public async startSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    const pricedConsumption = await this.computePrice(transaction, consumptionData);
    pricedConsumption.pricingModel = await this.resolvePricingContext(this.tenant, transaction);
    return pricedConsumption;
  }

  public async updateSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    return this.computePrice(transaction, consumptionData);
  }

  public async stopSession(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    return this.computePrice(transaction, consumptionData);
  }

  private async computePrice(transaction: Transaction, consumptionData: Consumption): Promise<PricedConsumption> {
    let amount: number;
    let roundedAmount: number;
    if (consumptionData.consumptionWh && typeof consumptionData.consumptionWh === 'number') {
      amount = PricingEngine.priceConsumption(this.tenant, transaction, consumptionData);
      roundedAmount = Utils.truncTo(amount, 2);
    } else {
      amount = 0;
      roundedAmount = 0;
    }
    const pricedConsumption: PricedConsumption = {
      pricingSource: PricingSource.SIMPLE,
      amount: amount,
      roundedAmount: roundedAmount,
      currencyCode: this.settings.currency,
      cumulatedAmount: transaction.currentCumulatedPrice ? Utils.createDecimal(transaction.currentCumulatedPrice).plus(amount).toNumber() : amount
    };
    return Promise.resolve(pricedConsumption);
  }

  private async resolvePricingContext(tenant: Tenant, transaction: Transaction): Promise<ResolvedPricingModel> {
    const resolvedPricingModel: ResolvedPricingModel = await PricingEngine.resolvePricingContext(tenant, transaction);
    if (!resolvedPricingModel.pricingDefinitions?.length) {
      resolvedPricingModel.pricingDefinitions = [ this.getDefaultPricingDefinition() ];
    }
    return resolvedPricingModel;
  }

  private getDefaultPricingDefinition(): PricingDefinition {
    if (FeatureToggles.isFeatureActive(Feature.PRICING_TEST_PARKING_TIME)) {
      // TODO - Should be removed - just for testing purposes!
      return {
        name: 'Tariff 3 Dimensions',
        description: 'Tariff - FF + CT + PT',
        dimensions: {
          flatFee: {
            active: true,
            price: 3, // 3 EUR when connecting
          },
          chargingTime: {
            active: true,
            price: 5, // 5 EUR/hour
          },
          parkingTime: {
            active: true,
            price: 7, // 7 EUR/hour
          },
        }
      };
    }
    // Defaults to the simple pricing settings
    return {
      name: 'Default Tariff',
      description: 'Tariff based on simple pricing settings',
      dimensions: {
        energy: {
          active: true,
          price: this.setting.price,
        }
      }
    };
  }

}
