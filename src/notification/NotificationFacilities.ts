import Configuration from '../utils/Configuration';
import EMailNotificationTask from './email/EMailNotificationTask';
import { NotificationSource } from '../types/UserNotifications';
import NotificationTask from './NotificationTask';
import RemotePushNotificationTask from './remote-push-notification/RemotePushNotificationTask';
import User from '../types/User';

// const MODULE_NAME = 'NotificationFacilities';

export default class UserNotificationFacilities {
  private static notificationConfig = Configuration.getNotificationConfig();
  private static notificationSources: NotificationSource[] = [
    {
      channel: 'email',
      notificationTask: new EMailNotificationTask(),
      enabled: !!UserNotificationFacilities.notificationConfig.Email?.enabled
    },
    {
      channel: 'remote-push-notification',
      notificationTask: new RemotePushNotificationTask(),
      enabled: !!UserNotificationFacilities.notificationConfig.RemotePushNotification?.enabled
    }
  ];

  public static notifyUser(user: User, doIt: (task: NotificationTask) => void): void {
    for (const channel of UserNotificationFacilities.notificationSources.filter((_channel) => _channel.enabled)) {
      doIt(channel.notificationTask);
    }
  }
}
