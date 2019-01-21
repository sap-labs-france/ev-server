const Logging = require('../../../utils/Logging');
const Notification = require('../../../entity/Notification');
const NotificationSecurity = require('./security/NotificationSecurity');

class NotificationService {
  static async handleGetNotifications(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = NotificationSecurity.filterNotificationsRequest(req.query, req.user);
      // Get the Notification
      const notifications = await Notification.getNotifications(req.user.tenantID, {
        'userID': filteredRequest.UserID,
        'dateFrom': filteredRequest.DateFrom,
        'channel': filteredRequest.Channel
      }, filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
      // Set
      notifications.result = notifications.result.map((notification) => notification.getModel());
      // Filter
      notifications.result = NotificationSecurity.filterNotificationsResponse(
        notifications.result, req.user);
      // Return
      res.json(notifications);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }
}

module.exports = NotificationService;
