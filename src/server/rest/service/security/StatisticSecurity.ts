import sanitize from 'mongo-sanitize';
import Utils from '../../../../utils/Utils';

export interface StatisticsRequest {
  Year?: string|number;
  SiteID?: string|number;
  PeriodInMonth?: string|number;
  SiteAreaID?: string|number;
  ChargeBoxID?: string|number;
  UserID?: string|number;
  // TODO: Choose single type
  DataType?: string;
  DataCategory?: string;
  DataScope?: string;
}

export default class StatisticSecurity {
  // eslint-disable-next-line no-unused-vars
  static filterStatisticsRequest(request: StatisticsRequest, loggedUser?: any): StatisticsRequest {
    return {
      Year: Utils.convertToInt(sanitize(request.Year)),
      SiteAreaID: sanitize(request.SiteAreaID),
      ChargeBoxID: sanitize(request.ChargeBoxID),
      UserID: sanitize(request.UserID),
      SiteID: sanitize(request.SiteID)
    };
  }

  // eslint-disable-next-line no-unused-vars
  static filterMetricsStatisticsRequest(request: StatisticsRequest, loggedUser?: any): StatisticsRequest {
    if (!request.PeriodInMonth) {
      // TODO: Potentially throw error
    }
    return {PeriodInMonth: sanitize(request.PeriodInMonth)};
  }

  // eslint-disable-next-line no-unused-vars
  static filterExportStatisticsRequest(request: StatisticsRequest, loggedUser?: any): StatisticsRequest {
    return { ...StatisticSecurity.filterStatisticsRequest(request, loggedUser),
      DataType: sanitize(request.DataType),
      DataCategory: sanitize(request.DataCategory),
      DataScope: sanitize(request.DataScope)
    };
  }

}
