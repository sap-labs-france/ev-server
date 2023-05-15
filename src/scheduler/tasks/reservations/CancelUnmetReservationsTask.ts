import moment from 'moment';

import ChargingStationClientFactory from '../../../client/ocpp/ChargingStationClientFactory';
import LockingManager from '../../../locking/LockingManager';
import ReservationStorage from '../../../storage/mongodb/ReservationStorage';
import { LockEntity } from '../../../types/Locking';
import { ChargePointStatus } from '../../../types/ocpp/OCPPServer';
import Reservation, { ReservationStatus } from '../../../types/Reservation';
import { ServerAction } from '../../../types/Server';
import { TaskConfig } from '../../../types/TaskConfig';
import Tenant, { TenantComponents } from '../../../types/Tenant';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import NotificationHelper from '../../../utils/NotificationHelper';
import Utils from '../../../utils/Utils';
import TenantSchedulerTask from '../../TenantSchedulerTask';

const MODULE_NAME = 'CancelUnmetReservationsTask';
const THRESHOLD = 15;

export default class CancelUnmetReservationsTask extends TenantSchedulerTask {
  public async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    if (!Utils.isTenantComponentActive(tenant, TenantComponents.RESERVATION)) {
      await Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.RESERVATION_CANCEL,
        module: MODULE_NAME,
        method: 'run',
        message: 'Reservations not active in this Tenant',
      });
      return;
    }
    const unmetReservationsLock = LockingManager.createExclusiveLock(
      tenant.id,
      LockEntity.RESERVATION,
      'cancel-unmet-reservations'
    );
    if (await LockingManager.acquire(unmetReservationsLock)) {
      try {
        const unmetReservations = await ReservationStorage.getReservations(
          tenant,
          {
            withChargingStation: true,
            withTag: true,
            withUser: true,
            dateRange: {
              fromDate: moment().toDate(),
            },
            slot: {
              arrivalTime: moment().subtract(THRESHOLD, 'minutes').toDate(),
            },
            statuses: [ReservationStatus.IN_PROGRESS],
          },
          Constants.DB_PARAMS_MAX_LIMIT
        );
        if (!Utils.isEmptyArray(unmetReservations.result)) {
          const reservationsToUpdate: Reservation[] = [];
          for (const reservation of unmetReservations.result) {
            const currentArrivalTime = Utils.buildDateTimeObject(
              moment().toDate(),
              reservation.arrivalTime
            );
            const connector = Utils.getConnectorFromID(
              reservation.chargingStation,
              reservation.connectorID
            );
            if (
              moment().diff(moment(currentArrivalTime), 'minutes') < THRESHOLD ||
              connector.status !== ChargePointStatus.RESERVED
            ) {
              continue;
            }
            const chargingStationClient =
              await ChargingStationClientFactory.getChargingStationClient(
                tenant,
                reservation.chargingStation
              );
            reservation.status = ReservationStatus.UNMET;
            const response = await chargingStationClient.cancelReservation({
              reservationId: reservation.id,
            });
            if (response.status.toUpperCase() === 'ACCEPTED') {
              NotificationHelper.notifyReservationUnmet(tenant, reservation.tag.user, reservation);
              reservationsToUpdate.push(reservation);
            }
          }
          await ReservationStorage.saveReservations(tenant, reservationsToUpdate);
        }
      } catch (error) {
        await Logging.logActionExceptionMessage(
          tenant.id,
          ServerAction.RESERVATION_UNMET,
          error as Error
        );
      } finally {
        await LockingManager.release(unmetReservationsLock);
      }
    }
  }
}
