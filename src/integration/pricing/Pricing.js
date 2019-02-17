class Pricing {
  constructor(tenantId, setting, transaction) {
    this.tenantId = tenantId;
    this.setting = setting;
    this.transaction = transaction;
  }

  // eslint-disable-next-line no-unused-vars
  async startSession(consumptionData) {
  }

  // eslint-disable-next-line no-unused-vars
  async updateSession(consumptionData) {
  }

  // eslint-disable-next-line no-unused-vars
  async stopSession(consumptionData) {
  }
}

module.exports = Pricing;