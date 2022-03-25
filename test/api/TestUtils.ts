import Constants from '../../src/utils/Constants';

export default class TestUtils {
  static async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public static convertExportFileToRawArray(fileData: string): Array<string> {
    let fileArray = fileData.split(Constants.CR_LF);
    fileArray = fileArray.filter((record: string) => record.length > 0);
    return fileArray;
  }

  public static convertExportFileToObjectArray(fileData: string): Array<{ [x: string]: any }> {
    let jsonString = '';
    const objectArray = [];
    const fileArray = TestUtils.convertExportFileToRawArray(fileData);
    if (Array.isArray(fileArray) && fileArray.length > 0) {
      const columns = fileArray[0].split(Constants.CSV_SEPARATOR);
      for (let i = 1; i < fileArray.length; i++) {
        const values = fileArray[i].split(Constants.CSV_SEPARATOR);
        jsonString = '{';
        for (let j = 0; j < columns.length; j++) {
          if (j > 0) {
            jsonString += ',';
          }
          jsonString += `"${columns[j].replace(/^"|"$/g, '')}":"${values[j].replace(/^"|"$/g, '')}"`;
        }
        jsonString += '}';
        objectArray.push(JSON.parse(jsonString));
      }
    }
    return objectArray;
  }
}
