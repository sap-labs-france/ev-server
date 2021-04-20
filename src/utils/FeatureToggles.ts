
// Declare here the list of features
export enum Feature {
  BILLING_SYNC_USERS,
  BILLING_SYNC_USER,
  BILLING_CHECK_USER_BILLING_DATA,
  BILLING_CHECK_CUSTOMER_ID,
  BILLING_CHECK_USER_DEFAULT_PAYMENT_METHOD,
}

export default class FeatureToggles {
  // Comment out the features that you want to switch OFF
  static activeFeatures: Feature[] = [
    // Feature.BILLING_SYNC_USERS, // Let's avoid polluting the stripe accounts for now!
    // Feature.BILLING_SYNC_USER,
    // Feature.BILLING_CHECK_USER_BILLING_DATA,
    // Feature.BILLING_CHECK_CUSTOMER_ID,
    // Feature.BILLING_CHECK_USER_DEFAULT_PAYMENT_METHOD,
  ];

  // Check whether the feature is active or not!
  public static isFeatureActive(feature: Feature): boolean {
    return FeatureToggles.activeFeatures.includes(feature);
  }
}
