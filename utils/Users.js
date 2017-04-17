module.exports = {
   USER_PENDING: "P",
   USER_ACTIVE: "A",
   USER_DELETED: "D",
   USER_INACTIVE: "I",
   USER_BLOCKED: "B",

   // Check name
   isUserNameValid(name) {
     return /^[a-zA-Z\u00E0-\u00FC- ]*$/.test(name);
   },

   // Check email
   isUserEmailValid(email) {
     return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email);
   },

   isTagIDValid(tagID) {
     return /^[A-Z0-9,]*$/.test(tagID);
   },

   isPhoneValid(phone) {
     return /^\+?([0-9] ?){9,14}[0-9]$/.test(phone);
   },

   isINumberValid(iNumber) {
     return /^[A-Z]{1}[0-9]{6}$/.test(iNumber);
   }
}
