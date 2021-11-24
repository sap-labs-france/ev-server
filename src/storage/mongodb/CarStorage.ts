import { Car, CarCatalog, CarCatalogChargeAlternativeTable, CarCatalogChargeOptionTable, CarCatalogConverter, CarMaker, CarType } from '../../types/Car';
import global, { DatabaseCount, FilterParams, Image } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'CarStorage';

export default class CarStorage {
  public static async getCarCatalog(id: number = Constants.UNKNOWN_NUMBER_ID,
      params: { withImage?: boolean; } = {},
      projectFields?: string[]): Promise<CarCatalog> {
    const carCatalogsMDB = await CarStorage.getCarCatalogs({
      carCatalogIDs: [id],
      withImage: params.withImage,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return carCatalogsMDB.count === 1 ? carCatalogsMDB.result[0] : null;
  }

  public static async getCarCatalogs(
      params: { search?: string; carCatalogIDs?: number[]; carMaker?: string[], withImage?: boolean; } = {},
      dbParams?: DbParams, projectFields?: string[]): Promise<DataResult<CarCatalog>> {
    // Debug
    const startTime = Logging.traceDatabaseRequestStart();
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    // Set the filters
    const filters: FilterParams = {};
    if (params.search) {
      filters.$or = [
        { '_id': Utils.convertToInt(params.search) },
        { 'vehicleModel': { $regex: params.search, $options: 'i' } },
        { 'vehicleMake': { $regex: params.search, $options: 'i' } },
        { 'vehicleModelVersion': { $regex: params.search, $options: 'i' } },
      ];
    }
    // Limit on Car for Basic Users
    if (!Utils.isEmptyArray(params.carCatalogIDs)) {
      aggregation.push({
        $match: {
          _id: { $in: params.carCatalogIDs.map((carCatalogID) => Utils.convertToInt(carCatalogID)) }
        }
      });
    }
    if (params.carMaker) {
      aggregation.push({
        $match: {
          'vehicleMake': { $in: params.carMaker }
        }
      });
    }
    // Filters
    aggregation.push({
      $match: filters
    });
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const carCatalogsCountMDB = await global.database.getCollection<DatabaseCount>(Constants.DEFAULT_TENANT, 'carcatalogs')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getCarCatalogs', startTime, aggregation, carCatalogsCountMDB);
      return {
        count: (carCatalogsCountMDB.length > 0 ? carCatalogsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { name: 1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    if (dbParams.skip > 0) {
      aggregation.push({ $skip: dbParams.skip });
    }
    // Limit
    aggregation.push({
      $limit: (dbParams.limit > 0 && dbParams.limit < Constants.DB_RECORD_COUNT_CEIL) ? dbParams.limit : Constants.DB_RECORD_COUNT_CEIL
    });
    // Car Image
    if (params.withImage) {
      aggregation.push({
        $addFields: {
          image: {
            $cond: {
              if: { $gt: ['$image', null] }, then: {
                $concat: [
                  `${Utils.buildRestServerURL()}/client/util/CarCatalogImage?ID=`,
                  { $toString: '$_id' },
                  '&LastChangedOn=',
                  { $toString: '$lastChangedOn' }
                ]
              }, else: null
            }

          }
        }
      });
    }
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(Constants.DEFAULT_TENANT, aggregation);
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const carCatalogs = await global.database.getCollection<CarCatalog>(Constants.DEFAULT_TENANT, 'carcatalogs')
      .aggregate<CarCatalog>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray();
    // Debug
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getCarCatalogs', startTime, aggregation, carCatalogs);
    // Ok
    return {
      count: (carCatalogsCountMDB.length > 0 ?
        (carCatalogsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : carCatalogsCountMDB[0].count) : 0),
      result: carCatalogs
    };
  }

  public static async saveCarCatalog(carToSave: CarCatalog): Promise<number> {
    // Debug
    const startTime = Logging.traceDatabaseRequestStart();
    // Build Request
    // Properties to save
    const carMDB: any = {
      _id: Utils.convertToInt(carToSave.id),
      vehicleMake: carToSave.vehicleMake,
      vehicleModel: carToSave.vehicleModel,
      vehicleModelVersion: carToSave.vehicleModelVersion,
      availabilityStatus: carToSave.availabilityStatus,
      availabilityDateFrom: carToSave.availabilityDateFrom,
      availabilityDateTo: carToSave.availabilityDateTo,
      priceFromDE: Utils.convertToFloat(carToSave.priceFromDE),
      priceFromDEEstimate: carToSave.priceFromDEEstimate,
      priceFromNL: Utils.convertToFloat(carToSave.priceFromNL),
      priceFromNLEstimate: carToSave.priceFromNLEstimate,
      priceFromUK: Utils.convertToFloat(carToSave.priceFromUK),
      priceGrantPICGUK: Utils.convertToFloat(carToSave.priceGrantPICGUK),
      priceFromUKEstimate: carToSave.priceFromUKEstimate,
      drivetrainType: carToSave.drivetrainType,
      drivetrainFuel: carToSave.drivetrainFuel,
      drivetrainPropulsion: carToSave.drivetrainPropulsion,
      drivetrainPower: Utils.convertToInt(carToSave.drivetrainPower),
      drivetrainPowerHP: Utils.convertToInt(carToSave.drivetrainPowerHP),
      drivetrainTorque: Utils.convertToInt(carToSave.drivetrainTorque),
      performanceAcceleration: Utils.convertToFloat(carToSave.performanceAcceleration),
      performanceTopspeed: Utils.convertToInt(carToSave.performanceTopspeed),
      rangeWLTP: Utils.convertToInt(carToSave.rangeWLTP),
      rangeWLTPEstimate: carToSave.rangeWLTPEstimate,
      rangeNEDC: Utils.convertToInt(carToSave.rangeNEDC),
      rangeNEDCEstimate: carToSave.rangeNEDCEstimate,
      rangeReal: Utils.convertToInt(carToSave.rangeReal),
      rangeRealMode: carToSave.rangeRealMode,
      rangeRealWHwy: carToSave.rangeRealWHwy,
      rangeRealWCmb: carToSave.rangeRealWCmb,
      rangeRealWCty: carToSave.rangeRealWCty,
      rangeRealBHwy: carToSave.rangeRealBHwy,
      rangeRealBCmb: carToSave.rangeRealBCmb,
      rangeRealBCty: carToSave.rangeRealBCty,
      efficiencyWLTP: Utils.convertToFloat(carToSave.efficiencyWLTP),
      efficiencyWLTPFuelEq: Utils.convertToFloat(carToSave.efficiencyWLTPFuelEq),
      efficiencyWLTPV: Utils.convertToFloat(carToSave.efficiencyWLTPV),
      efficiencyWLTPFuelEqV: Utils.convertToFloat(carToSave.efficiencyWLTPFuelEqV),
      efficiencyWLTPCO2: Utils.convertToFloat(carToSave.efficiencyWLTPCO2),
      efficiencyNEDC: Utils.convertToFloat(carToSave.efficiencyNEDC),
      efficiencyNEDCFuelEq: Utils.convertToFloat(carToSave.efficiencyNEDCFuelEq),
      efficiencyNEDCV: Utils.convertToFloat(carToSave.efficiencyNEDCV),
      efficiencyNEDCFuelEqV: Utils.convertToFloat(carToSave.efficiencyNEDCFuelEqV),
      efficiencyNEDCCO2: Utils.convertToFloat(carToSave.efficiencyNEDCCO2),
      efficiencyReal: Utils.convertToFloat(carToSave.efficiencyReal),
      efficiencyRealFuelEqV: Utils.convertToFloat(carToSave.efficiencyRealFuelEqV),
      efficiencyRealCO2: Utils.convertToFloat(carToSave.efficiencyRealCO2),
      efficiencyRealWHwy: Utils.convertToFloat(carToSave.efficiencyRealWHwy),
      efficiencyRealWCmb: Utils.convertToFloat(carToSave.efficiencyRealWCmb),
      efficiencyRealWCty: Utils.convertToFloat(carToSave.efficiencyRealWCty),
      efficiencyRealBHwy: Utils.convertToFloat(carToSave.efficiencyRealBHwy),
      efficiencyRealBCmb: Utils.convertToFloat(carToSave.efficiencyRealBCmb),
      efficiencyRealBCty: Utils.convertToFloat(carToSave.efficiencyRealBCty),
      chargePlug: carToSave.chargePlug,
      chargePlugEstimate: carToSave.chargePlugEstimate,
      chargePlugLocation: carToSave.chargePlugLocation,
      chargeStandardPower: Utils.convertToFloat(carToSave.chargeStandardPower),
      chargeStandardPhase: Utils.convertToInt(carToSave.chargeStandardPhase),
      chargeStandardPhaseAmp: Utils.convertToInt(carToSave.chargeStandardPhaseAmp),
      chargeStandardChargeTime: Utils.convertToInt(carToSave.chargeStandardChargeTime),
      chargeStandardChargeSpeed: Utils.convertToInt(carToSave.chargeStandardChargeSpeed),
      chargeStandardEstimate: carToSave.chargeStandardEstimate,
      chargeStandardTables: carToSave.chargeStandardTables ?
        carToSave.chargeStandardTables.map((chargeStandardTable: CarCatalogConverter): CarCatalogConverter => ({
          type: chargeStandardTable.type,
          evsePhaseVolt: Utils.convertToInt(chargeStandardTable.evsePhaseVolt),
          evsePhaseAmp: Utils.convertToInt(chargeStandardTable.evsePhaseAmp),
          evsePhase: Utils.convertToInt(chargeStandardTable.evsePhase),
          evsePhaseVoltCalculated: Utils.convertToInt(chargeStandardTable.evsePhaseVoltCalculated),
          chargePhaseVolt: Utils.convertToInt(chargeStandardTable.chargePhaseVolt),
          chargePhaseAmp: Utils.convertToInt(chargeStandardTable.chargePhaseAmp),
          chargePhase: Utils.convertToInt(chargeStandardTable.chargePhase),
          chargePower: Utils.convertToFloat(chargeStandardTable.chargePower),
          chargeTime: Utils.convertToInt(chargeStandardTable.chargeTime),
          chargeSpeed: Utils.convertToInt(chargeStandardTable.chargeSpeed)
        })) : [],
      chargeAlternativePower: Utils.convertToInt(carToSave.chargeAlternativePower),
      chargeAlternativePhase: Utils.convertToInt(carToSave.chargeAlternativePhase),
      chargeAlternativePhaseAmp: Utils.convertToInt(carToSave.chargeAlternativePhaseAmp),
      chargeAlternativeChargeTime: Utils.convertToInt(carToSave.chargeAlternativeChargeTime),
      chargeAlternativeChargeSpeed: Utils.convertToInt(carToSave.chargeAlternativeChargeSpeed),
      chargeAlternativeTables: carToSave.chargeAlternativeTables ?
        carToSave.chargeAlternativeTables.map((chargeAlternativeTable: CarCatalogChargeAlternativeTable): CarCatalogChargeAlternativeTable => ({
          type: chargeAlternativeTable.type,
          evsePhaseVolt: Utils.convertToInt(chargeAlternativeTable.evsePhaseVolt),
          evsePhaseAmp: Utils.convertToInt(chargeAlternativeTable.evsePhaseAmp),
          evsePhase: Utils.convertToInt(chargeAlternativeTable.evsePhase),
          chargePhaseVolt: Utils.convertToInt(chargeAlternativeTable.chargePhaseVolt),
          chargePhaseAmp: Utils.convertToInt(chargeAlternativeTable.chargePhaseAmp),
          chargePhase: Utils.convertToInt(chargeAlternativeTable.chargePhase),
          chargePower: Utils.convertToFloat(chargeAlternativeTable.chargePower),
          chargeTime: Utils.convertToInt(chargeAlternativeTable.chargeTime),
          chargeSpeed: Utils.convertToInt(chargeAlternativeTable.chargeSpeed)
        })) : [],
      chargeOptionPower: Utils.convertToInt(carToSave.chargeOptionPower),
      chargeOptionPhase: Utils.convertToInt(carToSave.chargeOptionPhase),
      chargeOptionPhaseAmp: Utils.convertToInt(carToSave.chargeOptionPhaseAmp),
      chargeOptionChargeTime: Utils.convertToInt(carToSave.chargeOptionChargeTime),
      chargeOptionChargeSpeed: Utils.convertToInt(carToSave.chargeOptionChargeSpeed),
      chargeOptionTables: carToSave.chargeOptionTables ?
        carToSave.chargeOptionTables.map((chargeOptionTables: CarCatalogChargeOptionTable): CarCatalogChargeOptionTable => ({
          type: chargeOptionTables.type,
          evsePhaseVolt: Utils.convertToInt(chargeOptionTables.evsePhaseVolt),
          evsePhaseAmp: Utils.convertToInt(chargeOptionTables.evsePhaseAmp),
          evsePhase: Utils.convertToInt(chargeOptionTables.evsePhase),
          chargePhaseVolt: Utils.convertToInt(chargeOptionTables.chargePhaseVolt),
          chargePhaseAmp: Utils.convertToInt(chargeOptionTables.chargePhaseAmp),
          chargePhase: Utils.convertToInt(chargeOptionTables.chargePhase),
          chargePower: Utils.convertToFloat(chargeOptionTables.chargePower),
          chargeTime: Utils.convertToInt(chargeOptionTables.chargeTime),
          chargeSpeed: Utils.convertToInt(chargeOptionTables.chargeSpeed)
        })) : [],
      fastChargePlug: carToSave.fastChargePlug,
      fastChargePlugEstimate: carToSave.fastChargePlugEstimate,
      fastChargePlugLocation: carToSave.fastChargePlugLocation,
      fastChargePowerMax: Utils.convertToInt(carToSave.fastChargePowerMax),
      fastChargePowerAvg: Utils.convertToInt(carToSave.fastChargePowerAvg),
      fastChargeTime: Utils.convertToInt(carToSave.fastChargeTime),
      fastChargeSpeed: Utils.convertToInt(carToSave.fastChargeSpeed),
      fastChargeOptional: carToSave.fastChargeOptional,
      fastChargeEstimate: carToSave.fastChargeEstimate,
      batteryCapacityUseable: Utils.convertToFloat(carToSave.batteryCapacityUseable),
      batteryCapacityFull: Utils.convertToFloat(carToSave.batteryCapacityFull),
      batteryCapacityEstimate: carToSave.batteryCapacityEstimate,
      dimsLength: Utils.convertToInt(carToSave.dimsLength),
      dimsWidth: Utils.convertToInt(carToSave.dimsWidth),
      dimsHeight: Utils.convertToInt(carToSave.dimsHeight),
      dimsWheelbase: carToSave.dimsWheelbase,
      dimsWeight: Utils.convertToInt(carToSave.dimsWeight),
      dimsBootspace: Utils.convertToInt(carToSave.dimsBootspace),
      dimsBootspaceMax: Utils.convertToInt(carToSave.dimsBootspaceMax),
      dimsTowWeightUnbraked: Utils.convertToInt(carToSave.dimsTowWeightUnbraked),
      dimsTowWeightBraked: Utils.convertToInt(carToSave.dimsTowWeightBraked),
      dimsRoofLoadMax: Utils.convertToInt(carToSave.dimsRoofLoadMax),
      miscBody: carToSave.miscBody,
      miscSegment: carToSave.miscSegment,
      miscSeats: Utils.convertToInt(carToSave.miscSeats),
      miscRoofrails: carToSave.miscRoofrails,
      miscIsofix: carToSave.miscIsofix,
      miscIsofixSeats: carToSave.miscIsofixSeats,
      miscTurningCircle: carToSave.miscTurningCircle,
      euroNCAPRating: Utils.convertToInt(carToSave.euroNCAPRating),
      euroNCAPYear: carToSave.euroNCAPYear,
      euroNCAPAdult: Utils.convertToInt(carToSave.euroNCAPAdult),
      euroNCAPChild: Utils.convertToInt(carToSave.euroNCAPChild),
      euroNCAPVRU: Utils.convertToInt(carToSave.euroNCAPVRU),
      euroNCAPSA: Utils.convertToInt(carToSave.euroNCAPSA),
      relatedVehicleIDSuccessor: Utils.convertToInt(carToSave.relatedVehicleIDSuccessor),
      eVDBDetailURL: carToSave.eVDBDetailURL,
      videos: carToSave.videos,
      hash: carToSave.hash,
      imageURLs: carToSave.imageURLs,
      image: carToSave.image,
      imagesHash: carToSave.imagesHash
    };
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(carMDB, carToSave);
    // Modify and return the modified document
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'carcatalogs').findOneAndReplace(
      { _id: Utils.convertToInt(carToSave.id) },
      carMDB,
      { upsert: true }
    );
    // Debug
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'saveCarCatalog', startTime, carMDB);
    return carToSave.id;
  }

  public static async saveCarCatalogImage(id: number, carImageToSave: string): Promise<void> {
    // Debug
    const startTime = Logging.traceDatabaseRequestStart();
    // Save new image
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'carcatalogimages').findOneAndReplace(
      { _id: Utils.hash(`${carImageToSave}~${id}`), },
      { carID: Utils.convertToInt(id), image: carImageToSave },
      { upsert: true }
    );
    // Debug
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'saveCarImage', startTime, carImageToSave);
  }

  public static async deleteCarCatalogImages(id: number): Promise<void> {
    // Debug
    const startTime = Logging.traceDatabaseRequestStart();
    // Delete car catalogs images
    await global.database.getCollection(Constants.DEFAULT_TENANT, 'carcatalogimages').deleteMany(
      { carID: id }
    );
    // Debug
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'deleteCarImages', startTime, { carID: id });
  }

  public static async getCarCatalogImage(id: number): Promise<{ id: number; image: string }> {
    // Debug
    const startTime = Logging.traceDatabaseRequestStart();
    // Read DB
    const carCatalogImageMDB = await global.database.getCollection<{ _id: number; image: string }>(Constants.DEFAULT_TENANT, 'carcatalogs')
      .findOne({ _id: id });
    // Debug
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getCarCatalogImage', startTime, { _id: id }, carCatalogImageMDB);
    return {
      id: id,
      image: carCatalogImageMDB ? carCatalogImageMDB.image : null
    };
  }

  public static async getCarCatalogImages(id: number = Constants.UNKNOWN_NUMBER_ID, dbParams?: DbParams): Promise<DataResult<Image>> {
    // Debug
    const startTime = Logging.traceDatabaseRequestStart();
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters = {
      carID: Utils.convertToInt(id)
    };
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: filters
    });
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const carCatalogImagesCountMDB = await global.database.getCollection<DatabaseCount>(Constants.DEFAULT_TENANT, 'carcatalogimages')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getCarCatalogImages', startTime, aggregation, carCatalogImagesCountMDB);
      return {
        count: (carCatalogImagesCountMDB.length > 0 ? carCatalogImagesCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Project
    DatabaseUtils.projectFields(aggregation, ['image']);
    // Read DB
    const carCatalogImages = await global.database.getCollection<Image>(Constants.DEFAULT_TENANT, 'carcatalogimages')
      .aggregate<Image>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray();
    // Debug
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getCarCatalogImages', startTime, aggregation, carCatalogImages);
    return {
      count: (carCatalogImagesCountMDB.length > 0 ?
        (carCatalogImagesCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : carCatalogImagesCountMDB[0].count) : 0),
      result: carCatalogImages
    };
  }

  public static async getCarMakers(params: { search?: string } = {}, projectFields?: string[]): Promise<DataResult<CarMaker>> {
    // Debug
    const startTime = Logging.traceDatabaseRequestStart();
    // Set the filters
    const filters: ({ $or?: any[] } | undefined) = {};
    if (params.search) {
      filters.$or = [
        { 'vehicleMake': { $regex: params.search, $options: 'i' } },
      ];
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    aggregation.push({
      $group: {
        _id: null,
        carMaker: {
          $addToSet: {
            carMaker: '$vehicleMake'
          }
        }
      }
    });
    aggregation.push({
      $unwind: {
        path: '$carMaker'
      }
    });
    aggregation.push({
      $replaceRoot: {
        newRoot: '$carMaker'
      }
    });
    aggregation.push({
      $sort: {
        carMaker: 1
      }
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Execute
    const carMakersMDB = await global.database.getCollection<CarMaker>(Constants.DEFAULT_TENANT, 'carcatalogs')
      .aggregate<CarMaker>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray();
    // Debug
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getCarMakers', startTime, aggregation, carMakersMDB);
    return {
      count: carMakersMDB.length,
      result: carMakersMDB
    };
  }

  public static async saveCar(tenant: Tenant, carToSave: Car): Promise<string> {
    // Debug
    const startTime = Logging.traceDatabaseRequestStart();
    // Check Tenant
    DatabaseUtils.checkTenantObject(tenant);
    // Set
    const carMDB: any = {
      _id: carToSave.id ? DatabaseUtils.convertToObjectID(carToSave.id) : new ObjectId(),
      vin: carToSave.vin,
      licensePlate: carToSave.licensePlate,
      carCatalogID: Utils.convertToInt(carToSave.carCatalogID),
      userID: carToSave.userID ? DatabaseUtils.convertToObjectID(carToSave.userID) : null,
      type: carToSave.type,
      default: carToSave.default,
      converter: {
        powerWatts: Utils.convertToFloat(carToSave.converter.powerWatts),
        amperagePerPhase: Utils.convertToInt(carToSave.converter.amperagePerPhase),
        numberOfPhases: Utils.convertToFloat(carToSave.converter.numberOfPhases),
        type: carToSave.converter.type
      }
    };
    if (carToSave.carConnectorData) {
      carMDB.carConnectorData = {
        carConnectorID: carToSave.carConnectorData?.carConnectorID ?? null,
        carConnectorMeterID: carToSave.carConnectorData?.carConnectorMeterID ?? null,
      };
    }
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(carMDB, carToSave);
    // Modify
    await global.database.getCollection<Car>(tenant.id, 'cars').findOneAndUpdate(
      { _id: carMDB._id },
      { $set: carMDB },
      { upsert: true, returnDocument: 'after' }
    );
    // Debug
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveCar', startTime, carMDB);
    return carMDB._id.toString();
  }

  public static async getCar(tenant: Tenant, id: string = Constants.UNKNOWN_STRING_ID,
      params: { withUser?: boolean, userIDs?: string[]; type?: CarType } = {}, projectFields?: string[]): Promise<Car> {
    const carsMDB = await CarStorage.getCars(tenant, {
      carIDs: [id],
      withUser: params.withUser,
      userIDs: params.userIDs,
      type: params.type
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return carsMDB.count === 1 ? carsMDB.result[0] : null;
  }

  public static async getDefaultUserCar(tenant: Tenant, userID: string,
      params = {}, projectFields?: string[]): Promise<Car> {
    const carMDB = await CarStorage.getCars(tenant, {
      userIDs: [userID],
      defaultCar: true,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return carMDB.count > 0 ? carMDB.result[0] : null;
  }

  public static async getFirstAvailableUserCar(tenant: Tenant, userID: string,
      params = {}, projectFields?: string[]): Promise<Car> {
    const carMDB = await CarStorage.getCars(tenant, {
      userIDs: [userID],
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return carMDB.count === 1 ? carMDB.result[0] : null;
  }

  public static async getCarByVinLicensePlate(tenant: Tenant,
      licensePlate: string = Constants.UNKNOWN_STRING_ID, vin: string = Constants.UNKNOWN_STRING_ID,
      params: { withUser?: boolean, userIDs?: string[]; } = {}, projectFields?: string[]): Promise<Car> {
    const carsMDB = await CarStorage.getCars(tenant, {
      licensePlate: licensePlate,
      vin: vin,
      withUser: params.withUser,
      userIDs: params.userIDs,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return carsMDB.count === 1 ? carsMDB.result[0] : null;
  }

  public static async getCars(tenant: Tenant,
      params: {
        search?: string; userIDs?: string[]; carIDs?: string[]; licensePlate?: string; vin?: string;
        withUser?: boolean; defaultCar?: boolean; carMakers?: string[], type?: CarType; siteIDs?: string[];
      } = {},
      dbParams?: DbParams, projectFields?: string[]): Promise<DataResult<Car>> {
    let withCarCatalog = true;
    // Debug
    const startTime = Logging.traceDatabaseRequestStart();
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    // Set the filters
    const filters: FilterParams = {};
    // Search
    if (params.search) {
      filters.$or = [
        { 'vin': { $regex: params.search, $options: 'i' } },
        { 'licensePlate': { $regex: params.search, $options: 'i' } },
      ];
    }
    // Plate
    if (params.licensePlate) {
      filters.licensePlate = params.licensePlate;
    }
    // VIN
    if (params.vin) {
      filters.vin = params.vin;
    }
    // Type
    if (params.type) {
      filters.type = params.type;
    }
    // Car
    if (!Utils.isEmptyArray(params.carIDs)) {
      filters._id = {
        $in: params.carIDs.map((carID) => DatabaseUtils.convertToObjectID(carID))
      };
    }
    // User
    if (!Utils.isEmptyArray(params.userIDs)) {
      filters.userID = { $in: params.userIDs.map((userID) => DatabaseUtils.convertToObjectID(userID)) };
    }
    // Default Car
    if (params.defaultCar) {
      filters.default = true;
    }
    // Sites
    if (!Utils.isEmptyArray(params.siteIDs)) {
      DatabaseUtils.pushSiteUserLookupInAggregation({
        tenantID: tenant.id, aggregation, localField: 'userID', foreignField: 'userID', asField: 'siteUsers'
      });
      aggregation.push({
        $match: { 'siteUsers.siteID': { $in: params.siteIDs.map((site) => DatabaseUtils.convertToObjectID(site)) } }
      });
    }
    // Car Maker
    if (!Utils.isEmptyArray(params.carMakers)) {
      // Car Catalog
      DatabaseUtils.pushCarCatalogLookupInAggregation({
        tenantID: Constants.DEFAULT_TENANT, aggregation, localField: 'carCatalogID', foreignField: '_id',
        asField: 'carCatalog', oneToOneCardinality: true
      });
      filters['carCatalog.vehicleMake'] = { $in: params.carMakers };
      withCarCatalog = false;
    }
    // Filters
    aggregation.push({
      $match: filters
    });
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const carsCountMDB = await global.database.getCollection<DatabaseCount>(tenant.id, 'cars')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getCars', startTime, aggregation, carsCountMDB);
      return {
        count: (carsCountMDB.length > 0 ? carsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = {
        'carCatalog.vehicleMake': 1,
        'carCatalog.vehicleModel': 1,
        'carCatalog.vehicleModelVersion': 1,
        'licensePlate': 1,
      };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    if (dbParams.skip > 0) {
      aggregation.push({ $skip: dbParams.skip });
    }
    // Limit
    aggregation.push({
      $limit: (dbParams.limit > 0 && dbParams.limit < Constants.DB_RECORD_COUNT_CEIL) ? dbParams.limit : Constants.DB_RECORD_COUNT_CEIL
    });
    // Users
    if (params.withUser) {
      DatabaseUtils.pushUserLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation, asField: 'user', localField: 'userID',
        foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
      });
    }
    // Car Catalog
    if (withCarCatalog) {
      DatabaseUtils.pushCarCatalogLookupInAggregation({
        tenantID: Constants.DEFAULT_TENANT, aggregation, localField: 'carCatalogID', foreignField: '_id',
        asField: 'carCatalog', oneToOneCardinality: true
      });
      // Car Image
      aggregation.push({
        $addFields: {
          'carCatalog.image': {
            $cond: {
              if: { $gt: ['$carCatalog.image', null] }, then: {
                $concat: [
                  `${Utils.buildRestServerURL()}/client/util/CarCatalogImage?ID=`,
                  '$carCatalog.id',
                  '&LastChangedOn=',
                  { $toString: '$carCatalog.lastChangedOn' }
                ]
              }, else: null
            }

          }
        }
      });
    }
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const cars = await global.database.getCollection<Car>(tenant.id, 'cars')
      .aggregate<Car>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray();
    // Debug
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getCars', startTime, aggregation, cars);
    return {
      count: (carsCountMDB.length > 0 ?
        (carsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : carsCountMDB[0].count) : 0),
      result: cars
    };
  }

  public static async clearDefaultUserCar(tenant: Tenant, userID: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    await global.database.getCollection<any>(tenant.id, 'cars').updateMany(
      {
        userID: DatabaseUtils.convertToObjectID(userID),
        default: true
      },
      {
        $set: { default: false }
      });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'clearDefaultUserCar', startTime, { userID });
  }

  public static async deleteCar(tenant: Tenant, carID: string): Promise<void> {
    // Debug
    const startTime = Logging.traceDatabaseRequestStart();
    // Delete singular site area
    await global.database.getCollection(tenant.id, 'cars')
      .deleteOne({ '_id': DatabaseUtils.convertToObjectID(carID) });
    // Debug
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteCar', startTime, { carID });
  }

  public static async deleteCarCatalog(id: number): Promise<void> {
    // Debug
    const startTime = Logging.traceDatabaseRequestStart();
    // Delete singular site area
    await global.database.getCollection(Constants.DEFAULT_TENANT, 'carcatalogs')
      .deleteOne({ '_id': id });
    // Debug
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'deleteCarCatalog', startTime, { carID: id });
  }
}
