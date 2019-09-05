export default interface HttpStatisticsRequest {
  Year?: string|number;
  SiteID?: string;
  SiteIDs?: string[];
  PeriodInMonth?: string|number;
  SiteAreaID?: string;
  SiteAreaIDs?: string[];
  ChargeBoxID?: string;
  ChargeBoxIDs?: string[];
  UserID?: string;
  UserIDs?: string[];
  DataType?: string;
  DataCategory?: string;
  DataScope?: string;
}
