import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import { StatusCodes } from 'http-status-codes';
import moment from 'moment';

import ChargingStation from '../../src/types/ChargingStation';
import { HTTPAuthError, HTTPError } from '../../src/types/HTTPError';
import Reservation, { ReservationStatus, ReservationType } from '../../src/types/Reservation';
import config from '../config';
import Factory from '../factories/Factory';
import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import TenantContext from './context/TenantContext';

chai.use(chaiSubset);

class TestData {
  public adminCentralService: CentralServerService;
  public userCentralService: CentralServerService;
  public newReservation: Reservation;
  public createdReservations: Reservation[] = [];
  public tenantContext: TenantContext;
  public adminContext: any;
  public userContext: any;
  public chargingStationContext: ChargingStation[];
}
const testData: TestData = new TestData();
describe('Reservation', () => {
  jest.setTimeout(60000);
  beforeAll(async () => {
    testData.adminCentralService = new CentralServerService(null, {
      email: config.get('admin.username'),
      password: config.get('admin.password'),
    });
    testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(
      ContextDefinition.TENANT_CONTEXTS.TENANT_RESERVATION
    );
    testData.adminContext = await testData.tenantContext.getUserContext(
      ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN
    );
    testData.userContext = await testData.tenantContext.getUserContext(
      ContextDefinition.USER_CONTEXTS.BASIC_USER
    );
    testData.chargingStationContext = testData.tenantContext
      .getChargingStations()
      .map((template) => template.chargingStation);
  });

  afterAll(() => {});

  describe('Without any component (utnothing)', () => {
    describe('Where admin user', () => {
      beforeAll(() => {
        testData.adminCentralService = new CentralServerService(
          ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
          {
            email: config.get('admin.username'),
            password: config.get('admin.password'),
          }
        );
      });
      it('Should not be able to get reservations', async () => {
        const response = await testData.adminCentralService.reservationApi.readAll({});
        expect(response.status).to.equal(StatusCodes.FORBIDDEN);
      });
      it('Should not be able to get reservation by ID', async () => {
        const response = await testData.adminCentralService.reservationApi.read(null);
        expect(response.status).to.equal(StatusCodes.FORBIDDEN);
      });
    });
    describe('Where basic user', () => {
      beforeAll(() => {
        testData.userCentralService = new CentralServerService(
          ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
          {
            email: config.get('basicuser.username'),
            password: config.get('basicuser.password'),
          }
        );
      });
      it('Should not be able to get reservations', async () => {
        const response = await testData.userCentralService.reservationApi.readAll({});
        expect(response.status).to.equal(StatusCodes.FORBIDDEN);
      });
      it('Should not be able to get reservation by ID', async () => {
        const response = await testData.userCentralService.reservationApi.read(null);
        expect(response.status).to.equal(StatusCodes.FORBIDDEN);
      });
    });
  });

  describe('With component reservation (utreservation)', () => {
    describe('Where admin user', () => {
      beforeAll(() => {
        testData.adminCentralService = new CentralServerService(
          ContextDefinition.TENANT_CONTEXTS.TENANT_RESERVATION,
          {
            email: config.get('admin.username'),
            password: config.get('admin.password'),
          }
        );
      });
      it('Should be able to get reservations', async () => {
        const response = await testData.adminCentralService.reservationApi.readAll({});
        expect(response.status).to.equal(StatusCodes.OK);
      });
      it('Should not be able to get reservation without ID', async () => {
        const response = await testData.adminCentralService.reservationApi.read(null);
        expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
      });
      it('Should be able to create a (planned) reservation', async () => {
        const newReservation = Factory.reservation.build({
          chargingStationID: testData.chargingStationContext[0].id,
          idTag: null,
          visualTagID: testData.adminContext.tags[0].visualID,
          type: ReservationType.PLANNED_RESERVATION,
          status: ReservationStatus.SCHEDULED,
        }) as Reservation;
        testData.newReservation = await testData.adminCentralService.createEntity(
          testData.adminCentralService.reservationApi,
          newReservation
        );
        testData.createdReservations.push(testData.newReservation);
      });
      it('Should be able to create a (planned) reservation for another user', async () => {
        const demoUser = testData.tenantContext.getUserContext(
          ContextDefinition.USER_CONTEXTS.DEMO_USER
        );
        const newReservation = Factory.reservation.build({
          chargingStationID: testData.chargingStationContext[1].id,
          idTag: null,
          visualTagID: demoUser.tags[0].visualID,
          type: ReservationType.PLANNED_RESERVATION,
          status: ReservationStatus.SCHEDULED,
        }) as Reservation;
        testData.newReservation = await testData.adminCentralService.createEntity(
          testData.adminCentralService.reservationApi,
          newReservation
        );
        testData.createdReservations.push(testData.newReservation);
      });
      it('Should be able to get reservation by ID', async () => {
        const response = await testData.adminCentralService.reservationApi.read(
          testData.newReservation.id
        );
        expect(response.status).to.equal(StatusCodes.OK);
      });
      it('Should be able to create a reservation without client-provided ID', async () => {
        testData.newReservation = await testData.adminCentralService.createEntity(
          testData.adminCentralService.reservationApi,
          Factory.reservation.build({
            id: undefined,
            chargingStationID: testData.chargingStationContext[1].id,
            visualTagID: testData.adminContext.tags[0].visualID,
            type: ReservationType.PLANNED_RESERVATION,
            status: ReservationStatus.SCHEDULED,
          })
        );
        testData.createdReservations.push(testData.newReservation);
      });
      it('Should not be able to create a reservation without a type', async () => {
        const response = await testData.adminCentralService.createEntity(
          testData.adminCentralService.reservationApi,
          Factory.reservation.build({
            type: null,
            chargingStationID: testData.chargingStationContext[1].id,
            visualTagID: testData.adminContext.tags[0].visualID,
          }),
          false
        );
        expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
      });
      it('Should not be able to create a reservation without a expiry date', async () => {
        const response = await testData.adminCentralService.createEntity(
          testData.adminCentralService.reservationApi,
          Factory.reservation.build({
            chargingStationID: testData.chargingStationContext[1].id,
            visualTagID: testData.newReservation.visualTagID,
            fromDate: null,
            toDate: null,
            arrivalTime: null,
            departureTime: null,
            expiryDate: null,
          }),
          false
        );
        expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
      });
      it('Should not be able to create a reservation with existing ID and another idTag', async () => {
        const response = await testData.adminCentralService.createEntity(
          testData.adminCentralService.reservationApi,
          Factory.reservation.build({
            id: testData.newReservation.id,
            chargingStationID: testData.chargingStationContext[1].id,
            type: ReservationType.PLANNED_RESERVATION,
          }),
          false
        );
        expect(response.status).to.equal(HTTPError.RESERVATION_ALREADY_EXISTS_ERROR);
      });
      it('Should not be able to create a reservation on charging station connector with existing reservation', async () => {
        const response = await testData.adminCentralService.createEntity(
          testData.adminCentralService.reservationApi,
          Factory.reservation.build({
            chargingStationID: testData.newReservation.chargingStationID,
            connectorID: testData.newReservation.connectorID,
            visualTagID: testData.newReservation.visualTagID, // TODO: Change this against another user
            fromDate: testData.newReservation.fromDate,
            toDate: testData.newReservation.toDate,
            arrivalTime: moment(testData.newReservation.arrivalTime).add(1, 'm').toDate(),
            departureTime: moment(testData.newReservation.departureTime).subtract(1, 'm').toDate(),
            type: ReservationType.PLANNED_RESERVATION,
          }),
          false
        );
        expect(response.status).to.equal(HTTPError.RESERVATION_COLLISION_ERROR);
      });
      it('Should not be able to create a reservation on charging station with a collision', async () => {
        const response = await testData.adminCentralService.createEntity(
          testData.adminCentralService.reservationApi,
          Factory.reservation.build({
            chargingStationID: testData.newReservation.chargingStationID,
            connectorID: testData.newReservation.connectorID,
            visualTagID: testData.newReservation.visualTagID, // TODO: Change this against another user
            fromDate: testData.newReservation.fromDate,
            toDate: testData.newReservation.toDate,
            arrivalTime: moment(testData.newReservation.arrivalTime).add(1, 'm').toDate(),
            departureTime: moment(testData.newReservation.departureTime).subtract(1, 'm').toDate(),
            type: ReservationType.PLANNED_RESERVATION,
          }),
          false
        );
        expect(response.status).to.equal(HTTPError.RESERVATION_COLLISION_ERROR);
      });
      it('Should be able to update a reservation', async () => {
        const reservationToUpdate = (
          await testData.adminCentralService.reservationApi.read(testData.createdReservations[0].id)
        ).data;
        reservationToUpdate.visualTagID = testData.createdReservations[0].visualTagID;
        reservationToUpdate.idTag = testData.createdReservations[0].idTag;
        reservationToUpdate.expiryDate = moment(reservationToUpdate.expiryDate)
          .add(1, 'hour')
          .toDate();
        reservationToUpdate.departureTime = moment(reservationToUpdate.departureTime)
          .add(1, 'hour')
          .toDate();
        testData.newReservation = await testData.adminCentralService.updateEntity(
          testData.adminCentralService.reservationApi,
          reservationToUpdate
        );
        testData.createdReservations[0] = reservationToUpdate;
      });
      it('Should not be be able to update a reservation and create a collision', async () => {
        testData.newReservation = await testData.adminCentralService.createEntity(
          testData.adminCentralService.reservationApi,
          Factory.reservation.build({
            chargingStationID: testData.createdReservations[0].chargingStationID,
            connectorID: testData.createdReservations[0].connectorID,
            visualTagID: testData.createdReservations[0].visualTagID, // TODO: Change this against another user
            fromDate: testData.createdReservations[0].fromDate,
            toDate: testData.createdReservations[0].toDate,
            arrivalTime: moment(testData.createdReservations[0].departureTime).add(2, 'h'),
            departureTime: moment(testData.createdReservations[0].departureTime).add(4, 'h'),
            idTag: testData.createdReservations[0].idTag,
            type: testData.createdReservations[0].type,
            status: testData.createdReservations[0].status,
          })
        );
        testData.createdReservations.push(testData.newReservation);
        testData.newReservation.arrivalTime = moment(testData.createdReservations[0].arrivalTime)
          .add(5, 'minutes')
          .toDate();
        testData.newReservation.departureTime = moment(
          testData.createdReservations[0].departureTime
        )
          .subtract(15, 'minutes')
          .toDate();
        testData.newReservation.expiryDate = testData.newReservation.toDate;
        const response = await testData.adminCentralService.updateEntity(
          testData.adminCentralService.reservationApi,
          testData.newReservation,
          false
        );
        expect(response.status).to.equal(HTTPError.RESERVATION_COLLISION_ERROR);
      });
      it('Should be able to cancel a owned reservation', async () => {
        const response = await testData.adminCentralService.reservationApi.cancelReservation(
          testData.createdReservations[0].id,
          testData.createdReservations[0].chargingStationID,
          testData.createdReservations[0].connectorID
        );
        expect(response.status).to.equal(StatusCodes.OK);
      });
      it('Should be able to cancel a reservation of another user', async () => {
        const response = await testData.adminCentralService.reservationApi.cancelReservation(
          testData.createdReservations[0].id,
          testData.createdReservations[0].chargingStationID,
          testData.createdReservations[0].connectorID
        );
        expect(response.status).to.equal(StatusCodes.OK);
      });
      it('Should be able to delete a owned reservation', async () => {
        const response = await testData.adminCentralService.deleteEntity(
          testData.adminCentralService.reservationApi,
          testData.createdReservations.pop()
        );
        expect(response.status).to.equal(StatusCodes.OK);
      });
      it('Should be able to delete a reservation of another user', async () => {
        const response = await testData.adminCentralService.deleteEntity(
          testData.adminCentralService.reservationApi,
          testData.createdReservations[0]
        );
        expect(response.status).to.equal(StatusCodes.OK);
      });
      it('Should not be able to delete a reservation with non-existing ID', async () => {
        const response = await testData.adminCentralService.deleteEntity(
          testData.adminCentralService.reservationApi,
          testData.createdReservations[0],
          false
        );
        expect(response.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
      });
      afterAll(async () => {
        // Delete any created reservation
        for (const reservation of testData.createdReservations) {
          await testData.adminCentralService.deleteEntity(
            testData.adminCentralService.reservationApi,
            reservation,
            false
          );
        }
        testData.createdReservations = [];
      });
    });
    describe('Where basic user', () => {
      beforeAll(() => {
        testData.userCentralService = new CentralServerService(
          ContextDefinition.TENANT_CONTEXTS.TENANT_RESERVATION,
          {
            email: config.get('basicuser.username'),
            password: config.get('basicuser.password'),
          }
        );
        testData.adminCentralService = new CentralServerService(
          ContextDefinition.TENANT_CONTEXTS.TENANT_RESERVATION,
          {
            email: config.get('admin.username'),
            password: config.get('admin.password'),
          }
        );
        testData.userContext = testData.tenantContext.getUserContext(
          ContextDefinition.USER_CONTEXTS.BASIC_USER
        );
      });
      it('Should be able to get reservations', async () => {
        const response = await testData.userCentralService.reservationApi.readAll({});
        expect(response.status).to.equal(StatusCodes.OK);
      });
      it('Should not be able to get reservation without ID', async () => {
        const response = await testData.userCentralService.reservationApi.read(null);
        expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
      });
      it('Should be able to create a (planned) reservation', async () => {
        testData.newReservation = await testData.userCentralService.createEntity(
          testData.userCentralService.reservationApi,
          Factory.reservation.build({
            chargingStationID: testData.chargingStationContext[0].id,
            idTag: null,
            visualTagID: testData.userContext.tags[0].visualID,
            userID: testData.userContext.id,
            type: ReservationType.PLANNED_RESERVATION,
            status: ReservationStatus.SCHEDULED,
          })
        );
        testData.createdReservations.push(testData.newReservation);
      });
      it('Should not be able to create a (planned) reservation for another user', async () => {
        const demoUser = testData.tenantContext.getUserContext(
          ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN
        );
        const response = await testData.userCentralService.createEntity(
          testData.userCentralService.reservationApi,
          Factory.reservation.build({
            chargingStationID: testData.chargingStationContext[0].id,
            idTag: null,
            visualTagID: demoUser.tags[0].visualID,
            userID: testData.adminContext.id,
            type: ReservationType.PLANNED_RESERVATION,
            status: ReservationStatus.SCHEDULED,
          }),
          false
        );
        expect(response.status).to.equal(HTTPAuthError.FORBIDDEN);
      });
      it('Should be able to get reservation by ID', async () => {
        const response = await testData.userCentralService.reservationApi.read(
          testData.newReservation.id
        );
        expect(response.status).to.equal(StatusCodes.OK);
      });
      it('Should be able to create a reservation without client-provided ID', async () => {
        testData.newReservation = await testData.userCentralService.createEntity(
          testData.userCentralService.reservationApi,
          Factory.reservation.build({
            id: undefined,
            chargingStationID: testData.chargingStationContext[1].id,
            visualTagID: testData.userContext.tags[0].visualID,
            userID: testData.userContext.id,
            type: ReservationType.PLANNED_RESERVATION,
            status: ReservationStatus.SCHEDULED,
          })
        );
        testData.createdReservations.push(testData.newReservation);
      });
      it('Should not be able to create a reservation without a type', async () => {
        const response = await testData.userCentralService.createEntity(
          testData.userCentralService.reservationApi,
          Factory.reservation.build({
            type: null,
            chargingStationID: testData.chargingStationContext[1].id,
            visualTagID: testData.userContext.tags[0].visualID,
            userID: testData.userContext.id,
          }),
          false
        );
        expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
      });
      it('Should not be able to create a reservation without a expiry date', async () => {
        const response = await testData.userCentralService.createEntity(
          testData.userCentralService.reservationApi,
          Factory.reservation.build({
            chargingStationID: testData.chargingStationContext[1].id,
            visualTagID: testData.newReservation.visualTagID,
            fromDate: null,
            toDate: null,
            arrivalTime: null,
            departureTime: null,
            expiryDate: null,
            userID: testData.userContext.id,
          }),
          false
        );
        expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
      });
      it('Should not be able to create a reservation with existing ID and another idTag', async () => {
        const response = await testData.userCentralService.createEntity(
          testData.userCentralService.reservationApi,
          Factory.reservation.build({
            id: testData.newReservation.id,
            chargingStationID: testData.chargingStationContext[1].id,
            type: ReservationType.PLANNED_RESERVATION,
            userID: testData.userContext.id,
          }),
          false
        );
        expect(response.status).to.equal(HTTPError.RESERVATION_ALREADY_EXISTS_ERROR);
      });
      it('Should not be able to create a reservation on charging station connector with existing reservation', async () => {
        const response = await testData.userCentralService.createEntity(
          testData.userCentralService.reservationApi,
          Factory.reservation.build({
            chargingStationID: testData.newReservation.chargingStationID,
            connectorID: testData.newReservation.connectorID,
            visualTagID: testData.newReservation.visualTagID, // TODO: Change this against another user
            fromDate: testData.newReservation.fromDate,
            toDate: testData.newReservation.toDate,
            arrivalTime: moment(testData.newReservation.arrivalTime).add(1, 'm').toDate(),
            departureTime: moment(testData.newReservation.departureTime).subtract(1, 'm').toDate(),
            type: ReservationType.PLANNED_RESERVATION,
            userID: testData.userContext.id,
          }),
          false
        );
        expect(response.status).to.equal(HTTPError.RESERVATION_COLLISION_ERROR);
      });
      it('Should not be able to create a reservation on charging station with a collision', async () => {
        const response = await testData.userCentralService.createEntity(
          testData.userCentralService.reservationApi,
          Factory.reservation.build({
            chargingStationID: testData.newReservation.chargingStationID,
            connectorID: testData.newReservation.connectorID,
            visualTagID: testData.newReservation.visualTagID, // TODO: Change this against another user
            fromDate: testData.newReservation.fromDate,
            toDate: testData.newReservation.toDate,
            arrivalTime: moment(testData.newReservation.arrivalTime).add(1, 'm').toDate(),
            departureTime: moment(testData.newReservation.departureTime).subtract(1, 'm').toDate(),
            type: ReservationType.PLANNED_RESERVATION,
            userID: testData.userContext.id,
          }),
          false
        );
        expect(response.status).to.equal(HTTPError.RESERVATION_COLLISION_ERROR);
      });
      it('Should be able to update a reservation', async () => {
        const reservationToUpdate = (
          await testData.userCentralService.reservationApi.read(testData.createdReservations[0].id)
        ).data;
        reservationToUpdate.userID = testData.userContext.id;
        reservationToUpdate.visualTagID = testData.createdReservations[0].visualTagID;
        reservationToUpdate.idTag = testData.createdReservations[0].idTag;
        reservationToUpdate.expiryDate = moment(reservationToUpdate.expiryDate)
          .add(1, 'hour')
          .toDate();
        reservationToUpdate.departureTime = moment(reservationToUpdate.departureTime)
          .add(1, 'hour')
          .toDate();
        testData.newReservation = await testData.userCentralService.updateEntity(
          testData.userCentralService.reservationApi,
          reservationToUpdate
        );
        testData.createdReservations[0] = reservationToUpdate;
      });
      it('Should not be be able to update a reservation and create a collision', async () => {
        testData.newReservation = await testData.userCentralService.createEntity(
          testData.userCentralService.reservationApi,
          Factory.reservation.build({
            chargingStationID: testData.createdReservations[0].chargingStationID,
            connectorID: testData.createdReservations[0].connectorID,
            visualTagID: testData.createdReservations[0].visualTagID, // TODO: Change this against another user
            fromDate: testData.createdReservations[0].fromDate,
            toDate: testData.createdReservations[0].toDate,
            arrivalTime: moment(testData.createdReservations[0].departureTime).add(2, 'h'),
            departureTime: moment(testData.createdReservations[0].departureTime).add(4, 'h'),
            idTag: testData.createdReservations[0].idTag,
            type: testData.createdReservations[0].type,
            status: testData.createdReservations[0].status,
            userID: testData.userContext.id,
          })
        );
        testData.createdReservations.push(testData.newReservation);
        testData.newReservation.arrivalTime = moment(testData.createdReservations[0].arrivalTime)
          .add(5, 'minutes')
          .toDate();
        testData.newReservation.departureTime = moment(
          testData.createdReservations[0].departureTime
        )
          .subtract(15, 'minutes')
          .toDate();
        testData.newReservation.expiryDate = testData.newReservation.toDate;
        const response = await testData.userCentralService.updateEntity(
          testData.userCentralService.reservationApi,
          testData.newReservation,
          false
        );
        expect(response.status).to.equal(HTTPError.RESERVATION_COLLISION_ERROR);
      });
      it('Should be able to cancel a owned reservation', async () => {
        const response = await testData.userCentralService.reservationApi.cancelReservation(
          testData.createdReservations[0].id,
          testData.createdReservations[0].chargingStationID,
          testData.createdReservations[0].connectorID,
          testData.createdReservations[0].userID
        );
        expect(response.status).to.equal(StatusCodes.OK);
      });
      it('Should not be able to cancel a reservation of another user', async () => {
        const otherReservation = await testData.adminCentralService.createEntity(
          testData.adminCentralService.reservationApi,
          Factory.reservation.build({
            chargingStationID: testData.chargingStationContext[0].id,
            idTag: null,
            visualTagID: testData.adminContext.tags[0].visualID,
            type: ReservationType.PLANNED_RESERVATION,
            status: ReservationStatus.SCHEDULED,
          })
        );
        testData.createdReservations.push(otherReservation);
        const response = await testData.userCentralService.reservationApi.cancelReservation(
          otherReservation.id,
          otherReservation.chargingStationID,
          otherReservation.connectorID
        );
        expect(response.status).to.equal(HTTPAuthError.FORBIDDEN);
      });
      it('Should not be able to delete a reservation', async () => {
        const response = await testData.userCentralService.deleteEntity(
          testData.userCentralService.reservationApi,
          testData.createdReservations[0],
          false
        );
        expect(response.status).to.equal(HTTPAuthError.FORBIDDEN);
      });
      afterAll(async () => {
        // Delete any created reservation
        for (const reservation of testData.createdReservations) {
          await testData.adminCentralService.deleteEntity(
            testData.adminCentralService.reservationApi,
            reservation,
            false
          );
        }
      });
    });
  });
});
