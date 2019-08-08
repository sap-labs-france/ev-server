import sanitize from 'mongo-sanitize';
import Utils from '../../../../utils/Utils';

export interface StatisticsRequest {
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
      SiteAreaIDs: request.SiteAreaID ? sanitize(request.SiteAreaID).split('|') : null,
      ChargeBoxIDs: request.ChargeBoxID ? sanitize(request.ChargeBoxID).split('|') : null,
      UserIDs: request.UserID ? sanitize(request.UserID).split('|') : null,
      SiteIDs: request.SiteID ? sanitize(request.SiteID).split('|') : null
    };
  }

  // eslint-disable-next-line no-unused-vars
  static filterMetricsStatisticsRequest(request: StatisticsRequest, loggedUser?: any): StatisticsRequest {
    if (!request.PeriodInMonth) {
      // TODO: Potentially throw error
    }
    return { PeriodInMonth: sanitize(request.PeriodInMonth) };
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
