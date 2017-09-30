var Database = require('../utils/Database');

class User {
  constructor(user) {
    // Init model
    this._model = {};

    // Set it
    Database.updateUser(user, this._model);
  }

  getModel() {
    return this._model;
  }

  getID() {
    return this._model.id;
  }

  getName() {
    return this._model.name;
  }

  setName(name) {
    this._model.name = name;
  }

  getPassword() {
    return this._model.password;
  }

  setPassword(password) {
    this._model.password = password;
  }

  getPasswordWrongNbrTrials() {
    return this._model.passwordWrongNbrTrials;
  }

  setPasswordWrongNbrTrials(passwordWrongNbrTrials) {
    this._model.passwordWrongNbrTrials = passwordWrongNbrTrials;
  }

  getPasswordBlockedUntil() {
    return this._model.passwordBlockedUntil;
  }

  setPasswordBlockedUntil(passwordBlockedUntil) {
    this._model.passwordBlockedUntil = passwordBlockedUntil;
  }

  getLocale() {
    return this._model.locale;
  }

  setLocale(locale) {
    this._model.locale = locale;
  }

  getRole() {
    return this._model.role;
  }

  setRole(role) {
    this._model.role = role;
  }

  getFirstName() {
    return this._model.firstName;
  }

  setFirstName(firstName) {
    this._model.firstName = firstName;
  }

  getFullName() {
    return (this.getFirstName()?this.getFirstName() + " ":"") + this.getName();
  }

  getTagIDs() {
    return this._model.tagIDs;
  }

  setTagIDs(tagIDs) {
    this._model.tagIDs = tagIDs;
  }

  addTagID(tagID) {
    if (!this._model.tagIDs) {
      this._model.tagIDs = [];
    }
    this._model.tagIDs.push(tagID);
  }

  getImage() {
    return this._model.image;
  }

  setImage(image) {
    this._model.image = image;
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

  getStatus() {
    return this._model.status;
  }

  setStatus(status) {
    this._model.status = status;
  }

  getCreatedBy() {
    return this._model.createdBy;
  }

  setCreatedBy(createdBy) {
    this._model.createdBy = createdBy;
  }

  getCreatedOn() {
    return this._model.createdOn;
  }

  setCreatedOn(createdOn) {
    this._model.createdOn = createdOn;
  }

  getLastChangedBy() {
    return this._model.lastChangedBy;
  }

  setLastChangedBy(lastChangedBy) {
    this._model.lastChangedBy = lastChangedBy;
  }

  getLastChangedOn() {
    return this._model.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn) {
    this._model.lastChangedOn = lastChangedOn;
  }

  setDeleted(deleted) {
    this._model.deleted = deleted;
  }

  isDeleted() {
    return this._model.deleted;
  }

  getTransactions(filter, withImage) {
    if (!filter) {
      filter = {};
    }
    // Set the user ID
    filter.userId = this.getID();
    // Get the consumption
    return global.storage.getTransactions(null, filter, withImage);
  }

  save() {
    return global.storage.saveUser(this.getModel());
  }

  delete() {
    // Set deleted
    this.setDeleted(true);
    // Delete
    return this.save();
  }
}

module.exports = User;
