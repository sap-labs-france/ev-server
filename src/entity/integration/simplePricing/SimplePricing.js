const Logging = require('../../../utils/Logging');
const PricingStorage = require('../../../storage/mongodb/PricingStorage');
const ConsumptionStorage = require('../../../storage/mongodb/ConsumptionStorage');

class SimplePricing {
  /**
   * @param tenantId {string}
   */
  constructor(tenantId, setting) {
    this.tenantId = tenantId;
    this.setting = setting;
  }

  async startSession(consumptionData) {
    return this.computePrice(consumptionData);
  }


  async updateSession(consumptionData) {
    return this.computePrice(consumptionData);
  }

  async stopSession(consumptionData) {
    return this.computePrice(consumptionData);
  }

  async computePrice(consumptionData) {
    const amountData = {
      pricingSource: 'simple',
      amount: parseFloat((this.setting.price * (consumptionData.consumption / 1000)).toFixed(6)),
      roundedAmount: parseFloat((this.setting.price * (consumptionData.consumption / 1000)).toFixed(2)),
      currency: this.setting.currency
    };

    const previousConsumption = await ConsumptionStorage.getConsumption(this.tenantId, consumptionData.transactionId, consumptionData.startedAt);
    if (previousConsumption) {
      amountData.cumulatedAmount = previousConsumption.getCumulatedAmount() + amountData.amount;
    } else {
      amountData.cumulatedAmount = 0;
    }
    return amountData;
  }

}

module.exports = SimplePricing;