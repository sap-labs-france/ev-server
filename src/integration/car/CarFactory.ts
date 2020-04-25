import CarIntegration from './CarIntegration';
import EVDabaseCarIntegration from './ev-database/EVDabaseCarIntegration';

export default class CarFactory {
  static async getCarImpl(): Promise<CarIntegration> {
    // Always return the EVDatabase
    return new EVDabaseCarIntegration();
  }
}

