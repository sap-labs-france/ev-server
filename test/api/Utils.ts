export default class Utils {
  static async sleep(ms) {
    return await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
