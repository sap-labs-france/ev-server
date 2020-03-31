import { Car } from '../../types/Car';
import DbParams from '../../types/database/DbParams';
import { DataResult } from '../../types/DataResult';
import global from '../../types/GlobalType';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import DatabaseUtils from './DatabaseUtils';

export default class CarStorage {
  public static async getCar(id: string, projectFields?: string[]): Promise<Car> {
    // Debug
    const uniqueTimerID = Logging.traceStart('CarStorage', 'getCar');
    // Query single Site
    const carsMDB = await CarStorage.getCars(
      { carID: id },
      Constants.DB_PARAMS_SINGLE_RECORD, projectFields);

    Logging.traceEnd('CarStorage', 'getCar', uniqueTimerID, { id });
    return carsMDB.count > 0 ? carsMDB.result[0] : null;
  }

  public static async getCars(
    params: { search?: string; carID?: string; carIDs?: string[]; vehicleMakes?: string[] } = {},
    dbParams?: DbParams, projectFields?: string[]): Promise<DataResult<Car>> {
    // Debug
    const uniqueTimerID = Logging.traceStart('CarStorage', 'getCars');
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: ({ _id?: number; $or?: any[] } | undefined) = {};
    if (params.carID) {
      filters._id = +params.carID;
    } else if (params.search) {
      const searchRegex = Utils.escapeSpecialCharsInRegex(params.search);
      filters.$or = [
        { 'vehicleModele': { $regex: searchRegex, $options: 'i' } },
        { 'vehicleMake': { $regex: searchRegex, $options: 'i' } },
      ];
    }
    // Create Aggregation
    const aggregation = [];
    // Limit on Car for Basic Users
    if (params.carIDs && params.carIDs.length > 0) {
      // Build filter
      aggregation.push({
        $match: {
          _id: { $in: params.carIDs }
        }
      });
    }
    if (params.vehicleMakes && Array.isArray(params.vehicleMakes)) {
      // Build filter
      aggregation.push({
        $match: {
          'vehicleMake': {
            $in: params.vehicleMakes
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
    const carsCountMDB = await global.database.getCollection<DataResult<Car>>(Constants.DEFAULT_TENANT, 'cars')
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
    const cars = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'cars')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd('CarStorage', 'getCars', uniqueTimerID,
      { params, limit: dbParams.limit, skip: dbParams.skip, sort: dbParams.sort });
    // Ok
    return {
      count: (carsCountMDB.length > 0 ?
        (carsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : carsCountMDB[0].count) : 0),
      result: cars
    };
  }

  public static async saveCar(carToSave: Car): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('CarStorage', 'saveCar');
    // Build Request
    // Properties to save
    const carMDB: any = {
      _id: carToSave.id,
      vehicleMake: carToSave.vehicleMake,
      vehicleModel: carToSave.vehicleModel,
      vehicleModelVersion: carToSave.vehicleModelVersion,
      availabilityStatus: carToSave.availabilityStatus,
      availabilityDateFrom: carToSave.availabilityDateFrom,
      availabilityDateTo: carToSave.availabilityDateTo,
      priceFromDE: carToSave.priceFromDE,
      priceFromDEEstimate: carToSave.priceFromDEEstimate,
      priceFromNL: carToSave.priceFromNL,
      priceFromNLEstimate: carToSave.priceFromNLEstimate,
      priceFromUK: carToSave.priceFromUK,
      priceGrantPICGUK: carToSave.priceGrantPICGUK,
      priceFromUKEstimate: carToSave.priceFromUKEstimate,
      drivetrainType: carToSave.drivetrainType,
      drivetrainFuel: carToSave.drivetrainFuel,
      drivetrainPropulsion: carToSave.drivetrainPropulsion,
      drivetrainPower: carToSave.drivetrainPower,
      drivetrainPowerHP: carToSave.drivetrainPowerHP,
      drivetrainTorque: carToSave.drivetrainTorque,
      performanceAcceleration: carToSave.performanceAcceleration,
      performanceTopspeed: carToSave.performanceTopspeed,
      rangeWLTP: carToSave.rangeWLTP,
      rangeWLTPEstimate: carToSave.rangeWLTPEstimate,
      rangeNEDC: carToSave.rangeNEDC,
      rangeNEDCEstimate: carToSave.rangeNEDCEstimate,
      rangeReal: carToSave.rangeReal,
      rangeRealMode: carToSave.rangeRealMode,
      rangeRealWHwy: carToSave.rangeRealWHwy,
      rangeRealWCmb: carToSave.rangeRealWCmb,
      rangeRealWCty: carToSave.rangeRealWCty,
      rangeRealBHwy: carToSave.rangeRealBHwy,
      rangeRealBCmb: carToSave.rangeRealBCmb,
      rangeRealBCty: carToSave.rangeRealBCty,
      efficiencyWLTP: carToSave.efficiencyWLTP,
      efficiencyWLTPFuelEq: carToSave.efficiencyWLTPFuelEq,
      efficiencyWLTPV: carToSave.efficiencyWLTPV,
      efficiencyWLTPFuelEqV: carToSave.efficiencyWLTPFuelEqV,
      efficiencyWLTPCO2: carToSave.efficiencyWLTPCO2,
      efficiencyNEDC: carToSave.efficiencyNEDC,
      efficiencyNEDCFuelEq: carToSave.efficiencyNEDCFuelEq,
      efficiencyNEDCV: carToSave.efficiencyNEDCV,
      efficiencyNEDCFuelEqV: carToSave.efficiencyNEDCFuelEqV,
      efficiencyNEDCCO2: carToSave.efficiencyNEDCCO2,
      efficiencyReal: carToSave.efficiencyReal,
      efficiencyRealFuelEqV: carToSave.efficiencyRealFuelEqV,
      efficiencyRealCO2: carToSave.efficiencyRealCO2,
      efficiencyRealWHwy: carToSave.efficiencyRealWHwy,
      efficiencyRealWCmb: carToSave.efficiencyRealWCmb,
      efficiencyRealWCty: carToSave.efficiencyRealWCty,
      efficiencyRealBHwy: carToSave.efficiencyRealBHwy,
      efficiencyRealBCmb: carToSave.efficiencyRealBCmb,
      efficiencyRealBCty: carToSave.efficiencyRealBCty,
      chargePlug: carToSave.chargePlug,
      chargePlugEstimate: carToSave.chargePlugEstimate,
      chargePlugLocation: carToSave.chargePlugLocation,
      chargeStandardPower: carToSave.chargeStandardPower,
      chargeStandardPhase: carToSave.chargeStandardPhase,
      chargeStandardPhaseAmp: carToSave.chargeStandardPhaseAmp,
      chargeStandardChargeTime: carToSave.chargeStandardChargeTime,
      chargeStandardChargeSpeed: carToSave.chargeStandardChargeSpeed,
      chargeStandardEstimate: carToSave.chargeStandardEstimate,
      chargeStandardTables: carToSave.chargeStandardTables,
      chargeAlternativePower: carToSave.chargeAlternativePower,
      chargeAlternativePhase: carToSave.chargeAlternativePhase,
      chargeAlternativePhaseAmp: carToSave.chargeAlternativePhaseAmp,
      chargeAlternativeChargeTime: carToSave.chargeAlternativeChargeTime,
      chargeAlternativeChargeSpeed: carToSave.chargeAlternativeChargeSpeed,
      chargeAlternativeTables: carToSave.chargeAlternativeTables,
      chargeOptionPower: carToSave.chargeOptionPower,
      chargeOptionPhase: carToSave.chargeOptionPhase,
      chargeOptionPhaseAmp: carToSave.chargeOptionPhaseAmp,
      chargeOptionChargeTime: carToSave.chargeOptionChargeTime,
      chargeOptionChargeSpeed: carToSave.chargeOptionChargeSpeed,
      chargeOptionTables: carToSave.chargeOptionTables,
      fastChargePlug: carToSave.fastChargePlug,
      fastChargePlugEstimate: carToSave.fastChargePlugEstimate,
      fastChargePlugLocation: carToSave.fastChargePlugLocation,
      fastChargePowerMax: carToSave.fastChargePowerMax,
      fastChargePowerAvg: carToSave.fastChargePowerAvg,
      fastChargeTime: carToSave.fastChargeTime,
      fastChargeSpeed: carToSave.fastChargeSpeed,
      fastChargeOptional: carToSave.fastChargeOptional,
      fastChargeEstimate: carToSave.fastChargeEstimate,
      batteryCapacityUseable: carToSave.batteryCapacityUseable,
      batteryCapacityFull: carToSave.batteryCapacityFull,
      batteryCapacityEstimate: carToSave.batteryCapacityEstimate,
      dimsLength: carToSave.dimsLength,
      dimsWidth: carToSave.dimsWidth,
      dimsHeight: carToSave.dimsHeight,
      dimsWheelbase: carToSave.dimsWheelbase,
      dimsWeight: carToSave.dimsWeight,
      dimsBootspace: carToSave.dimsBootspace,
      dimsBootspaceMax: carToSave.dimsBootspaceMax,
      dimsTowWeightUnbraked: carToSave.dimsTowWeightUnbraked,
      dimsTowWeightBraked: carToSave.dimsTowWeightBraked,
      dimsRoofLoadMax: carToSave.dimsRoofLoadMax,
      miscBody: carToSave.miscBody,
      miscSegment: carToSave.miscSegment,
      miscSeats: carToSave.miscSeats,
      miscRoofrails: carToSave.miscRoofrails,
      miscIsofix: carToSave.miscIsofix,
      miscIsofixSeats: carToSave.miscIsofixSeats,
      miscTurningCircle: carToSave.miscTurningCircle,
      euroNCAPRating: carToSave.euroNCAPRating,
      euroNCAPYear: carToSave.euroNCAPYear,
      euroNCAPAdult: carToSave.euroNCAPAdult,
      euroNCAPChild: carToSave.euroNCAPChild,
      euroNCAPVRU: carToSave.euroNCAPVRU,
      euroNCAPSA: carToSave.euroNCAPSA,
      relatedVehicleIDSuccesor: carToSave.relatedVehicleIDSuccesor,
      eVDBDetailURL: carToSave.eVDBDetailURL,
      images: carToSave.images,
      videos: carToSave.videos,
      hash: carToSave.hash,
    };
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(carMDB, carToSave);
    // Modify and return the modified document
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'cars').findOneAndReplace(
      { _id: carToSave.id },
      carMDB,
      { upsert: true }
    );
    // Debug
    Logging.traceEnd('CarStorage', 'saveCar', uniqueTimerID, { carToSave });
    return carToSave.id;
  }

  public static async getCarConstructors(
    params: { search?: string } = {}): Promise<string[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart('CarStorage', 'getCars');
    // Set the filters
    const filters: ({ $or?: any[] } | undefined) = {};

    if (params.search) {
      const searchRegex = Utils.escapeSpecialCharsInRegex(params.search);
      filters.$or = [
        { 'vehicleMake': { $regex: searchRegex, $options: 'i' } },
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
      $group: { _id: null, uniqueValues: { $addToSet: '$vehicleMake' } }
    });
    aggregation.push({
      $project: {
        _id: 0,
        vehicleMakes: '$uniqueValues'
      }
    });
    const result = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'cars')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd('CarStorage', 'getCars', uniqueTimerID, { result });
    // Ok
    return result.length > 0 ? result[0].vehicleMakes : null;
  }

}
