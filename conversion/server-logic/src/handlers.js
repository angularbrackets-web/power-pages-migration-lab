// ---- server logic handlers ----------------------------------------------
// Hand-written part of the server logic file. build.js appends it after the
// rule code copied from conversion/js/rules.js. Everything here runs only on
// the Power Pages server, where the platform provides the global `Server`.
//
// Endpoint: /_api/serverlogics/nb-permit-rules
//   GET  ?category=&expectedAttendance=&isRegisteredNonProfit=&isLateException=
//        Fee quote (F1-F5). Same as POST operation "fee".
//   POST { "operation": "eligibility", "input": {...} }      E1-E3
//   POST { "operation": "fee", "input": {...} }              F1-F5
//   POST { "operation": "transition", "input": {from, to} }  S1
//   POST { "operation": "recalculateFee", "input": {applicationId} }
//        Reads the application from Dataverse, recalculates the fee and
//        writes it back. The client never supplies the fee or the inputs.
//
// Every function returns a string (JSON.stringify), as the platform expects.

// Assumed Dataverse names for the lab's permit table. They are not created
// yet; change them here when the table exists.
var NB_CONFIG = {
  applicationEntitySet: 'nb_permitapplications',
  columns: {
    category: 'nb_eventcategory',
    expectedAttendance: 'nb_expectedattendance',
    isRegisteredNonProfit: 'nb_isregisterednonprofit',
    isLateException: 'nb_islateexception',
    fee: 'nb_feeamount'
  },
  // Web role name -> role used by S1 (canTransition).
  webRoles: {
    'Northbank Applicant': 'Applicant',
    'Northbank Reviewer': 'Reviewer',
    'Northbank Admin': 'Admin'
  }
};

function has(obj, key) {
  return obj !== null && obj !== undefined && obj[key] !== undefined && obj[key] !== null;
}

// Run fn and turn a rule error (err.code) into {error: code}.
function guarded(fn) {
  try {
    return fn();
  } catch (e) {
    if (e && e.code) { return { error: e.code }; }
    throw e;
  }
}

// Connector results come back as a JSON string envelope with the record in
// a JSON string "Body" (see the Learn CRUD sample). Parse both levels.
function parseConnectorResult(raw) {
  var outer = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (outer && typeof outer.Body === 'string') {
    return outer.Body === '' ? {} : JSON.parse(outer.Body);
  }
  return outer;
}

// E1-E3. Each check runs only when its inputs are present, so a form can
// ask for one check while it is still being filled in. Missing -> null.
function evaluateEligibility(input) {
  var r = { E1: null, E2: null, E3: null };
  if (has(input, 'dateOfBirth') && has(input, 'eventDate')) {
    r.E1 = isApplicantOldEnough(input.dateOfBirth, input.eventDate);
  }
  if (input && 'registryNumber' in input) {
    r.E2 = isRegistryNumberValid(input.registryNumber);
  }
  if (has(input, 'applicantType') && has(input, 'expectedAttendance')) {
    r.E3 = isApplicantTypeAllowed(input.applicantType, input.expectedAttendance);
  }
  r.eligible = r.E1 !== false && r.E2 !== false && r.E3 !== false;
  return r;
}

// F1-F5. baseFee needs category, surcharge needs attendance, fee needs both
// (plus the two flags, which default to false).
function evaluateFee(input) {
  var r = { baseFee: null, surcharge: null, fee: null };
  if (has(input, 'category')) {
    r.baseFee = guarded(function () { return getBaseFee(input.category); });
  }
  if (has(input, 'expectedAttendance')) {
    r.surcharge = guarded(function () { return getAttendanceSurcharge(input.expectedAttendance); });
  }
  if (has(input, 'category') && has(input, 'expectedAttendance')) {
    r.fee = guarded(function () {
      return calculateFee(input.category, input.expectedAttendance,
        input.isRegisteredNonProfit === true, input.isLateException === true);
    });
  }
  return r;
}

// Roles of the signed-in user, looked up on the server. The client cannot
// supply them.
// UNVERIFIED (needs a live site): Learn documents Server.User only with
// `fullname`; `contactid` is assumed. Reading the contact's web roles needs
// a table permission that allows it.
function getCallerRoles() {
  var user = Server.User;
  if (!user || !user.contactid) { return []; }
  var raw = Server.Connector.Dataverse.RetrieveRecord('contacts', user.contactid,
    '$select=contactid&$expand=powerpagecomponent_mspp_webrole_contact($select=name)');
  var contact = parseConnectorResult(raw);
  var links = contact.powerpagecomponent_mspp_webrole_contact || [];
  var roles = [];
  for (var i = 0; i < links.length; i++) {
    var mapped = NB_CONFIG.webRoles[links[i].name];
    if (mapped && roles.indexOf(mapped) < 0) { roles.push(mapped); }
  }
  return roles;
}

// S1. Allowed if any of the caller's roles allows the transition. Any
// "role" in the request is ignored.
function evaluateTransition(input) {
  var roles = getCallerRoles();
  var allowed = false;
  for (var i = 0; i < roles.length; i++) {
    if (canTransition(input.from, input.to, roles[i])) { allowed = true; }
  }
  return { allowed: allowed, roles: roles };
}

// Trusted fee: read the stored inputs, calculate, write the fee back.
function recalculateFee(input) {
  if (!has(input, 'applicationId')) { return { error: 'missing_application_id' }; }
  var c = NB_CONFIG.columns;
  var select = [c.category, c.expectedAttendance, c.isRegisteredNonProfit, c.isLateException].join(',');
  var app = parseConnectorResult(Server.Connector.Dataverse.RetrieveRecord(
    NB_CONFIG.applicationEntitySet, input.applicationId, '$select=' + select));
  var fee = guarded(function () {
    return calculateFee(app[c.category], app[c.expectedAttendance],
      app[c.isRegisteredNonProfit] === true, app[c.isLateException] === true);
  });
  if (fee && fee.error) { return fee; }
  var payload = {};
  payload[c.fee] = fee;
  Server.Connector.Dataverse.UpdateRecord(NB_CONFIG.applicationEntitySet, input.applicationId,
    JSON.stringify(payload));
  return { applicationId: input.applicationId, fee: fee };
}

function dispatch(operation, input) {
  switch (operation) {
    case 'eligibility': return evaluateEligibility(input || {});
    case 'fee': return evaluateFee(input || {});
    case 'transition': return evaluateTransition(input || {});
    case 'recalculateFee': return recalculateFee(input || {});
    default: return { error: 'unknown_operation' };
  }
}

// Query string values arrive as strings.
function feeInputFromQuery(q) {
  var input = {};
  if (has(q, 'category')) { input.category = String(q.category); }
  if (has(q, 'expectedAttendance')) { input.expectedAttendance = Number(q.expectedAttendance); }
  input.isRegisteredNonProfit = String(q.isRegisteredNonProfit) === 'true';
  input.isLateException = String(q.isLateException) === 'true';
  return input;
}

function get() {
  try {
    Server.Logger.Log('nb-permit-rules GET');
    return JSON.stringify(evaluateFee(feeInputFromQuery(Server.Context.QueryParameters || {})));
  } catch (err) {
    Server.Logger.Error('nb-permit-rules GET failed: ' + err.message);
    return JSON.stringify({ error: 'server_error' });
  }
}

function post() {
  try {
    Server.Logger.Log('nb-permit-rules POST');
    var body = JSON.parse(Server.Context.Body || '{}');
    return JSON.stringify(dispatch(body.operation, body.input));
  } catch (err) {
    Server.Logger.Error('nb-permit-rules POST failed: ' + err.message);
    return JSON.stringify({ error: 'server_error' });
  }
}
