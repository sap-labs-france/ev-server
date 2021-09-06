
// Declare here the list of features
export enum Feature {
  BILLING_SYNC_USERS,
  BILLING_CHECK_THRESHOLD_ON_STOP,
  BILLING_PREVENT_CUSTOMER_DELETION,
  PRICING_NEW_MODEL,
  PRICING_PRICE_ACCUMULATED_WH,
  PRICING_TEST_PARKING_TIME,
  PRICING_TEST_ENERGY_WITH_STEP_SIZE,
  PRICING_WITH_RESTRICTION_CHECKS,
}

export default class FeatureToggles {
  // Comment out the features that you want to switch OFF
  static activeFeatures: Feature[] = [
    // Feature.BILLING_SYNC_USERS, - When switched OFF the sync of the user should be implicit (LAZY mode)
    Feature.BILLING_CHECK_THRESHOLD_ON_STOP,
    Feature.BILLING_PREVENT_CUSTOMER_DELETION,
    Feature.PRICING_NEW_MODEL,
    Feature.PRICING_WITH_RESTRICTION_CHECKS,
    Feature.PRICING_PRICE_ACCUMULATED_WH,
    // Feature.PRICING_TEST_PARKING_TIME
    // Feature.PRICING_TEST_ENERGY_WITH_STEP_SIZE
  ];

  // Check whether the feature is active or not!
  public static isFeatureActive(feature: Feature): boolean {
    return FeatureToggles.activeFeatures.includes(feature);
  }
}
