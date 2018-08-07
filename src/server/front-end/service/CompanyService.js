const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Companies = require('../../../utils/Companies');
const Constants = require('../../../utils/Constants');
const Company = require('../../../model/Company');
const Authorizations = require('../../../authorization/Authorizations');
const CompanySecurity = require('./security/CompanySecurity');

class CompanyService {
	static handleDeleteCompany(action, req, res, next) {
		// Filter
		let company;
		let filteredRequest = CompanySecurity.filterCompanyDeleteRequest(
			req.query, req.user);
		// Check Mandatory fields
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Company's ID must be provided`), req, res, next);
			return;
		}
		// Get
		global.storage.getCompany(filteredRequest.ID).then((foundCompany) => {
			company = foundCompany;
			// Found?
			if (!company) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Company with ID '${filteredRequest.ID}' does not exist`,
					550, "CompanyService", "handleDeleteCompany");
			}
			// Check auth
			if (!Authorizations.canDeleteCompany(req.user, company.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_DELETE,
					Constants.ENTITY_COMPANY,
					company.getID(),
					560, "CompanyService", "handleDeleteCompany",
					req.user);
			}
			// Delete
			return company.delete();
		}).then(() => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: "CompanyService", method: "handleDeleteCompany",
				message: `Company '${company.getName()}' has been deleted successfully`,
				action: action, detailedMessages: company});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetCompany(action, req, res, next) {
		// Filter
		let filteredRequest = CompanySecurity.filterCompanyRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Company ID is mandatory`), req, res, next);
			return;
		}
		// Get it
		global.storage.getCompany(filteredRequest.ID).then((company) => {
			if (!company) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Company with ID '${filteredRequest.ID}' does not exist anymore`,
					550, "CompanyService", "handleGetCompany");
			}
			// Check auth
			if (!Authorizations.canReadCompany(req.user, company.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_READ,
					Constants.ENTITY_COMPANY,
					company.getID(),
					560, "CompanyService", "handleGetCompany",
					req.user);
			}
			// Return
			res.json(
				// Filter
				CompanySecurity.filterCompanyResponse(
					company.getModel(), req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetCompanyLogo(action, req, res, next) {
		// Filter
		let filteredRequest = CompanySecurity.filterCompanyRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Company ID is mandatory`), req, res, next);
			return;
		}
		// Get it
		let company;
		global.storage.getCompany(filteredRequest.ID).then((foundCompany) => {
			company = foundCompany;
			if (!company) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Company with ID '${filteredRequest.ID}' does not exist anymore`,
					550, "CompanyService", "handleGetCompanyLogo");
			}
			// Check auth
			if (!Authorizations.canReadCompany(req.user, company.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_READ,
					Constants.ENTITY_COMPANY,
					company.getID(),
					560, "CompanyService", "handleGetCompanyLogo",
					req.user);
			}
			// Get the logo
			return global.storage.getCompanyLogo(filteredRequest.ID);
		}).then((companyLogo) => {
			// Found?
			if (companyLogo) {
				// Set the user
				res.json(companyLogo);
			} else {
				res.json(null);
			}
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetCompanyLogos(action, req, res, next) {
		// Check auth
		if (!Authorizations.canListCompanies(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				Authorizations.ACTION_LIST,
				Constants.ENTITY_COMPANIES,
				null,
				560, "CompanyService", "handleGetCompanyLogos",
				req.user);
		}
		// Get the company logo
		global.storage.getCompanyLogos().then((companyLogos) => {
			res.json(companyLogos);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetCompanies(action, req, res, next) {
		// Check auth
		if (!Authorizations.canListCompanies(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				Authorizations.ACTION_LIST,
				Constants.ENTITY_COMPANIES,
				null,
				560, "CompanyService", "handleGetCompanies",
				req.user);
			return;
		}
		// Filter
		let filteredRequest = CompanySecurity.filterCompaniesRequest(req.query, req.user);
		// Get the companies
		global.storage.getCompanies(filteredRequest.Search,
				filteredRequest.WithSites, Constants.NO_LIMIT).then((companies) => {
			let companiesJSon = [];
			companies.forEach((company) => {
				// Set the model
				companiesJSon.push(company.getModel());
			});
			// Return
			res.json(
				// Filter
				CompanySecurity.filterCompaniesResponse(
					companiesJSon, req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleCreateCompany(action, req, res, next) {
		// Check auth
		if (!Authorizations.canCreateCompany(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				Authorizations.ACTION_CREATE,
				Constants.ENTITY_COMPANY,
				null,
				560, "CompanyService", "handleCreateCompany",
				req.user);
		}
		// Filter
		let filteredRequest = CompanySecurity.filterCompanyCreateRequest( req.body, req.user );
		// Get the logged user
		let company, newCompany;
		global.storage.getUser(req.user.id).then((loggedUser) => {
			// Check Mandatory fields
			Companies.checkIfCompanyValid(filteredRequest, req);
			// Create
			company = new Company(filteredRequest);
			// Update timestamp
			company.setCreatedBy(loggedUser);
			company.setCreatedOn(new Date());
			// Save
			return company.save();
		}).then((createdCompany) => {
			newCompany = createdCompany;
			// Update Company's Logo
			newCompany.setLogo(company.getLogo());
			// Save
			return newCompany.saveLogo();
		}).then(() => {
			Logging.logSecurityInfo({
				user: req.user, module: "CompanyService", method: "handleCreateCompany",
				message: `Company '${newCompany.getName()}' has been created successfully`,
				action: action, detailedMessages: newCompany});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleUpdateCompany(action, req, res, next) {
		// Filter
		let filteredRequest = CompanySecurity.filterCompanyUpdateRequest( req.body, req.user );
		// Check email
		let company;
		global.storage.getCompany(filteredRequest.id).then((foundCompany) => {
			company = foundCompany;
			if (!company) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Company with ID '${filteredRequest.id}' does not exist anymore`,
					550, "CompanyService", "handleUpdateCompany");
			}
			// Check Mandatory fields
			Companies.checkIfCompanyValid(filteredRequest, req);
			// Check auth
			if (!Authorizations.canUpdateCompany(req.user, company.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_UPDATE,
					Constants.ENTITY_COMPANY,
					company.getID(),
					560, "CompanyService", "handleCreateCompany",
					req.user);
			}
			// Get the logged user
			return global.storage.getUser(req.user.id);
		// Logged User
		}).then((loggedUser) => {
			// Update
			Database.updateCompany(filteredRequest, company.getModel());
			// Update timestamp
			company.setLastChangedBy(loggedUser);
			company.setLastChangedOn(new Date());
			// Update Company's Logo
			return company.saveLogo();
		}).then(() => {
			// Update Company
			return company.save();
		}).then((updatedCompany) => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: "CompanyService", method: "handleUpdateCompany",
				message: `Company '${updatedCompany.getName()}' has been updated successfully`,
				action: action, detailedMessages: updatedCompany});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}
}

module.exports = CompanyService;
