
export default interface HttpStatisticsRequest {
  Year?: number;
  StartDateTime?: Date;
  EndDateTime?: Date;
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

export interface HttpMetricsStatisticsRequest {
  PeriodInMonth: number;
}
