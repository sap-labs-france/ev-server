import HttpStatisticsRequest from '../../../../types/requests/HttpStatisticRequest';
import Utils from '../../../../utils/Utils';
import sanitize from 'mongo-sanitize';

export default class StatisticSecurity {
  static filterStatisticsRequest(request: any): HttpStatisticsRequest {
    return {
      Year: Utils.convertToInt(sanitize(request.Year)),
      DateFrom: request.DateFrom ? sanitize(request.DateFrom) : null,
      DateUntil: request.DateUntil ? sanitize(request.DateUntil) : null,
      SiteAreaIDs: request.SiteAreaID ? sanitize(request.SiteAreaID).split('|') : null,
      ChargeBoxIDs: request.ChargeBoxID ? sanitize(request.ChargeBoxID).split('|') : null,
      UserIDs: request.UserID ? sanitize(request.UserID).split('|') : null,
      SiteIDs: request.SiteID ? sanitize(request.SiteID).split('|') : null
    };
  }

  static filterMetricsStatisticsRequest(request: any): HttpStatisticsRequest {
    if (!request.PeriodInMonth) {}
    return { PeriodInMonth: sanitize(request.PeriodInMonth) };
  }

  static filterExportStatisticsRequest(request: any): HttpStatisticsRequest {
    return { ...StatisticSecurity.filterStatisticsRequest(request),
      DataType: sanitize(request.DataType),
      DataCategory: sanitize(request.DataCategory),
      DataScope: sanitize(request.DataScope)
    };
  }
}
