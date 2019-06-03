const sanitize = require('mongo-sanitize');

class StatisticSecurity {
  // eslint-disable-next-line no-unused-vars
  static filterUserStatisticsRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.Year = sanitize(request.Year);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.SiteAreaID = sanitize(request.SiteAreaID);
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.UserID = sanitize(request.UserID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationStatisticsRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.Year = sanitize(request.Year);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.SiteAreaID = sanitize(request.SiteAreaID);
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.UserID = sanitize(request.UserID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterMetricsStatisticsRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.periodInMonth = sanitize(request.PeriodInMonth);
    return filteredRequest;
  }
}

module.exports = StatisticSecurity;
