import fs from 'fs';
import i18n from 'i18n-js';
import Intl from 'intl';
import moment from 'moment';
import global from '../types/GlobalType';
import Constants from './Constants';
import Utils from './Utils';

export default class I18nManager {
  public static async initialize() {
    // Get the supported locales for moment
    require('moment/locale/fr');
    require('moment/locale/de');
    require('moment/locale/en-gb');
    // Get translation files
    i18n.translations['en'] = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/i18n/en.json`, 'utf8'));
    i18n.translations['fr'] = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/i18n/fr.json`, 'utf8'));
    // Default
    i18n.locale = Constants.DEFAULT_LANGUAGE;
    moment.locale(Constants.DEFAULT_LANGUAGE);
  }

  public static switchLocale(locale: string) {
    if (locale) {
      return I18nManager.switchLanguage(Utils.getLanguageFromLocale(locale));
    }
  }

  public static switchLanguage(language: string) {
    // Supported languages?
    if (language && Constants.SUPPORTED_LANGUAGES.includes(language)) {
      i18n.locale = language;
      moment.locale(language);
    }
  }

  public static formatNumber(value: number): string {
    return new Intl.NumberFormat(i18n.locale).format(value);
  }

  public static formatCurrency(value: number, currency?: string): string {
    // Format Currency
    if (currency) {
      return new Intl.NumberFormat(i18n.locale, { style: 'currency', currency }).format(value);
    }
    return I18nManager.formatNumber(Math.round(value * 100) / 100);
  }

  public static formatPercentage(value: number): string {
    if (!isNaN(value)) {
      return new Intl.NumberFormat(i18n.locale, { style: 'percent' }).format(value);
    }
    return '0';
  }

  public static formatDateTime(value: Date, format = 'LLL') {
    return moment(value).format(format);
  }
}
