const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const MDBUser = require('../model/MDBUser');
const MDBTag = require('../model/MDBTag');
const User = require('../../../model/User');
const crypto = require('crypto');

let _centralRestServer;

class UserStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static handleGetUserByTagId(tagID) {
		// Exec request
		return MDBTag.findById(tagID).populate("userID").exec().then((tagMDB) => {
			let user = null;
			// Check
			if (tagMDB && tagMDB.userID && !tagMDB.userID.deleted) {
				// Ok
				user = new User(tagMDB.userID);
			} else {
				// Return empty user
				return Promise.resolve();
			}
			// Ok
			return user;
		});
	}

	static handleGetUserByEmail(email) {
		// Exec request
		return MDBUser.findOne({"email": email}).then((userMDB) => {
			// Check deleted
			if (userMDB && userMDB.deleted) {
				// Return empty user
				return Promise.resolve();
			} else {
				// Ok
				return UserStorage._createUser(userMDB);
			}
		});
	}

	static handleGetUser(id) {
		// Check
		if (!UserStorage._checkIfMongoDBIDIsValid(id)) {
			// Return empty user
			return Promise.resolve();
		}

		// Exec request
		return MDBUser.findById(id).exec().then((userMDB) => {
			// Check deleted
			if (userMDB && userMDB.deleted) {
				// Return empty user
				return Promise.resolve();
			} else {
				// Ok
				return UserStorage._createUser(userMDB);
			}
		});
	}

	static handleSaveUser(user) {
		// Check if ID or email is provided
		if (!user.id && !user.email) {
			// ID ,ust be provided!
			return Promise.reject( new Error("Error in saving the User: User has no ID or Email and cannot be created or updated") );
		} else {
			let userFilter = {};
			// Build Request
			if (user.id) {
				userFilter._id = user.id;
			} else {
				userFilter.email = user.email;
			}
			// Get
			return MDBUser.findOneAndUpdate(userFilter, user, {
					new: true,
					upsert: true
				}).then((userMDB) => {
					let newUser = new User(userMDB);
					// Notify Change
					if (!user.id) {
						_centralRestServer.notifyUserCreated(
							{
								"id": newUser.getID(),
								"type": "User"
							}
						);
					} else {
						_centralRestServer.notifyUserUpdated(
							{
								"id": newUser.getID(),
								"type": "User"
							}
						);
					}
					// Update the badges
					// First delete them
					MDBTag.remove({ "userID" : userMDB._id }).then(() => {
						// Add tags
						user.tagIDs.forEach((tag) => {
							// Update/Insert Tag
							return MDBTag.findOneAndUpdate({
									"_id": tag
								},{
									"_id": tag,
									"userID": userMDB._id
								},{
									new: true,
									upsert: true
								}).then((newTag) => {
									// Created with success
								});                // Add TagIds
						});
					});
					return newUser;
				});
		}
	}

	static handleGetUsers(searchValue, numberOfUser, withPicture) {
		if (!numberOfUser || isNaN(numberOfUser)) {
			numberOfUser = 200;
		}
		// Set the filters
		let filters = {
			"$and": [
				{
					"$or": [
						{ "deleted": { $exists:false } },
						{ deleted: false }
					]
				}
			]
		};
		// Source?
		if (searchValue) {
			// Build filter
			filters.$and.push({
				"$or": [
					{ "name" : { $regex : searchValue, $options: 'i' } },
					{ "firstName" : { $regex : searchValue, $options: 'i' } },
					{ "email" : { $regex : searchValue, $options: 'i' } },
					{ "role" : { $regex : searchValue, $options: 'i' } }
				]
			});
		}
		// Exec request
		return MDBTag.find({}).exec().then((tagsMDB) => {
			// Exec request
			return MDBUser.find(filters, (withPicture?{}:{image:0})).sort( {status: -1, name: 1, firstName: 1} ).limit(numberOfUser).exec().then((usersMDB) => {
				let users = [];
				// Create
				usersMDB.forEach((userMDB) => {
					// Create
					let user = new User(userMDB);
					// Get TagIDs
					let tags = tagsMDB.filter((tag) => {
						// Find a match
						return tag.userID.equals(userMDB._id);
					}).map((tag) => {
						return tag._id;
					});
					// Set
					user.setTagIDs(tags);
					// Add
					users.push(user);
				});
				// Ok
				return users;
			});
		});
	}

	static handleDeleteUser(id) {
		return MDBUser.remove({ "_id" : id }).then((result) => {
			// Notify Change
			_centralRestServer.notifyUserDeleted(
				{
					"id": id,
					"type": "User"
				}
			);
			// Return the result
			return result.result;
		});
	}

	static _createUser(userMDB) {
		let user = null;
		// Check
		if (userMDB) {
			// Create
			user = new User(userMDB);
			// Get the Tags
			return MDBTag.find({"userID": userMDB.id}).exec().then((tagsMDB) => {
				// Check
				if (tagsMDB) {
					// Get the Tags
					let tags = tagsMDB.map((tagMDB) => { return tagMDB.id; });
					// Get IDs`
					user.setTagIDs(tags);
				}
				return user;
			});
		} else {
			// Ok
			return user;
		}
	}

	static _checkIfMongoDBIDIsValid(id) {
			// Check ID
		if (/^[0-9a-fA-F]{24}$/.test(id)) {
			// Valid
			return true;
		}
		return false;
	}
}

module.exports = UserStorage;
