
// Declare here the list of features
export enum Feature {
  BILLING_SYNC_USERS,
  BILLING_CHECK_THRESHOLD_ON_STOP,
  BILLING_PREVENT_CUSTOMER_DELETION,
  PRICING_NEW_MODEL,
  PRICING_CHECK_BACKWARD_COMPATIBILITY,
  BILLING_SHOW_PRICING_DETAIL,
  BILLING_SHOW_SESSION_HEADER,
}

export default class FeatureToggles {
  // Comment out the features that you want to switch OFF
  static activeFeatures: Feature[] = [
    // Feature.BILLING_SYNC_USERS, - When switched OFF the sync of the user should be implicit (LAZY mode)
    Feature.BILLING_CHECK_THRESHOLD_ON_STOP,
    Feature.BILLING_PREVENT_CUSTOMER_DELETION,
    Feature.PRICING_NEW_MODEL,
    // Feature.PRICING_CHECK_BACKWARD_COMPATIBILITY,
    // Feature.BILLING_SHOW_PRICING_DETAIL,
    Feature.BILLING_SHOW_SESSION_HEADER,
  ];

  // Check whether the feature is active or not!
  public static isFeatureActive(feature: Feature): boolean {
    return FeatureToggles.activeFeatures.includes(feature);
  }
}
