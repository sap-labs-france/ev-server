
// Declare here the list of features
export enum Feature {
  BILLING_SYNC_USERS,
  BILLING_SYNC_USER,
  BILLING_CHECK_USER_BILLING_DATA,
  BILLING_CHECK_CUSTOMER_ID,
  BILLING_CHECK_USER_DEFAULT_PAYMENT_METHOD,
  BILLING_WITH_PARKING_TIME,
  BILLING_ITEM_WITH_PARKING_TIME,
  BILLING_ITEM_WITH_START_DATE,
  BILLING_ASYNC_BILL_TRANSACTION,
}

export default class FeatureToggles {
  // Comment out the features that you want to switch OFF
  static activeFeatures: Feature[] = [
    Feature.BILLING_SYNC_USERS,
    Feature.BILLING_SYNC_USER,
    Feature.BILLING_CHECK_USER_BILLING_DATA,
    Feature.BILLING_CHECK_CUSTOMER_ID,
    Feature.BILLING_CHECK_USER_DEFAULT_PAYMENT_METHOD,
    // Feature.BILLING_ITEM_WITH_PARKING_TIME,
    Feature.BILLING_ITEM_WITH_START_DATE,
    Feature.BILLING_ASYNC_BILL_TRANSACTION,
  ];

  // Check whether the feature is active or not!
  public static isFeatureActive(feature: Feature): boolean {
    return FeatureToggles.activeFeatures.includes(feature);
  }
}
