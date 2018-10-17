
class UnauthorizedError extends Error {
	constructor(action, entity, value, user) {
		super(`Not authorised to perform '${action}' on '${entity}' ${(value?"'"+value+"' ":" ")}(Role='${user.role}')`);
		this.action = action;
		this.entity = entity;
		this.value = value;
        this.user = user;
    }
}

module.exports = UnauthorizedError;
