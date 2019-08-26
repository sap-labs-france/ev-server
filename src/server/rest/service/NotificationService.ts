import { NextFunction, Request, Response } from 'express';
import Logging from '../../../utils/Logging';
import Notification from '../../../entity/Notification';
import NotificationSecurity from './security/NotificationSecurity';

export default class NotificationService {
  static async handleGetNotifications(action: string, req: Request, res: Response, next: NextFunction) {
    try {
      // Filter
      const filteredRequest = NotificationSecurity.filterNotificationsRequest(req.query);
      // Get the Notification
      const notifications = await Notification.getNotifications(req.user.tenantID, {
        'userID': filteredRequest.UserID,
        'dateFrom': filteredRequest.DateFrom,
        'channel': filteredRequest.Channel
      }, filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
      // Set
      notifications.result = notifications.result.map((notification) => notification.getModel());
      // Filter
      NotificationSecurity.filterNotificationsResponse(notifications, req.user);
      // Return
      res.json(notifications);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }
}

