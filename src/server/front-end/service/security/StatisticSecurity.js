const sanitize = require('mongo-sanitize');

class StatisticSecurity {
  static filterUserStatisticsRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.Year = sanitize(request.Year);
    filteredRequest.SiteID = sanitize(request.SiteID);
    return filteredRequest;
  }

  static filterChargingStationStatisticsRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.Year = sanitize(request.Year);
    filteredRequest.SiteID = sanitize(request.SiteID);
    return filteredRequest;
  }
}

module.exports = StatisticSecurity;
