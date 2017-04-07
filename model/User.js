var Utils = require('../utils/Utils');
var Promise = require('promise');

class User {
  constructor(user) {
    // Init model
    this._model = {};

    // Set it
    Utils.updateUser(user, this._model);
  }

  getModel() {
    return this._model;
  }

  getName() {
    return this._model.name;
  }

  setName(name) {
    this._model.name = name;
  }

  getFirstName() {
    return this._model.firstName;
  }

  setFirstName(firstName) {
    this._model.firstName = firstName;
  }

  getFullName() {
    return this.getName() + " " + this.getFirstName(); 
  }

  getTagID() {
    return this._model.tagID;
  }

  setTagID(tagID) {
    this._model.tagID = tagID;
  }

  getEMail() {
    return this._model.email;
  }

  setEMail(email) {
    this._model.email = email;
  }

  getPhone() {
    return this._model.phone;
  }

  setPhone(phone) {
    this._model.phone = phone;
  }

  getBadgeNumber() {
    return this._model.badgeNumber;
  }

  setBadgeNumber(phone) {
    this._model.badgeNumber = badgeNumber;
  }

  getINumber() {
    return this._model.iNumber;
  }

  setINumber(iNumber) {
    this._model.iNumber = iNumber;
  }

  getCostCenter() {
    return this._model.costCenter;
  }

  setCostCenter(costCenter) {
    this._model.costCenter = costCenter;
  }

  getLocation() {
    return this._model.location;
  }

  setLocation(location) {
    this._model.location = location;
  }

  getElectricVehicules()  {
    return this._model.electricVehicules;
  }

  setElectricVehicules(electricVehicules)  {
    this._model.electricVehicules = electricVehicules;
  }

  save() {
    return global.storage.saveUser(this);
  }
}

module.exports = User;
