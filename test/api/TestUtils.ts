export default class TestUtils {
  static async sleep(ms) {
    return await new Promise((resolve) => setTimeout(resolve, ms));
  }

  public static convertExportFileToRawArray(fileData: string): Array<string> {
    let fileArray = fileData.split('\r\n');
    fileArray = fileArray.filter((record: string) => record.length > 0);
    return fileArray;
  }

  public static convertExportFileToObjectArray(fileData: string): Array<{ [x: string]: any }> {
    let jsonString = '';
    const objectArray = [];
    const fileArray = TestUtils.convertExportFileToRawArray(fileData);
    if (Array.isArray(fileArray) && fileArray.length > 0) {
      const columns = fileArray[0].split('\t');
      for (let i = 1; i < fileArray.length; i++) {
        const values = fileArray[i].split('\t');
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
}
