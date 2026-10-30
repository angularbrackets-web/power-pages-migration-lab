// GENERATED FILE. Do not edit.
// Source: conversion/js/rules.js (<shared> regions) + conversion/server-logic/src/handlers.js
// Rebuild: node conversion/server-logic/build.js
// Power Pages server logic: /_api/serverlogics/nb-permit-rules

var MS_PER_DAY = 86400000;

// ---- date helpers ------------------------------------------------------

// Parse "yyyy-MM-dd" or "yyyy-MM-ddTHH:mm" into parts.
function parseIso(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(String(s));
  if (!m) { throw new Error('Bad date: ' + s); }
  return {
    y: +m[1], m: +m[2], d: +m[3],
    h: m[4] ? +m[4] : 0, min: m[5] ? +m[5] : 0
  };
}
function dayNumber(p) { return Math.round(Date.UTC(p.y, p.m - 1, p.d) / MS_PER_DAY); }
function minuteNumber(p) { return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) / 60000; }
function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

// ---- E: eligibility ----------------------------------------------------

// E1: applicant is 18+ on the event date. A 29 Feb birthday counts as
// 28 Feb in a non-leap year (same as DateTime.AddYears in C#).
function isApplicantOldEnough(dateOfBirth, eventDate) {
  var dob = parseIso(dateOfBirth), on = parseIso(eventDate);
  var age = on.y - dob.y;
  var annivY = dob.y + age, annivD = dob.d;
  if (dob.m === 2 && dob.d === 29 && !isLeap(annivY)) { annivD = 28; }
  var anniv = { y: annivY, m: dob.m, d: annivD };
  if (dayNumber(anniv) > dayNumber(on)) { age--; }
  return age >= 18;
}

// E2: registry number is "NB-" + exactly six digits. Null/blank invalid.
function isRegistryNumberValid(registryNumber) {
  if (registryNumber === null || registryNumber === undefined) { return false; }
  return /^NB-[0-9]{6}$/.test(String(registryNumber));
}

// E3: more than 500 attendees requires an Organization applicant.
function isApplicantTypeAllowed(applicantType, expectedAttendance) {
  if (expectedAttendance > 500) { return applicantType === 'Organization'; }
  return true;
}

// ---- V: validation -----------------------------------------------------

// V1 (part 1): 21 days lead time, 45 when more than 250 attendees.
function getMinimumLeadDays(expectedAttendance) {
  return expectedAttendance > 250 ? 45 : 21;
}

// V1 (part 2): calendar dates only, exact minimum accepted.
function isSubmittedInTime(submissionDate, eventStart, expectedAttendance) {
  var lead = dayNumber(parseIso(eventStart)) - dayNumber(parseIso(submissionDate));
  return lead >= getMinimumLeadDays(expectedAttendance);
}

// V2: end after start, at most 3 calendar days.
function isEventDurationValid(eventStart, eventEnd) {
  var s = parseIso(eventStart), e = parseIso(eventEnd);
  if (minuteNumber(e) <= minuteNumber(s)) { return false; }
  return (dayNumber(e) - dayNumber(s) + 1) <= 3;
}

// V3: alcohol served requires a non-blank liquor licence number.
function isLiquorLicenceProvided(alcoholServed, liquorLicenceNumber) {
  if (!alcoholServed) { return true; }
  return liquorLicenceNumber !== null && liquorLicenceNumber !== undefined &&
    String(liquorLicenceNumber).trim() !== '';
}

// V4 (phone): "(xxx) xxx-xxxx" or null. Leading country code 1 dropped,
// area code may not start with 0 or 1.
function normalizePhone(phone) {
  if (phone === null || phone === undefined) { return null; }
  var d = String(phone).replace(/[^0-9]/g, '');
  if (d.length === 11 && d.charAt(0) === '1') { d = d.substring(1); }
  if (d.length !== 10 || d.charAt(0) === '0' || d.charAt(0) === '1') { return null; }
  return '(' + d.substring(0, 3) + ') ' + d.substring(3, 6) + '-' + d.substring(6, 10);
}

// V4 (postal code): "A1A 1A1" or null. Case and spacing ignored.
function normalizePostalCode(postalCode) {
  if (postalCode === null || postalCode === undefined) { return null; }
  var c = String(postalCode).replace(/ /g, '').toUpperCase();
  if (!/^[ABCEGHJKLMNPRSTVXY][0-9][ABCEGHJKLMNPRSTVWXYZ][0-9][ABCEGHJKLMNPRSTVWXYZ][0-9]$/.test(c)) {
    return null;
  }
  return c.substring(0, 3) + ' ' + c.substring(3, 6);
}

// ---- F: fees -----------------------------------------------------------

function ruleError(code, message) {
  var err = new Error(message);
  err.code = code;
  return err;
}

// F1: base fee by category, in integer cents.
function getBaseFeeCents(category) {
  switch (category) {
    case 'Community': return 4550;
    case 'Commercial': return 42550;
    case 'Sports': return 15015;
    default: throw ruleError('invalid_category', 'Unknown event category.');
  }
}

// F2: attendance tier surcharge, in integer cents. Negative is an error.
function getAttendanceSurchargeCents(expectedAttendance) {
  if (expectedAttendance < 0) {
    throw ruleError('invalid_attendance', 'Attendance cannot be negative.');
  }
  if (expectedAttendance <= 100) { return 0; }
  if (expectedAttendance <= 250) { return 5000; }
  if (expectedAttendance <= 500) { return 15000; }
  return 40000;
}

// F1 / F2 in dollars (cents / 100 is the closest double to the 2-dp value).
function getBaseFee(category) { return getBaseFeeCents(category) / 100; }
function getAttendanceSurcharge(expectedAttendance) {
  return getAttendanceSurchargeCents(expectedAttendance) / 100;
}

// F1-F5 combined, returned as integer cents.
// Everything is held in HALF-cents so the F3 halving stays an integer:
// 150.15 / 2 = 75.075 dollars = 15015 half-cents, no fractions anywhere.
//   F3: non-profit base = baseCents (half-cents)  vs  baseCents * 2 otherwise
//   F4: late exception adds 75.00 = 15000 half-cents
//   F5: round half-up to cents = floor((halfCents + 1) / 2), minimum 2500.
function calculateFeeCents(category, expectedAttendance, isRegisteredNonProfit, isLateException) {
  var base = getBaseFeeCents(category);
  var surcharge = getAttendanceSurchargeCents(expectedAttendance);
  var halfCents = (isRegisteredNonProfit ? base : base * 2) + surcharge * 2;
  if (isLateException) { halfCents += 15000; }
  var cents = Math.floor((halfCents + 1) / 2); // F5 half-up (values are never negative)
  if (cents < 2500) { cents = 2500; }          // F5 minimum fee 25.00
  return cents;
}

function calculateFee(category, expectedAttendance, isRegisteredNonProfit, isLateException) {
  return calculateFeeCents(category, expectedAttendance, isRegisteredNonProfit, isLateException) / 100;
}


// ---- S: status ---------------------------------------------------------

// S1: allowed status transitions and which role may make them.
function canTransition(from, to, role) {
  switch (from) {
    case 'Draft': return to === 'Submitted' && role === 'Applicant';
    case 'Submitted': return to === 'UnderReview' && role === 'Reviewer';
    case 'UnderReview':
      return role === 'Reviewer' &&
        (to === 'Approved' || to === 'Rejected' || to === 'MoreInfoNeeded');
    case 'MoreInfoNeeded': return to === 'Submitted' && role === 'Applicant';
    case 'Rejected': return to === 'UnderReview' && role === 'Admin';
    default: return false;
  }
}


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
