import { OICPDayValue, OICPEvseID, OICPOperatorID, OICPPeriod } from './OICPEvse';

import { OICPProviderID } from './OICPAuthentication';

export interface OICPPricingProductData {
  OperatorID: OICPOperatorID, // The provider whose data records are listed below.
  OperatorName?: string, // Free text for operator. Field Length = 100
  ProviderID: OICPProviderID, // The EMP for whom the pricing data is applicable. In case the data is to be made available for all EMPs (e.g. for Offer-to-All prices), the asterix character (*) can be set as the value in this field.
  PricingDefaultPrice: number, // Decimal. A default price for pricing sessions at undefined EVSEs
  PricingDefaultPriceCurrency: OICPCurrencyID, // Currency for default prices
  PricingDefaultReferenceUnit: OICPReferenceUnit, // Default Reference Unit in time or kWh
  PricingProductDataRecords: OICPPricingProductDataRecord[] // A list of pricing products
}

export enum OICPReferenceUnit { // Defined Reference Unit Types
  HOUR = 'HOUR',
  KILOWATT_HOUR = 'KILOWATT_HOUR',
  MINUTE = 'MINUTE'
}

export interface OICPPricingProductDataRecord {
  ProductID: OICPProductID, // A pricing product name (for identifying a tariff) that must be unique. Field Length = 50
  ReferenceUnit: OICPReferenceUnit, // Reference unit in time or kWh
  ProductPriceCurrency: OICPCurrencyID, // Currency for default prices
  MaximumProductChargingPower: number, // Decimal. A value in kWh
  IsValid24hours: boolean, // Set to TRUE if the respective pricing product is applicable 24 hours a day. If FALSE, the respective applicability times should be provided in the field “ProductAvailabilityTimes”.
  ProductAvailabilityTimes: OICPProductAvailabilityTimes[], // A list indicating when the pricing product is applicable
  AdditionalReferences?: OICPAdditionalReferencesType[] // 0..n. A list of additional reference units and their respective prices
}

export enum OICPProductID { // The ProductIDType defines some standard values (see below). The type however also supports custom ProductIDs that can be specified by partners (as a string of 50 characters maximum length).
  StandardPrice = 'Standard Price', // 	Standard price
  AC1 = 'AC1', // Product for AC 1 Phase charging
  AC3 = 'AC3', // Product for AC 3 Phase charging
  DC = 'DC', // Product for DC charging
  CustomProductID = '<CustomProductID>' // There is no option “CustomProductID”, this sample option is meant to indicates that custom product ID specifications by partners (as a string of 50 characters maximum length) are allowed as well.
}

export interface OICPProductAvailabilityTimes {
  Periods: OICPPeriod[], // The starting and end time for pricing product applicability in the specified period
  On: OICPDayValue // Day values to be used in specifying periods on which the product is available
}

export interface OICPAdditionalReferencesType {
  AdditionalReference: OICPAdditionalReference, // Additional pricing components to be considered in addition to the base pricing
  AdditionalReferenceUnit: OICPReferenceUnit, // Additional reference units that can be used in defining pricing products
  PricePerAdditionalReferenceUnit: number // Decimal. A price in the given currency
}

export enum OICPAdditionalReference {
  StartFee = 'START FEE', // Can be used in case a fixed fee is charged for the initiation of the charging session. This is a fee charged on top of the main base price defined in the field "PricePerReferenceUnit" for any particular pricing product.
  FixedFee = 'FIXED FEE', // Can be used if a single price is charged irrespective of charging duration or energy consumption (for instance if all sessions are to be charged a single fixed fee). When used, the value set in the field "PricePerReferenceUnit" for the main base price of respective pricing product should be set to zero.
  ParkingFee = 'PARKING FEE', // Can be used in case sessions are to be charged for both parking and charging. When used, it needs to be specified in the corresponding service offer on the HBS Portal when parking applies (e.g. from session start to charging start and charging end to session end or for the entire session duration, or x-minutes after charging end, etc)
  MinimumFee = 'MINIMUM FEE', // Can be used in case there is a minimum fee to be paid for all charging sessions. When used, this implies that the eventual price to be paid cannot be less than this minimum fee but can however be a price above/greater than the minimum fee.
  MaximumFee = 'MAXIMUM FEE' // Can be used in case there is a maximum fee to be charged for all charging sessions. When used, this implies that the eventual price to be paid cannot be more than this maximum fee but can however be a price below/lower than the maximum fee.
}

export interface OICPEVSEPricing {
  EvseID: OICPEvseID, // The EvseID of an EVSE for which the defined pricing products are applicable
  ProviderID: OICPProviderID, // The EMP for whom the pricing data is applicable. In case the data is to be made available for all EMPs (e.g. for Offer-to-All prices), the asterix character (*) can be set as the value in this field.
  EvseIDProductList: OICPEvseIDProductList[] // 1..n. A list of pricing products applicable per EvseID
}

export interface OICPEvseIDProductList {
  ProductID: OICPProductID // The product name of the applicable pricing product. Field Length = 50
}

export interface OICPOperatorEVSEPricing {
  OperatorID: OICPOperatorID, // The provider whose status records are listed below. Field Length = 50
  OperatorName?: string, // Operator name. Field Length = 100
  EVSEPricing: OICPEVSEPricing[] // 0..n. List of EVSE pricings offered by the operator.
}

export type OICPCurrencyID = string; // The ProductPriceCurrencyType allows for the list of active codes of the official ISO 4217 currency names. For the full list of active codes of the official ISO 4217 currencies, see: https://en.wikipedia.org/wiki/ISO_4217. Examples: EUR Euro, CHF Swiss franc
