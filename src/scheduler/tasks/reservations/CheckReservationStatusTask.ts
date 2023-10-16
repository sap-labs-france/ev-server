import moment from 'moment';

import LockingManager from '../../../locking/LockingManager';
import ReservationService from '../../../server/rest/v1/service/ReservationService';
import ReservationStorage from '../../../storage/mongodb/ReservationStorage';
import { LockEntity } from '../../../types/Locking';
import Reservation, { ReservationStatus } from '../../../types/Reservation';
import { ServerAction } from '../../../types/Server';
import { TaskConfig } from '../../../types/TaskConfig';
import Tenant, { TenantComponents } from '../../../types/Tenant';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import NotificationHelper from '../../../utils/NotificationHelper';
import Utils from '../../../utils/Utils';
import TenantSchedulerTask from '../../TenantSchedulerTask';

const MODULE_NAME = 'CheckReservationStatusTask';

export default class CheckReservationStatusTask extends TenantSchedulerTask {
  public async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    if (!Utils.isTenantComponentActive(tenant, TenantComponents.RESERVATION)) {
      await Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.RESERVATIONS_EXPIRE,
        module: MODULE_NAME,
        method: 'run',
        message: 'Reservations not active in this Tenant',
      });
      return;
    }
    const expiredReservationsLock = LockingManager.createExclusiveLock(
      tenant.id,
      LockEntity.RESERVATION,
      'update-expired-reservations'
    );
    if (await LockingManager.acquire(expiredReservationsLock)) {
      try {
        const expiredReservations = await ReservationStorage.getReservations(
          tenant,
          {
            withChargingStation: true,
            withTag: true,
            withUser: true,
            expiryDate: moment().toDate(),
            statuses: [ReservationStatus.IN_PROGRESS, ReservationStatus.SCHEDULED],
          },
          Constants.DB_PARAMS_MAX_LIMIT
        );
        if (!Utils.isEmptyArray(expiredReservations.result)) {
          const reservationsToUpdate: Reservation[] = [];
          for (const reservation of expiredReservations.result) {
            reservation.status = ReservationStatus.EXPIRED;
            await ReservationService.resetConnectorReservation(
              tenant,
              reservation.chargingStation,
              reservation.connectorID
            );
            NotificationHelper.notifyReservationStatusChanged(
              tenant,
              reservation.tag.user,
              reservation
            );
            reservationsToUpdate.push(reservation);
          }
          await ReservationStorage.saveReservations(tenant, reservationsToUpdate);
        }
      } catch (error) {
        await Logging.logActionExceptionMessage(
          tenant.id,
          ServerAction.RESERVATIONS_EXPIRE,
          error as Error
        );
      } finally {
        await LockingManager.release(expiredReservationsLock);
      }
    }
  }
}
