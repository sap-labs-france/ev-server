import { expect } from 'chai';
import CrudApi from './utils/CrudApi';

export default class StatisticsApi extends CrudApi {

  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public static calculateTotalsPerMonth(record: { [x: string]: number }): number {
    let total = 0;
    for (const key in record) {
      if (key !== 'month' && typeof (record[key]) === 'number') {
        total += record[key];
      }
    }
    return total;
  }

  public static calculateNumberOfItemsPerMonth(record: { [x: string]: number }): number {
    let number = 0;
    for (const key in record) {
      if (key !== 'month') {
        number++;
      }
    }
    return number;
  }

  public static convertExportFileToRawArray(fileData: string): Array<string> {
    let fileArray = fileData.split('\r\n');
    fileArray = fileArray.filter((record: string) => record.length > 0);
    return fileArray;
  }

  public static convertExportFileToObjectArray(fileData: string): Array<{ [x: string]: any }> {
    let jsonString = '';
    const objectArray = [];
    const fileArray = StatisticsApi.convertExportFileToRawArray(fileData);
    if (Array.isArray(fileArray) && fileArray.length > 0) {
      const columns = fileArray[0].split(',');
      for (let i = 1; i < fileArray.length; i++) {
        const values = fileArray[i].split(',');
        jsonString = '{';
        for (let j = 0; j < columns.length; j++) {
          if (j > 0) {
            jsonString += ',';
          }
          jsonString += `"${columns[j]}":"${values[j]}"`;
        }
        jsonString += '}';
        objectArray.push(JSON.parse(jsonString));
      }
    }
    return objectArray;
  }

  public readAllYears() {
    return super.read({}, '/client/api/TransactionYears');
  }

  public readChargingStationConsumption(params) {
    return super.read(params, '/client/api/ChargingStationConsumptionStatistics');
  }

  public readUserConsumption(params) {
    return super.read(params, '/client/api/UserConsumptionStatistics');
  }

  public readChargingStationUsage(params) {
    return super.read(params, '/client/api/ChargingStationUsageStatistics');
  }

  public readUserUsage(params) {
    return super.read(params, '/client/api/UserUsageStatistics');
  }

  public readChargingStationInactivity(params) {
    return super.read(params, '/client/api/ChargingStationInactivityStatistics');
  }

  public readUserInactivity(params) {
    return super.read(params, '/client/api/UserInactivityStatistics');
  }

  public readChargingStationTransactions(params) {
    return super.read(params, '/client/api/ChargingStationTransactionsStatistics');
  }

  public readUserTransactions(params) {
    return super.read(params, '/client/api/UserTransactionsStatistics');
  }

  public async exportStatistics(params) {
    return await super.read(params, '/client/api/StatisticsExport');
  }

}
