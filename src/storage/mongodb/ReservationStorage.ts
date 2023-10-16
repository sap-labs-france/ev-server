import moment from 'moment';

import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import { ReservationDataResult } from '../../types/DataResult';
import global, { DatabaseCount, FilterParams } from '../../types/GlobalType';
import Reservation, { ReservationStatus, ReservationType } from '../../types/Reservation';
import Tenant from '../../types/Tenant';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import ReservationValidatorStorage from '../validator/ReservationValidatorStorage';

const MODULE_NAME = 'ReservationStorage';
const COLLECTION_NAME = 'reservations';

export default class ReservationStorage {
  public static async getReservations(
    tenant: Tenant,
    params: {
      search?: string;
      reservationIDs?: string[];
      chargingStationIDs?: string[];
      connectorIDs?: string[];
      userIDs?: string[];
      siteIDs?: string[];
      siteAreaIDs?: string[];
      companyIDs?: string[];
      dateRange?: { fromDate?: Date; toDate?: Date };
      expiryDate?: Date;
      slot?: { arrivalTime?: Date; departureTime?: Date };
      statuses?: string[];
      types?: string[];
      withUser?: boolean;
      withChargingStation?: boolean;
      withCar?: boolean;
      withTag?: boolean;
      withCompany?: boolean;
      withSite?: boolean;
      withSiteArea?: boolean;
    } = {},
    dbParams: DbParams,
    projectFields?: string[]
  ): Promise<ReservationDataResult> {
    const startTime = Logging.traceDatabaseRequestStart();
    const METHOD_NAME = this.getReservations.name;
    DatabaseUtils.checkTenantObject(tenant);

    dbParams = Utils.cloneObject(dbParams);
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);

    params.withChargingStation =
      params.withChargingStation ??
      (!!params.siteAreaIDs ||
        !!params.siteIDs ||
        !!params.companyIDs ||
        !!params.withSite ||
        !!params.withSiteArea);
    params.withTag = params.withTag ?? (!!params.userIDs || !!params.withUser);

    const filters: FilterParams = {};
    const aggregation = [];

    if (params.search) {
      filters.$or = [];
      filters.$or.push(
        { _id: { $regex: params.search, $options: 'i' } },
        { type: { $regex: params.search, $options: 'i' } },
        { status: { $regex: params.search, $options: 'i' } },
        { chargingStationID: { $regex: params.search, $options: 'i' } }
      );
    }
    if (!Utils.isEmptyArray(params.reservationIDs)) {
      filters._id = {
        $in: params.reservationIDs.map((reservationID) => Utils.convertToInt(reservationID)),
      };
    }
    if (!Utils.isEmptyArray(params.chargingStationIDs)) {
      filters.chargingStationID = { $in: params.chargingStationIDs };
    }
    if (!Utils.isEmptyArray(params.connectorIDs)) {
      filters.connectorID = {
        $in: params.connectorIDs.map((connectorID) => Utils.convertToInt(connectorID)),
      };
    }
    if (!Utils.isNullOrUndefined(params.statuses)) {
      filters.status = { $in: params.statuses.map((status) => status) };
    }
    if (!Utils.isEmptyArray(params.types)) {
      filters.type = {
        $in: params.types.map((t) => t),
      };
    }

    const dateRange = ReservationStorage.generateDateRangeFilter(
      'fromDate',
      moment(params.dateRange?.fromDate ?? '').toDate(),
      'toDate',
      moment(params.dateRange?.toDate ?? '').toDate()
    );
    const timeRange = ReservationStorage.generateDateRangeFilter(
      'formattedArrivalTime',
      moment(params.slot?.arrivalTime ?? '').format('HH:mm'),
      'formattedDepartureTime',
      moment(params.slot?.departureTime ?? '').format('HH:mm'),
      'HH:mm'
    );
    const dateTimeRange: FilterParams = { $and: [] };
    if (!Utils.isEmptyArray(dateRange.$or)) {
      dateTimeRange.$and.push(dateRange);
    }
    if (!Utils.isEmptyArray(timeRange.$or)) {
      // Date Conversion
      DatabaseUtils.pushDateToTimeProjection(
        aggregation,
        new Map([
          ['formattedArrivalTime', 'arrivalTime'],
          ['formattedDepartureTime', 'departureTime'],
        ])
      );
      dateTimeRange.$and.push(timeRange);
    }
    if (!Utils.isEmptyArray(dateTimeRange.$and)) {
      filters.$and = dateTimeRange.$and;
    }

    if (params.expiryDate) {
      // Param for searching expired reservations
      filters.expiryDate = {};
      filters.expiryDate.$lte = moment(params.expiryDate).toDate();
    }

    if (params.withCar) {
      DatabaseUtils.pushCarLookupInAggregation({
        tenantID: tenant.id,
        aggregation: aggregation,
        asField: 'car',
        localField: 'carID',
        foreignField: '_id',
        oneToOneCardinality: true,
        oneToOneCardinalityNotNull: false,
      });
      // Car Catalog
      DatabaseUtils.pushCarCatalogLookupInAggregation({
        tenantID: Constants.DEFAULT_TENANT_ID,
        aggregation,
        localField: 'car.carCatalogID',
        asField: 'car.carCatalog',
        foreignField: '_id',
        oneToOneCardinality: true,
      });
    }
    if (params.withTag) {
      DatabaseUtils.pushTagLookupInAggregation({
        tenantID: tenant.id,
        aggregation: aggregation,
        localField: 'idTag',
        foreignField: '_id',
        asField: 'tag',
        oneToOneCardinality: true,
        oneToOneCardinalityNotNull: true,
      });
      if (params.search) {
        filters.$or.push({ 'tag.visualID': { $regex: params.search, $options: 'im' } });
      }
      if (params.withUser) {
        DatabaseUtils.pushUserLookupInAggregation({
          tenantID: tenant.id,
          aggregation: aggregation,
          asField: 'tag.user',
          localField: 'tag.userID',
          foreignField: '_id',
          oneToOneCardinality: true,
          oneToOneCardinalityNotNull: true,
        });
      }
    }
    if (params.withChargingStation) {
      DatabaseUtils.pushChargingStationLookupInAggregation({
        tenantID: tenant.id,
        aggregation: aggregation,
        asField: 'chargingStation',
        localField: 'chargingStationID',
        foreignField: '_id',
        oneToOneCardinality: true,
        oneToOneCardinalityNotNull: false,
      });
      if (params.withCompany) {
        DatabaseUtils.pushCompanyLookupInAggregation({
          tenantID: tenant.id,
          aggregation: aggregation,
          asField: 'chargingStation.company',
          localField: 'chargingStation.companyID',
          foreignField: '_id',
          oneToOneCardinality: true,
          oneToOneCardinalityNotNull: false,
        });
      }
      if (params.withSite) {
        DatabaseUtils.pushSiteLookupInAggregation({
          tenantID: tenant.id,
          aggregation: aggregation,
          asField: 'chargingStation.site',
          localField: 'chargingStation.siteID',
          foreignField: '_id',
          oneToOneCardinality: true,
          oneToOneCardinalityNotNull: false,
        });
        if (params.search) {
          filters.$or.push({
            'chargingStation.site.name': { $regex: params.search, $options: 'im' },
          });
        }
      }
      if (params.withSiteArea) {
        DatabaseUtils.pushSiteAreaLookupInAggregation({
          tenantID: tenant.id,
          aggregation: aggregation,
          asField: 'chargingStation.siteArea',
          localField: 'chargingStation.siteAreaID',
          foreignField: '_id',
          oneToOneCardinality: true,
          oneToOneCardinalityNotNull: false,
        });
        if (params.search) {
          filters.$or.push({
            'chargingStation.siteArea.name': { $regex: params.search, $options: 'im' },
          });
        }
      }
    }

    if (!Utils.isEmptyArray(params.userIDs)) {
      aggregation.push({
        $match: {
          'tag.userID': {
            $in: params.userIDs.map((userID) => DatabaseUtils.convertToObjectID(userID)),
          },
        },
      });
    }
    if (!Utils.isEmptyArray(params.siteIDs)) {
      aggregation.push({
        $match: {
          'chargingStation.siteID': {
            $in: params.siteIDs.map((site) => DatabaseUtils.convertToObjectID(site)),
          },
        },
      });
    }
    if (!Utils.isEmptyArray(params.siteAreaIDs)) {
      aggregation.push({
        $match: {
          'chargingStation.siteAreaID': {
            $in: params.siteAreaIDs.map((siteArea) => DatabaseUtils.convertToObjectID(siteArea)),
          },
        },
      });
    }
    if (!Utils.isEmptyArray(params.companyIDs)) {
      aggregation.push({
        $match: {
          'chargingStation.companyID': {
            $in: params.companyIDs.map((company) => DatabaseUtils.convertToObjectID(company)),
          },
        },
      });
    }

    aggregation.push({ $match: filters });

    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const reservationsCountMDB = (await global.database
      .getCollection<any>(tenant.id, COLLECTION_NAME)
      .aggregate([...aggregation, { $count: 'count' }])
      .toArray()) as DatabaseCount[];

    if (dbParams.onlyRecordCount) {
      await Logging.traceDatabaseRequestEnd(
        tenant,
        MODULE_NAME,
        METHOD_NAME,
        startTime,
        reservationsCountMDB
      );
      return {
        count: reservationsCountMDB.length > 0 ? reservationsCountMDB[0].count : 0,
        result: [],
      };
    }

    // Remove the limit
    aggregation.pop();

    // Sanitize missing dbParams
    if (!dbParams.sort) {
      dbParams.sort = { expiryDate: -1 };
    }
    if (!dbParams.skip) {
      dbParams.skip = 0;
    }
    if (!dbParams.limit) {
      dbParams.limit = 1;
    }
    aggregation.push({
      $sort: dbParams.sort,
    });
    // Skip
    aggregation.push({
      $skip: dbParams.skip,
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit,
    });

    // Change ID
    DatabaseUtils.pushRenameDatabaseIDToNumber(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'carID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'tag.userID');
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);

    const reservations = (await global.database
      .getCollection<any>(tenant.id, COLLECTION_NAME)
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray()) as Reservation[];
    await Logging.traceDatabaseRequestEnd(
      tenant,
      MODULE_NAME,
      METHOD_NAME,
      startTime,
      reservations
    );
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(reservationsCountMDB[0]),
      result: reservations,
    };
  }

  public static async getReservation(
    tenant: Tenant,
    id: number = Constants.UNKNOWN_NUMBER_ID,
    params: {
      withUser?: boolean;
      withChargingStation?: boolean;
      withCar?: boolean;
      withTag?: boolean;
      withCompany?: boolean;
      withSite?: boolean;
      withSiteArea?: boolean;
    } = {},
    projectFields?: string[]
  ): Promise<Reservation> {
    const startTime = Logging.traceDatabaseRequestStart();
    const METHOD_NAME = this.getReservation.name;
    DatabaseUtils.checkTenantObject(tenant);
    const reservations = await ReservationStorage.getReservations(
      tenant,
      {
        reservationIDs: [id.toString()],
        withUser: params.withUser,
        withChargingStation: params.withChargingStation,
        withCar: params.withCar,
        withTag: params.withTag,
        withCompany: params.withCompany,
        withSite: params.withSite,
        withSiteArea: params.withSiteArea,
      },
      Constants.DB_PARAMS_SINGLE_RECORD,
      projectFields
    );
    const reservation = reservations.count === 1 ? reservations.result.pop() : null;
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, METHOD_NAME, startTime, reservation);
    return reservation;
  }

  public static async saveReservation(
    tenant: Tenant,
    reservationToSave: Reservation
  ): Promise<Reservation> {
    const startTime = Logging.traceDatabaseRequestStart();
    const METHOD_NAME = this.saveReservation.name;
    DatabaseUtils.checkTenantObject(tenant);
    const reservation =
      ReservationValidatorStorage.getInstance().validateReservation(reservationToSave);
    const reservationMDB = {
      _id: reservation.id,
      chargingStationID: reservation.chargingStationID,
      connectorID: reservation.connectorID,
      fromDate: reservation.fromDate,
      toDate: reservation.toDate,
      expiryDate: reservation.expiryDate,
      arrivalTime: reservation.arrivalTime,
      departureTime: reservation.departureTime,
      idTag: reservation.idTag,
      parentIdTag: reservation.parentIdTag,
      carID: reservation.carID ? DatabaseUtils.convertToObjectID(reservation.carID) : null,
      userID: DatabaseUtils.convertToObjectID(reservation.userID),
      type: reservation.type,
      status: reservation.status,
    };
    DatabaseUtils.addLastChangedCreatedProps(reservationMDB, reservationToSave);
    const createdReservation = await global.database
      .getCollection<any>(tenant.id, COLLECTION_NAME)
      .findOneAndUpdate(
        { _id: reservationMDB._id },
        {
          $set: reservationMDB,
        },
        { upsert: true, returnDocument: 'after' }
      );
    await Logging.traceDatabaseRequestEnd(
      tenant,
      MODULE_NAME,
      METHOD_NAME,
      startTime,
      createdReservation
    );
    return { id: createdReservation.value._id, ...createdReservation.value } as Reservation;
  }

  public static async saveReservations(
    tenant: Tenant,
    reservationsToUpdate: Reservation[]
  ): Promise<Reservation[]> {
    const startTime = Logging.traceDatabaseRequestStart();
    const METHOD_NAME = this.saveReservations.name;
    const updatedReservations: Reservation[] = [];
    for (const reservation of reservationsToUpdate) {
      updatedReservations.push(await this.saveReservation(tenant, reservation));
    }
    await Logging.traceDatabaseRequestEnd(
      tenant,
      MODULE_NAME,
      METHOD_NAME,
      startTime,
      updatedReservations
    );
    return updatedReservations;
  }

  public static async deleteReservation(tenant: Tenant, reservationID: number): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    const METHOD_NAME = this.deleteReservation.name;
    DatabaseUtils.checkTenantObject(tenant);
    await global.database
      .getCollection<any>(tenant.id, COLLECTION_NAME)
      .deleteOne({ _id: reservationID });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, METHOD_NAME, startTime, {
      reservationID,
    });
  }

  public static async updateReservationStatus(
    tenant: Tenant,
    reservationID: number,
    status: ReservationStatus = ReservationStatus.CANCELLED
  ): Promise<Reservation> {
    const startTime = Logging.traceDatabaseRequestStart();
    const METHOD_NAME = this.updateReservationStatus.name;
    DatabaseUtils.checkTenantObject(tenant);
    const filters: FilterParams = {};
    filters._id = {
      $eq: reservationID,
    };
    const cancelledReservation = await global.database
      .getCollection<any>(tenant.id, COLLECTION_NAME)
      .findOneAndUpdate(
        filters,
        {
          $set: {
            status: status,
          },
        },
        { returnDocument: 'after' }
      );
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, METHOD_NAME, startTime, {
      reservationID,
    });
    return cancelledReservation.value as Reservation;
  }

  public static async getReservationsByDate(
    tenant: Tenant,
    fromDate: Date,
    toDate: Date,
    arrivalTime?: Date,
    departureTime?: Date,
    expiryDate?: Date
  ): Promise<Reservation[]> {
    const startTime = Logging.traceDatabaseRequestStart();
    const METHOD_NAME = this.getReservationsByDate.name;
    const reservationsInRange = await ReservationStorage.getReservations(
      tenant,
      {
        dateRange: { fromDate, toDate },
        slot: { arrivalTime, departureTime },
      },
      Constants.DB_PARAMS_MAX_LIMIT
    );
    await Logging.traceDatabaseRequestEnd(
      tenant,
      MODULE_NAME,
      METHOD_NAME,
      startTime,
      reservationsInRange
    );
    return reservationsInRange.result;
  }

  public static async getReservationsForUser(
    tenant: Tenant,
    userID: string,
    type?: ReservationType,
    status?: ReservationStatus
  ): Promise<Reservation[]> {
    const reservations = await this.getReservations(
      tenant,
      {
        withTag: true,
        withUser: true,
        userIDs: [userID],
        types: [type],
        statuses: [status],
      },
      Constants.DB_PARAMS_MAX_LIMIT
    );
    return reservations.result;
  }

  public static async deleteReservations(
    tenant: Tenant,
    reservationIDs: number[]
  ): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete
    const result = await global.database
      .getCollection<any>(tenant.id, COLLECTION_NAME)
      .deleteMany({ _id: { $in: reservationIDs } });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteReservations', startTime, {
      reservationIDs,
    });
    return result.deletedCount;
  }

  private static generateDateRangeFilter(
    lowerBoundName: string,
    lowerBoundValue: Date | string,
    upperBoundName: string,
    upperBoundValue: Date | string,
    format?: string
  ) {
    const dateRange: FilterParams = {};
    dateRange.$or = [];
    if (moment(lowerBoundValue, format).isValid() && moment(upperBoundValue, format).isValid()) {
      dateRange.$or.push(
        {
          $and: [
            { [`${lowerBoundName}`]: { $lte: lowerBoundValue } },
            { [`${upperBoundName}`]: { $gte: lowerBoundValue } },
          ],
        },
        {
          $and: [
            { [`${lowerBoundName}`]: { $lte: upperBoundValue } },
            { [`${upperBoundName}`]: { $gte: upperBoundValue } },
          ],
        },
        {
          [`${lowerBoundName}`]: {
            $gte: lowerBoundValue,
            $lt: upperBoundValue,
          },
        },
        {
          [`${upperBoundName}`]: {
            $gte: lowerBoundValue,
            $lt: upperBoundValue,
          },
        }
      );
    } else if (moment(lowerBoundValue, format).isValid()) {
      dateRange.$or.push(
        { [`${lowerBoundName}`]: { $gte: lowerBoundValue } },
        { [`${upperBoundName}`]: { $gte: lowerBoundValue } }
      );
    } else if (moment(upperBoundValue, format).isValid()) {
      dateRange.$or.push(
        { [`${lowerBoundName}`]: { $lte: upperBoundValue } },
        { [`${upperBoundName}`]: { $lte: upperBoundValue } }
      );
    }
    return dateRange;
  }
}
