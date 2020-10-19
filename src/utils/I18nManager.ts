import Constants from './Constants';
import Intl from 'intl';
import Utils from './Utils';
import fs from 'fs';
import global from '../types/GlobalType';
import i18n from 'i18n-js';
import moment from 'moment';

export default class I18nManager {
  private language: string;

  public constructor(locale: string) {
    // Get language
    this.language = Utils.getLanguageFromLocale(locale);
    // Supported languages?
    if (!this.language || !Constants.SUPPORTED_LANGUAGES.includes(this.language)) {
      // Default
      this.language = Constants.DEFAULT_LANGUAGE;
    }
  }

  public static async initialize() {
    // Get the supported locales for moment
    require('moment/locale/fr');
    require('moment/locale/de');
    require('moment/locale/es');
    require('moment/locale/en-gb');
    // Get translation files
    i18n.translations['en'] = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/i18n/en.json`, 'utf8'));
    i18n.translations['fr'] = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/i18n/fr.json`, 'utf8'));
    i18n.translations['es'] = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/i18n/es.json`, 'utf8'));
    i18n.translations['de'] = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/i18n/de.json`, 'utf8'));
    i18n.translations['pt'] = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/i18n/pt.json`, 'utf8'));
    // Default
    i18n.locale = Constants.DEFAULT_LANGUAGE;
    moment.locale(Constants.DEFAULT_LANGUAGE);
  }

  public translate(key: string, params?: object): string {
    i18n.locale = this.language;
    return i18n.t(key, params);
  }

  public formatNumber(value: number): string {
    return new Intl.NumberFormat(this.language).format(value);
  }

  public formatCurrency(value: number, currency?: string): string {
    // Format Currency
    if (currency) {
      return new Intl.NumberFormat(this.language, { style: 'currency', currency }).format(value);
    }
    return this.formatNumber(Math.round(value * 100) / 100);
  }

  public formatPercentage(value: number): string {
    if (!isNaN(value)) {
      return new Intl.NumberFormat(this.language, { style: 'percent' }).format(value);
    }
    return '0';
  }

  public formatDateTime(value: Date, format = 'LLL') {
    moment.locale(this.language);
    return moment(new Date(value)).format(format);
  }
}
