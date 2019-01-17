const sanitize = require('mongo-sanitize');

class StatisticSecurity {
  // eslint-disable-next-line no-unused-vars
  static filterUserStatisticsRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.Year = sanitize(request.Year);
    filteredRequest.SiteID = sanitize(request.SiteID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationStatisticsRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.Year = sanitize(request.Year);
    filteredRequest.SiteID = sanitize(request.SiteID);
    return filteredRequest;
  }
}

module.exports = StatisticSecurity;
