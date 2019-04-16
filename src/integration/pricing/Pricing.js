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

  // TODO:
  static async getPricingImpl() {
    // Check if the pricing is active
    if ((await this.getTenant()).isComponentActive(Constants.COMPONENTS.PRICING)) {
      // Get the pricing's settings
      const setting = await SettingStorage.getSettingByIdentifier(this.getTenantID(), Constants.COMPONENTS.PRICING);
      // Check
      if (setting) {
        // Check if CC
        if (setting.getContent()['convergentCharging']) {
          // Return the CC implementation
          return new ConvergentCharging(this.getTenantID(), setting.getContent()['convergentCharging'], this);
        } else if (setting.getContent()['simple']) {
          // Return the Simple Pricing implementation
          return new SimplePricing(this.getTenantID(), setting.getContent()['simple'], this);
        }
      }
    }
    // Pricing is not active
    return null;
  }
}

module.exports = Pricing;