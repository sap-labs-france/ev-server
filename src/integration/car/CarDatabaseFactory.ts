import CarDatabase from './CarDatabase';
import EVDabaseCar from './ev-database/EVDabaseCar';

export default class CarDatabaseFactory {
  static async getCarDatabaseImpl(): Promise<CarDatabase> {
    // Always return the EVDatabase
    return new EVDabaseCar();
  }
}

