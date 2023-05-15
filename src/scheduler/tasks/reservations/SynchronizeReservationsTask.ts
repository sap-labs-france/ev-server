import moment from 'moment';

import ChargingStationClientFactory from '../../../client/ocpp/ChargingStationClientFactory';
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

const MODULE_NAME = 'SynchronizeReservationsTask';

export default class SynchronizeReservationsTask extends TenantSchedulerTask {
  public async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    if (!Utils.isTenantComponentActive(tenant, TenantComponents.RESERVATION)) {
      await Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.SYNCHRONIZE_RESERVATIONS,
        module: MODULE_NAME,
        method: 'run',
        message: 'Reservations not active in this Tenant',
      });
      return;
    }
    const reservationsLock = LockingManager.createExclusiveLock(
      tenant.id,
      LockEntity.RESERVATION,
      'synchronize-reservations'
    );
    if (await LockingManager.acquire(reservationsLock)) {
      try {
        const upcomingReservations = await ReservationStorage.getReservations(
          tenant,
          {
            withChargingStation: true,
            withTag: true,
            withUser: true,
            dateRange: {
              fromDate: moment().toDate(),
            },
            slot: {
              arrivalTime: moment().toDate(),
              departureTime: moment().add(15, 'minutes').toDate(),
            },
            statuses: [ReservationStatus.SCHEDULED],
          },
          Constants.DB_PARAMS_MAX_LIMIT
        );
        const ongoingReservations = await ReservationStorage.getReservations(
          tenant,
          {
            withChargingStation: true,
            slot: {
              arrivalTime: moment().toDate(),
              departureTime: moment().add(15, 'minutes').toDate(),
            },
            statuses: [ReservationStatus.IN_PROGRESS],
          },
          Constants.DB_PARAMS_MAX_LIMIT
        );
        await this.synchronizeWithChargingStation(
          [...upcomingReservations.result, ...ongoingReservations.result],
          tenant
        );
      } catch (error) {
        await Logging.logActionExceptionMessage(
          tenant.id,
          ServerAction.SYNCHRONIZE_RESERVATIONS,
          error as Error
        );
      } finally {
        await LockingManager.release(reservationsLock);
      }
    }
  }

  private async synchronizeWithChargingStation(reservations: Reservation[], tenant: Tenant) {
    if (!Utils.isEmptyArray(reservations)) {
      for (const reservation of reservations) {
        const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(
          tenant,
          reservation.chargingStation
        );
        const connector = Utils.getConnectorFromID(
          reservation.chargingStation,
          reservation.connectorID
        );
        if (connector.currentTransactionID && connector.currentTagID !== reservation.idTag) {
          await chargingStationClient.remoteStopTransaction({
            transactionId: connector.currentTransactionID,
          });
          return;
        }
        const response = await chargingStationClient.reserveNow({
          connectorId: reservation.connectorID,
          expiryDate: Utils.buildDateTimeObject(moment().toDate(), reservation.departureTime),
          idTag: reservation.idTag,
          reservationId: reservation.id,
          parentIdTag: reservation.parentIdTag ?? '',
        });
        if (response.status.toUpperCase() === 'ACCEPTED') {
          const oldStatus = reservation.status;
          reservation.status = ReservationStatus.IN_PROGRESS;
          if (oldStatus !== reservation.status) {
            NotificationHelper.notifyReservationUpcoming(tenant, reservation.tag.user, reservation);
            await ReservationStorage.saveReservation(tenant, reservation);
          }
          await ReservationService.updateConnectorWithReservation(
            tenant,
            reservation.chargingStation,
            reservation,
            true
          );
        }
      }
    }
  }
}
