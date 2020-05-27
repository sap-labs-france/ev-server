import { Car, CarCatalog, CarMaker, CarType, ChargeAlternativeTable, ChargeOptionTable, ChargeStandardTable, UserCar } from '../../types/Car';
import global, { ActionsResponse, Image } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectID } from 'mongodb';
import { ServerAction } from '../../types/Server';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'CarStorage';

export default class CarStorage {
  public static async getCarCatalog(id: number = Constants.UNKNOWN_NUMBER_ID, projectFields?: string[]): Promise<CarCatalog> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getCarCatalog');
    // Query single Site
    const carCatalogsMDB = await CarStorage.getCarCatalogs(
      { carCatalogIDs: [id] },
      Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    Logging.traceEnd(MODULE_NAME, 'getCarCatalog', uniqueTimerID, { id });
    return carCatalogsMDB.count > 0 ? carCatalogsMDB.result[0] : null;
  }

  public static async getCarCatalogs(
    params: { search?: string; carCatalogIDs?: number[]; carMaker?: string[] } = {},
    dbParams?: DbParams, projectFields?: string[]): Promise<DataResult<CarCatalog>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getCarCatalogs');
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: ({ _id?: number; $or?: any[] } | undefined) = {};
    if (params.search) {
      const searchRegex = Utils.escapeSpecialCharsInRegex(params.search);
      filters.$or = [
        { 'vehicleModel': { $regex: searchRegex, $options: 'i' } },
        { 'vehicleMake': { $regex: searchRegex, $options: 'i' } },
        { 'vehicleModelVersion': { $regex: searchRegex, $options: 'i' } },
      ];
    }
    // Create Aggregation
    const aggregation = [];
    // Limit on Car for Basic Users
    if (!Utils.isEmptyArray(params.carCatalogIDs)) {
      // Build filter
      aggregation.push({
        $match: {
          _id: { $in: params.carCatalogIDs.map((carCatalogID) => Utils.convertToInt(carCatalogID)) }
        }
      });
    }
    if (params.carMaker) {
      // Build filter
      aggregation.push({
        $match: {
          'vehicleMake': {
            $in: params.carMaker
          }
        }
      });
    }
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const carCatalogsCountMDB = await global.database.getCollection<DataResult<CarCatalog>>(Constants.DEFAULT_TENANT, 'carcatalogs')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      return {
        count: (carCatalogsCountMDB.length > 0 ? carCatalogsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(Constants.DEFAULT_TENANT, aggregation);
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Sort
    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      aggregation.push({
        $sort: { name: 1 }
      });
    }
    // Skip
    if (skip > 0) {
      aggregation.push({ $skip: skip });
    }
    // Limit
    aggregation.push({
      $limit: (limit > 0 && limit < Constants.DB_RECORD_COUNT_CEIL) ? limit : Constants.DB_RECORD_COUNT_CEIL
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const carCatalogs = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'carcatalogs')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getCarCatalogs', uniqueTimerID,
      { params, limit: dbParams.limit, skip: dbParams.skip, sort: dbParams.sort });
    // Ok
    return {
      count: (carCatalogsCountMDB.length > 0 ?
        (carCatalogsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : carCatalogsCountMDB[0].count) : 0),
      result: carCatalogs
    };
  }

  public static async saveCarCatalog(carToSave: CarCatalog, saveImage = false): Promise<number> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveCarCatalog');
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
        carToSave.chargeStandardTables.map((chargeStandardTable: ChargeStandardTable): ChargeStandardTable => ({
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
        carToSave.chargeAlternativeTables.map((chargeAlternativeTable: ChargeAlternativeTable): ChargeAlternativeTable => ({
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
        carToSave.chargeOptionTables.map((chargeOptionTables: ChargeOptionTable): ChargeOptionTable => ({
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
      relatedVehicleIDSuccesor: Utils.convertToInt(carToSave.relatedVehicleIDSuccesor),
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
    if (saveImage) {
      await CarStorage.saveCarImages(carToSave.id, carToSave.images);
    }
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveCarCatalog', uniqueTimerID, { carToSave });
    return carToSave.id;
  }

  public static async saveCarImages(carID: number, carImagesToSave: string[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveCarImages');
    // Delete old images
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'carcatalogimages').deleteMany(
      { carID: Utils.convertToInt(carID) }
    );
    // Save new images
    for (const carImageToSave of carImagesToSave) {
      await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'carcatalogimages').findOneAndReplace(
        { _id: Cypher.hash(`${carImageToSave}~${carID}`), },
        { carID: Utils.convertToInt(carID), image: carImageToSave },
        { upsert: true }
      );
    }
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveCarImages', uniqueTimerID, { carID });
  }

  public static async getCarCatalogImages(id: number = Constants.UNKNOWN_NUMBER_ID, dbParams?: DbParams): Promise<DataResult<Image>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getCarCatalogImages');
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
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
    const carCatalogImagesCountMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'carcatalogimages')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
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
      $skip: skip
    });
    // Limit
    aggregation.push({
      $limit: limit
    });
    // Project
    DatabaseUtils.projectFields(aggregation, ['image']);
    // Read DB
    const carCatalogImages = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'carcatalogimages')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getCarCatalogImages', uniqueTimerID,
      { id, limit: dbParams.limit, skip: dbParams.skip, sort: dbParams.sort });
    // Ok
    return {
      count: (carCatalogImagesCountMDB.length > 0 ?
        (carCatalogImagesCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : carCatalogImagesCountMDB[0].count) : 0),
      result: carCatalogImages
    };
  }

  public static async getCarMakers(
    params: { search?: string } = {}): Promise<DataResult<CarMaker>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getCarMakers');
    // Set the filters
    const filters: ({ $or?: any[] } | undefined) = {};

    if (params.search) {
      filters.$or = [
        { 'vehicleMake': { $regex: Utils.escapeSpecialCharsInRegex(params.search), $options: 'i' } },
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
    const result = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'carcatalogs')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getCarMakers', uniqueTimerID, { result });
    // Ok
    return {
      count: result.length,
      result: result
    };
  }


  public static async saveCar(tenantID: string, carToSave: Car): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveCar');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set
    const carMDB: any = {
      _id: carToSave.id ? Utils.convertToObjectID(carToSave.id) : new ObjectID(),
      vin: carToSave.vin,
      licensePlate: carToSave.licensePlate,
      carCatalogID: Utils.convertToInt(carToSave.carCatalogID),
      type: carToSave.type,
      converterType: carToSave.converterType
    };
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(carMDB, carToSave);
    // Modify
    await global.database.getCollection<Car>(tenantID, 'cars').findOneAndUpdate(
      { _id: carMDB._id },
      { $set: carMDB },
      { upsert: true, returnOriginal: false }
    );
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveCar', uniqueTimerID, { carToSave });
    return carMDB._id.toHexString();
  }

  public static async saveUserCar(tenantID: string, userCarToSave: UserCar): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveUserCar');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set
    const userCarMDB: any = {
      _id: userCarToSave.id ? Utils.convertToObjectID(userCarToSave.id) : new ObjectID(),
      userID: Utils.convertToObjectID(userCarToSave.userID),
      carID: Utils.convertToObjectID(userCarToSave.carID),
      default: userCarToSave.default,
      active: true,
      owner: (userCarToSave.owner === true ? true : false)
    };
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(userCarMDB, userCarToSave);
    // Modify
    await global.database.getCollection(tenantID, 'userscars').findOneAndUpdate(
      {
        _id: userCarMDB._id
      },

      { $set: userCarMDB },
      { upsert: true, returnOriginal: false }
    );
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveUserCar', uniqueTimerID, { userCarToSave });
    return userCarMDB._id.toHexString();
  }

  public static async assignUsersCar(tenantID: string, carID: string, usersCarToSave: UserCar[]): Promise<ActionsResponse> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'AssignUsersCar');
    const actionsDone: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set
    for (const userCar of usersCarToSave) {
      try {
        if (userCar.default) {
          await CarStorage.clearDefaultUserCar(tenantID, userCar.userID);
        }
        userCar.carID = carID;
        userCar.createdOn = new Date();
        userCar.active = true;
        await CarStorage.saveUserCar(tenantID, userCar);
        actionsDone.inSuccess++;
      } catch (error) {
        actionsDone.inError++;
      }
    }
    // Log
    Utils.logActionsResponse(tenantID, ServerAction.ASSIGN_USERS_CAR,
      MODULE_NAME, 'AssignUsersCar', actionsDone,
      '{{inSuccess}} user(s) were successfully assigned',
      '{{inError}} user(s) failed to be assigned',
      '{{inSuccess}} user(s) were successfully assigned and {{inError}} failed to be assigned',
      'All the users are up to date'
    );
    return actionsDone;
  }

  public static async updateUsersCar(tenantID: string, carID: string, usersCarToSave: UserCar[]): Promise<ActionsResponse> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'updateUsersCar');
    const actionsDone: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    const deactivated = await global.database.getCollection(tenantID, 'userscars').updateMany({
      $and: [{ carID: Utils.convertToObjectID(carID) },
        { userID: { $nin: usersCarToSave.map((userCarToSave) => Utils.convertToObjectID(userCarToSave.userID)) } }]
    }, {
      $set: {
        active: false
      }
    }
    );
    actionsDone.inSuccess += deactivated.modifiedCount;
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set
    for (const userCar of usersCarToSave) {
      try {
        const userCarDB = await CarStorage.getUserCarByCarUser(tenantID, carID, userCar.userID);
        if (userCarDB) {
          if (userCarDB.default !== userCar.default || !userCar.active) {
            if (userCar.default) {
              await CarStorage.clearDefaultUserCar(tenantID, userCar.userID);
            }
            if (userCar.owner !== userCarDB.owner) {
              await CarStorage.clearUserCarOwner(tenantID, carID);
            }
            userCarDB.owner = userCar.owner;
            userCarDB.active = true;
            userCarDB.default = userCar.default;
            await CarStorage.saveUserCar(tenantID, userCarDB);
            actionsDone.inSuccess++;
          }
        } else {
          if (userCar.default) {
            await CarStorage.clearDefaultUserCar(tenantID, userCar.userID);
          }
          if (userCar.owner) {
            await CarStorage.clearUserCarOwner(tenantID, carID);
          }
          userCar.carID = carID;
          userCar.lastChangedOn = new Date();
          userCar.active = true;
          await CarStorage.saveUserCar(tenantID, userCar);
          actionsDone.inSuccess++;
        }
      } catch (error) {
        actionsDone.inError++;
      }
    }
    // Log
    Utils.logActionsResponse(tenantID, ServerAction.ASSIGN_USERS_CAR,
      MODULE_NAME, 'updateUsersCar', actionsDone,
      '{{inSuccess}} user(s) were successfully updated',
      '{{inError}} user(s) failed to be updated',
      '{{inSuccess}} user(s) were successfully updated and {{inError}} failed to be updated',
      'All the users are up to date'
    );
    return actionsDone;
  }

  public static async getCar(tenantID: string, carID: string = Constants.UNKNOWN_STRING_ID, projectFields?: string[]): Promise<Car> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getCar');
    // Query single Car
    const carsMDB = await CarStorage.getCars(tenantID,
      { carIDs: [carID] },
      Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    Logging.traceEnd(MODULE_NAME, 'getCar', uniqueTimerID, { carID });
    return carsMDB.count > 0 ? carsMDB.result[0] : null;
  }

  public static async getCarByVinLicensePlate(tenantID: string,
    licensePlate: string = Constants.UNKNOWN_STRING_ID, vin: string = Constants.UNKNOWN_STRING_ID,
    withUsers?: boolean, projectFields?: string[]): Promise<Car> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getCarByVinLicensePlate');
    // Query single Car
    const carsMDB = await CarStorage.getCars(tenantID,
      { licensePlate: licensePlate, vin: vin, withUsers: withUsers },
      Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    Logging.traceEnd(MODULE_NAME, 'getCarByVinLicensePlate', uniqueTimerID, { vin, licensePlate });
    return carsMDB.count > 0 ? carsMDB.result[0] : null;
  }

  public static async getCars(tenantID: string,
    params: { search?: string; userIDs?: string[]; carIDs?: string[]; licensePlate?: string; vin?: string; withUsers?: boolean; defaultCar?: boolean } = {},
    dbParams?: DbParams, projectFields?: string[]): Promise<DataResult<Car>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getCars');
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: any = {};
    if (params.licensePlate) {
      filters.licensePlate = params.licensePlate;
    }
    if (params.vin) {
      filters.vin = params.vin;
    }
    if (params.search) {
      const searchRegex = Utils.escapeSpecialCharsInRegex(params.search);
      filters.$or = [
        { 'vin': { $regex: searchRegex, $options: 'i' } },
        { 'licensePlate': { $regex: searchRegex, $options: 'i' } },
      ];
    }
    // Limit on Car for Basic Users
    if (!Utils.isEmptyArray(params.carIDs)) {
      // Build filter
      filters._id = { $in: params.carIDs.map((carID) => Utils.convertToObjectID(carID)) };
    }
    // Create Aggregation
    const aggregation = [];
    if (!Utils.isEmptyArray(params.userIDs) || params.withUsers) {
      DatabaseUtils.pushUserCarLookupInAggregation({
        tenantID: tenantID, aggregation, localField: '_id', foreignField: 'carID',
        asField: 'userscars', oneToOneCardinality: false
      });
      if (!Utils.isEmptyArray(params.userIDs)) {
        filters['userscars.userID'] = { $in: params.userIDs.map((userID) => Utils.convertToObjectID(userID)) };
      }
      if (params.defaultCar) {
        filters['userscars.default'] = true;
      }
    }
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    DatabaseUtils.pushCarCatalogLookupInAggregation({
      tenantID: Constants.DEFAULT_TENANT, aggregation, localField: 'carCatalogID', foreignField: '_id',
      asField: 'carCatalog', oneToOneCardinality: true
    });
    if (params.withUsers) {
      DatabaseUtils.pushUserLookupInAggregation({
        tenantID: tenantID, aggregation, localField: 'userscars.userID', foreignField: '_id',
        asField: 'users', oneToOneCardinality: false
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const carsCountMDB = await global.database.getCollection<DataResult<Car>>(tenantID, 'cars')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      return {
        count: (carsCountMDB.length > 0 ? carsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Sort
    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      aggregation.push({
        $sort: { name: 1 }
      });
    }
    // Skip
    if (skip > 0) {
      aggregation.push({ $skip: skip });
    }
    // Limit
    aggregation.push({
      $limit: (limit > 0 && limit < Constants.DB_RECORD_COUNT_CEIL) ? limit : Constants.DB_RECORD_COUNT_CEIL
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const cars = await global.database.getCollection<Car>(tenantID, 'cars')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getCars', uniqueTimerID,
      { params, limit: dbParams.limit, skip: dbParams.skip, sort: dbParams.sort });
    // Ok
    return {
      count: (carsCountMDB.length > 0 ?
        (carsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : carsCountMDB[0].count) : 0),
      result: cars
    };
  }

  public static async clearDefaultUserCar(tenantID: string, userID: string): Promise<void> {
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'clearDefaultCar');
    await Utils.checkTenant(tenantID);

    await global.database.getCollection<any>(tenantID, 'userscars').updateMany(
      {
        userID: Utils.convertToObjectID(userID),
        default: true
      },
      {
        $set: { default: false }
      });
    Logging.traceEnd(MODULE_NAME, 'clearDefaultCar', uniqueTimerID, { userID });
  }

  public static async clearUserCarOwner(tenantID: string, carID: string): Promise<void> {
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'clearDefaultCar');
    await Utils.checkTenant(tenantID);

    await global.database.getCollection<any>(tenantID, 'userscars').updateMany(
      {
        carID: Utils.convertToObjectID(carID),
        owner: true
      },
      {
        $set: { owner: false }
      });
    Logging.traceEnd(MODULE_NAME, 'clearUserCarOwner', uniqueTimerID, { carID });
  }

  public static async getUserCarByCarUser(tenantID: string,
    carID: string = Constants.UNKNOWN_STRING_ID, userID: string = Constants.UNKNOWN_STRING_ID,
    projectFields?: string[]): Promise<UserCar> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getUserCarByCarUser');
    // Query single Car
    const usersCarsMDB = await CarStorage.getUsersCars(tenantID,
      { carIDs: [carID], userIDs: [userID] },
      Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    Logging.traceEnd(MODULE_NAME, 'getUserCarByCarUser', uniqueTimerID, { userID, carID });
    return usersCarsMDB.count > 0 ? usersCarsMDB.result[0] : null;
  }

  public static async getUsersCars(tenantID: string,
    params: { search?: string; userscarsIDs?: string[]; userIDs?: string[]; carIDs?: string[]; active?: boolean } = {},
    dbParams?: DbParams, projectFields?: string[]): Promise<DataResult<UserCar>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getUsersCars');
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: any = {};
    if (params.active) {
      filters.active = params.active;
    }
    // Limit on Car for Basic Users
    if (!Utils.isEmptyArray(params.userscarsIDs)) {
      // Build filter
      filters._id = { $in: params.userscarsIDs.map((userscarsID) => Utils.convertToObjectID(userscarsID)) };
    }
    if (!Utils.isEmptyArray(params.carIDs)) {
      // Build filter
      filters.carID = { $in: params.carIDs.map((carID) => Utils.convertToObjectID(carID)) };
    }
    if (!Utils.isEmptyArray(params.userIDs)) {
      // Build filter
      filters.userID = { $in: params.userIDs.map((userID) => Utils.convertToObjectID(userID)) };
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID: tenantID, aggregation, localField: 'userID', foreignField: '_id',
      asField: 'user', oneToOneCardinality: true
    });
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const usersCarsCountMDB = await global.database.getCollection<DataResult<UserCar>>(tenantID, 'userscars')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      return {
        count: (usersCarsCountMDB.length > 0 ? usersCarsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Sort
    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      aggregation.push({
        $sort: { name: 1 }
      });
    }
    // Skip
    if (skip > 0) {
      aggregation.push({ $skip: skip });
    }
    // Limit
    aggregation.push({
      $limit: (limit > 0 && limit < Constants.DB_RECORD_COUNT_CEIL) ? limit : Constants.DB_RECORD_COUNT_CEIL
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const usersCars = await global.database.getCollection<UserCar>(tenantID, 'userscars')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getUsersCars', uniqueTimerID,
      { params, limit: dbParams.limit, skip: dbParams.skip, sort: dbParams.sort });
    // Ok
    return {
      count: (usersCarsCountMDB.length > 0 ?
        (usersCarsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : usersCarsCountMDB[0].count) : 0),
      result: usersCars
    };
  }
}
