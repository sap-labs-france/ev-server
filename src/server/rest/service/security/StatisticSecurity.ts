import sanitize from 'mongo-sanitize';

export interface StatisticsRequest {
  Year?: string|number;
  SiteID?: string|number;
  PeriodInMonth?: string|number;
  SiteAreaID?: string|number;
  ChargeBoxID?: string|number;
  UserID?: string|number;
  // TODO: Choose single type
}

export default class StatisticSecurity {
  // eslint-disable-next-line no-unused-vars
  static filterUserStatisticsRequest(request: StatisticsRequest, loggedUser?: any): StatisticsRequest {
    if (!request.Year || !request.SiteID) {
      // TODO: Potentially throw error or return specific result
    }
    return {
      Year: sanitize(request.Year),
      SiteAreaID: sanitize(request.SiteAreaID),
      ChargeBoxID: sanitize(request.ChargeBoxID),
      UserID: sanitize(request.UserID),
      SiteID: sanitize(request.SiteID)
    };
  }

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationStatisticsRequest(request: StatisticsRequest, loggedUser?: any): StatisticsRequest {
    if (!request.Year || !request.SiteID) {
      // TODO: Potentially throw error or return specific result
    }
    return {
      Year: sanitize(request.Year),
      SiteAreaID: sanitize(request.SiteAreaID),
      ChargeBoxID: sanitize(request.ChargeBoxID),
      UserID: sanitize(request.UserID),
      SiteID: sanitize(request.SiteID)
    };
    // TODO: Why are both methods exactly the same?
  }

  // eslint-disable-next-line no-unused-vars
  static filterMetricsStatisticsRequest(request: StatisticsRequest, loggedUser?: any): StatisticsRequest {
    if (!request.PeriodInMonth) {
      // TODO: Potentially throw error
    }
    return {PeriodInMonth: sanitize(request.PeriodInMonth)};
  }
}
