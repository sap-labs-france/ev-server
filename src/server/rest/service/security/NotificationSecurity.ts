import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import UtilsSecurity from './UtilsSecurity';
import UserSecurity from './UserSecurity';

export default class NotificationSecurity {
  // eslint-disable-next-line no-unused-vars
  static filterNotificationsRequest(request, loggedUser) {
    const filteredRequest: any = {};
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
    if (!notification.userID || Authorizations.canReadUser(loggedUser, notification.userID)) {
      // No user provided and you are not admin?
      if (!notification.userID && !Authorizations.isAdmin(loggedUser.role)) {
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
        filteredNotification.user = UserSecurity.filterMinimalUserResponse(notification.user, loggedUser);
      }
    }
    return filteredNotification;
  }
}

