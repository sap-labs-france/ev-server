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
            console.log('No issue found for: ' + file);
          }
        } catch (err) {
          console.log('File not found or with wrong format: ' + file);
          continue;
        }
      }
    } catch (err) {
      console.log('English file not found.');
      throw err;
    }
  }
}

// Start
I18nChecker.compare().catch((error) => {
  console.log(error.message);
});
