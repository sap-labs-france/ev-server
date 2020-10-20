import { OICPEVSEPricing, OICPPricingProductData } from './OICPPricing';

import { OICPActionType } from './OICPEvseData';

//
// eRoamingPushPricingProductData_V1.0
//
export interface OICPPushPricingProductDataCpoSend {
  ActionType: OICPActionType, // Describes the action that has to be performed by Hubject with the provided data.
  PricingProductData: OICPPricingProductData // Details of pricing products offered by a particular operator for a specific provider
}

//
// eRoamingPushEVSEPricing_V1.0
// NOTE: The eRoamingPushEVSEPricing operation MUST always be used sequentially.
//
export interface OICPPushEVSEPricingCpoSend {
  ActionType: OICPActionType, // Describes the action that has to be performed by Hubject with the provided data.
  EVSEPricing: OICPEVSEPricing[] // 1..n. A list of EVSEs and their respective pricing product relation
}
