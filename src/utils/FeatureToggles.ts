
// Declare here the list of features
export enum Feature {
  BILLING_INVOICES_EXCLUDE_PENDING_ITEMS,
  BILLING_PREVENT_CUSTOMER_DELETION,
  BILLING_SHOW_PRICING_DETAIL,
  BILLING_PLATFORM_USE_EXPRESS_ACCOUNT,
  WS_SEND_PING_AUTOMATICALLY,
  OCPP_STORE_HEARTBEATS,
  OCPP_STORE_METER_VALUES,
  OCPP_OPTIMIZE_LAST_SEEN_UPDATE,
  OCPP_MONITOR_MEMORY_USAGE,
  HEALTH_CHECK_PING_DATABASE,
}

export default class FeatureToggles {
  // Comment out the features that you want to switch OFF
  private static activeFeatures: Feature[] = [
    Feature.BILLING_INVOICES_EXCLUDE_PENDING_ITEMS,
    Feature.BILLING_PREVENT_CUSTOMER_DELETION,
    Feature.BILLING_PLATFORM_USE_EXPRESS_ACCOUNT,
    Feature.WS_SEND_PING_AUTOMATICALLY,
    // Feature.OCPP_STORE_HEARTBEATS,
    // Feature.OCPP_STORE_METER_VALUES,
    Feature.OCPP_OPTIMIZE_LAST_SEEN_UPDATE,
    Feature.OCPP_MONITOR_MEMORY_USAGE,
    // Feature.HEALTH_CHECK_PING_DATABASE,
  ];

  // Check whether the feature is active or not!
  public static isFeatureActive(feature: Feature): boolean {
    return FeatureToggles.activeFeatures.includes(feature);
  }
}
