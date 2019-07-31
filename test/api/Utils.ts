export default class Utils {
  static async sleep(ms) {
    return await new Promise((resolve) => {
      return setTimeout(resolve, ms);
    });
  }
}
