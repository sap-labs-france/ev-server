const Pricing = require('../Pricing');

class SimplePricing extends Pricing {
  constructor(tenantId, setting, transaction) {
    super(tenantId, setting, transaction);
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
    return {
      pricingSource: 'simple',
      amount: this.setting.price * (consumptionData.consumption / 1000),
      roundedAmount: parseFloat((this.setting.price * (consumptionData.consumption / 1000)).toFixed(6)),
      currencyCode: this.setting.currency
    };
  }
}

module.exports = SimplePricing;