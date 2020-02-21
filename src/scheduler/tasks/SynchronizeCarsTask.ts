import SchedulerTask from '../SchedulerTask';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import CarStorage from '../../storage/mongodb/CarStorage';
import NotificationHandler from '../../notification/NotificationHandler';
import Utils from '../../utils/Utils';
import Constants from '../../utils/Constants';

export default class SynchronizeCarsTask extends SchedulerTask {
  async run(name: string, config: TaskConfig): Promise<void> {
    const cars = await CarStorage.getCarsFromAPI();
    if (cars && cars.length > 0) {
      const synchronizeAction = await CarStorage.syncCars(cars);
      if (synchronizeAction.error > 0) {
        await NotificationHandler.sendCarsSynchronizationFailed(
          {
            nbrCarsInError: synchronizeAction.error,
            evseDashboardURL: Utils.buildEvseURL(Constants.DEFAULT_TENANT)
          }
        );
      }
    }
  }
}
