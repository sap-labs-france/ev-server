// Get the supported locales for moment
import 'moment/locale/fr';
import 'moment/locale/de';
import 'moment/locale/es';
import 'moment/locale/en-gb';
import 'moment/locale/pt-br';

import Constants from './Constants';
import Intl from 'intl';
import Utils from './Utils';
import fs from 'fs';
import global from '../types/GlobalType';
import i18n from 'i18n-js';
import moment from 'moment';

export default class I18nManager {
  private static instances = new Map<string, I18nManager>(); // Tableau avec la cle en locale
  private language: string;

  private constructor(locale: string) {
    // Get language
    this.language = Utils.getLanguageFromLocale(locale);
    // Supported languages?
    if (!this.language || !Constants.SUPPORTED_LANGUAGES.includes(this.language)) {
      // Default
      this.language = Constants.DEFAULT_LANGUAGE;
    }
  }

  // Get the already existing instance of I18nManager depending on the locale if it exists otherwise we create it
  public static getInstanceForLocale(locale: string): I18nManager {
    if (!I18nManager.instances.has(locale)) {
      I18nManager.instances.set(locale, new I18nManager(locale));
    }

    return I18nManager.instances.get(locale);
  }


  public static initialize(): void {
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

  public translate(key: string, params?: Record<string, unknown>): string {
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
    return this.formatNumber(Utils.truncTo(value, 2));
  }

  public formatPercentage(value: number): string {
    if (!isNaN(value)) {
      return new Intl.NumberFormat(this.language, { style: 'percent' }).format(value);
    }
    return '0';
  }

  public formatDateTime(value: Date, format = 'LLL'): string {
    moment.locale(this.language);
    return moment(new Date(value)).format(format);
  }
}
