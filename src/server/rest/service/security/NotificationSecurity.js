const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../authorization/Authorizations');
const UtilsSecurity = require('./UtilsSecurity');
let UserSecurity; // Avoid circular deps

class NotificationSecurity {
  static getUserSecurity() {
    if (!UserSecurity) {
      UserSecurity = require('./UserSecurity');
    }
    return UserSecurity;
  }

  // eslint-disable-next-line no-unused-vars
  static filterNotificationsRequest(request, loggedUser) {
    const filteredRequest = {};
    filteredRequest.UserID = sanitize(request.UserID);
    filteredRequest.DateFrom = sanitize(request.DateFrom);
    filteredRequest.Channel = sanitize(request.Channel);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterNotificationsResponse(notifications, loggedUser) {
    const filteredNotifications = [];

    if (!notifications.result) {
      return null;
    }
    for (const notification of notifications.result) {
      // Filter
      const filteredNotification = NotificationSecurity.filterNotificationResponse(notification, loggedUser);
      // Ok?
      if (filteredNotification) {
        // Add
        filteredNotifications.push(filteredNotification);
      }
    }
    notifications.result = filteredNotifications;
  }

  // Notification
  static filterNotificationResponse(notification, loggedUser) {
    let filteredNotification = null;

    if (!notification) {
      return null;
    }
    // Check auth
    if (!notification.userID || Authorizations.canReadUser(loggedUser, {id: notification.userID})) {
      // No user provided and you are not admin?
      if (!notification.userID && !Authorizations.isAdmin(loggedUser)) {
        // Yes: do not send this notif
        return null;
      }
      filteredNotification = {};
      // Set only necessary info
      filteredNotification.id = notification.id;
      filteredNotification.timestamp = notification.timestamp;
      filteredNotification.channel = notification.channel;
      filteredNotification.sourceId = notification.sourceId;
      filteredNotification.sourceDescr = notification.sourceDescr;
      filteredNotification.userID = notification.userID;
      filteredNotification.chargeBoxID = notification.chargeBoxID;
      filteredNotification.data = notification.data;
      // Handle users
      if (notification.user) {
        filteredNotification.user = NotificationSecurity.getUserSecurity().filterMinimalUserResponse(notification.user, loggedUser);
      }
    }
    return filteredNotification;
  }
}

module.exports = NotificationSecurity;
