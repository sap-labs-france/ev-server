import { addedDiff, deletedDiff } from 'deep-object-diff';

import Constants from '../src/utils/Constants';
import { promises as fs } from 'fs';

class I18nChecker {

  public static async compare(): Promise<void> {
    const contentEN = await fs.readFile('./src/assets/i18n/en.json', 'utf8');
    const otherLanguages = Constants.SUPPORTED_LANGUAGES.filter((lang) => (lang !== 'en') ? lang : null);
    const otherFiles = otherLanguages.map((language) => language + '.json');
    try {
      const parsedContentEN = JSON.parse(contentEN);
      for (const file of otherFiles) {
        try {
          const contentOtherLanguage = await fs.readFile('./src/assets/i18n/' + file, 'utf8');
          const parsedContentOtherLanguage = JSON.parse(contentOtherLanguage);
          const added = addedDiff(parsedContentEN, parsedContentOtherLanguage);
          const deleted = deletedDiff(parsedContentEN, parsedContentOtherLanguage);
          if (Object.keys(added).length > 0) {
            console.log('Added in language ' + file);
            console.log(added);
          }
          if (Object.keys(deleted).length > 0) {
            console.log('Deleted in language ' + file);
            console.log(deleted);
          }
          if (Object.keys(added).length === 0 && Object.keys(deleted).length === 0) {
            if (I18nChecker.compareContent(parsedContentEN, parsedContentOtherLanguage, file)) {
              console.log('No error found for file ' + file);
            }
          }
        } catch (err) {
          console.log('File not found or with wrong format: ' + file);
          console.log(err.message);
          continue;
        }
      }
    } catch (err) {
      console.log('English file not found.');
      throw err;
    }
  }

  private static compareValueContent(keyName: string, originalValue: string, comparedValue: string, file: string): boolean {
    if (originalValue.trim() === comparedValue.trim()) {
      console.log(file + ': Content `' + keyName + '` probably not yet translated (current value is: `' + originalValue + '`)');
      return false; // Value is same!
    }
    return true; // Value is translated.
  }

  private static compareContent(originalLanguage: JSON, comparedLanguage: JSON, file: string): boolean {
    let noIssue = true;
    for (const keyName of Object.keys(originalLanguage)) {
      switch (typeof originalLanguage[keyName]) {
        case 'string':
          noIssue = I18nChecker.compareValueContent(keyName, originalLanguage[keyName], comparedLanguage[keyName], file) && noIssue;
          break;
        case 'object':
          noIssue = I18nChecker.compareContent(Object.assign({}, originalLanguage[keyName]), Object.assign({}, comparedLanguage[keyName]), file) && noIssue;
          break;
        default:
          console.error(keyName + ' is not a supported type!');
      }
    }
    return noIssue;
  }
}

// Start
I18nChecker.compare().catch((error) => {
  console.log(error.message);
});
