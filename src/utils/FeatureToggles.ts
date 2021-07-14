
// Declare here the list of features
export enum Feature {
  BILLING_SYNC_USERS,
  BILLING_ITEM_WITH_PARKING_TIME,
  BILLING_CHECK_THRESHOLD_ON_STOP,
  BILLING_PREVENT_CUSTOMER_DELETION
}

export default class FeatureToggles {
  // Comment out the features that you want to switch OFF
  static activeFeatures: Feature[] = [
    // Feature.BILLING_SYNC_USERS, - When switched OFF the sync of the user should be implicit (LAZY mode)
    // Feature.BILLING_ITEM_WITH_PARKING_TIME,
    Feature.BILLING_CHECK_THRESHOLD_ON_STOP,
    Feature.BILLING_PREVENT_CUSTOMER_DELETION
  ];

  // Check whether the feature is active or not!
  public static isFeatureActive(feature: Feature): boolean {
    return FeatureToggles.activeFeatures.includes(feature);
  }
}
