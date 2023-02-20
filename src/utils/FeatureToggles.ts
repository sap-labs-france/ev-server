
// Declare here the list of features
export enum Feature {
  OCPPJ_PERSIST_RAW_METER_VALUES,
  BILLING_INVOICES_EXCLUDE_PENDING_ITEMS,
  BILLING_PREVENT_CUSTOMER_DELETION,
  BILLING_SHOW_PRICING_DETAIL,
  BILLING_PLATFORM_USE_EXPRESS_ACCOUNT,
}

export default class FeatureToggles {
  // Comment out the features that you want to switch OFF
  private static activeFeatures: Feature[] = [
    Feature.OCPPJ_PERSIST_RAW_METER_VALUES,
    Feature.BILLING_INVOICES_EXCLUDE_PENDING_ITEMS,
    Feature.BILLING_PREVENT_CUSTOMER_DELETION,
    Feature.BILLING_PLATFORM_USE_EXPRESS_ACCOUNT,
  ];

  // Check whether the feature is active or not!
  public static isFeatureActive(feature: Feature): boolean {
    return FeatureToggles.activeFeatures.includes(feature);
  }
}
