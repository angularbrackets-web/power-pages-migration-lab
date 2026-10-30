/*
 * Northbank.Permits.Rules ported to plain JavaScript.
 * UMD-style: works in a browser (global NorthbankRules) and as a Node
 * module. The server logic copy is generated from the marked regions below.
 *
 * Source of truth: legacy-logic/src/Northbank.Permits.Rules (C#).
 * Rule IDs in comments match the C# library and the shared test vectors.
 *
 * Dates are ISO strings ("2027-07-01" or "2027-07-01T09:00") and are handled
 * as plain calendar values in UTC, so the result does not depend on the
 * time zone of the browser or server. Money is computed in integer cents.
 *
 * The code between "// <shared>" and "// </shared>" markers is copied
 * verbatim into the Power Pages server logic file by
 * conversion/server-logic/build.js. Keep those regions free of Node or
 * browser APIs. See conversion/server-logic/README.md.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NorthbankRules = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // <shared>
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

  // </shared>

  // NAIVE version, kept only to document the parity finding. Do not use.
  // It does the same F1-F5 steps with floating point dollars and rounds with
  // Math.round(x * 100) / 100. A half-cent total such as 150.075 is not exactly
  // representable: 150.075 * 100 evaluates to 15007.499999999998, so Math.round
  // gives 15007 and the fee is 150.07. C# decimal holds 150.075 exactly and
  // rounds it to 150.08. Whether a half-cent fails depends on the binary
  // representation, so 75.075 happens to work and 150.075 does not.
  function calculateFeeNaive(category, expectedAttendance, isRegisteredNonProfit, isLateException) {
    var base = getBaseFeeCents(category) / 100;
    var total = (isRegisteredNonProfit ? base * 0.5 : base) + getAttendanceSurchargeCents(expectedAttendance) / 100;
    if (isLateException) { total += 75; }
    total = Math.round(total * 100) / 100;
    return total < 25 ? 25 : total;
  }

  // <shared>
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

  // </shared>

  // ---- vector runner (shared by the tests and the parity report) ---------

  // Run one shared test vector. Returns the actual value, or {error: code}.
  function runVector(c, useNaive) {
    var i = c.input;
    try {
      switch (c.rule) {
        case 'E1': return isApplicantOldEnough(i.dateOfBirth, i.eventDate);
        case 'E2': return isRegistryNumberValid(i.registryNumber);
        case 'E3': return isApplicantTypeAllowed(i.applicantType, i.expectedAttendance);
        case 'V1': return isSubmittedInTime(i.submissionDate, i.eventStart, i.expectedAttendance);
        case 'V2': return isEventDurationValid(i.eventStart, i.eventEnd);
        case 'V3': return isLiquorLicenceProvided(i.alcoholServed, i.liquorLicenceNumber);
        case 'V4': return 'phone' in i ? normalizePhone(i.phone) : normalizePostalCode(i.postalCode);
        case 'F1': return getBaseFee(i.category);
        case 'F2': return getAttendanceSurcharge(i.expectedAttendance);
        case 'S1': return canTransition(i.from, i.to, i.role);
        default: // F3, F4, F5
          return (useNaive ? calculateFeeNaive : calculateFee)(
            i.category, i.expectedAttendance, i.isRegisteredNonProfit, i.isLateException);
      }
    } catch (e) {
      if (e && e.code) { return { error: e.code }; }
      throw e;
    }
  }

  return {
    isApplicantOldEnough: isApplicantOldEnough,
    isRegistryNumberValid: isRegistryNumberValid,
    isApplicantTypeAllowed: isApplicantTypeAllowed,
    getMinimumLeadDays: getMinimumLeadDays,
    isSubmittedInTime: isSubmittedInTime,
    isEventDurationValid: isEventDurationValid,
    isLiquorLicenceProvided: isLiquorLicenceProvided,
    normalizePhone: normalizePhone,
    normalizePostalCode: normalizePostalCode,
    getBaseFee: getBaseFee,
    getAttendanceSurcharge: getAttendanceSurcharge,
    calculateFee: calculateFee,
    calculateFeeCents: calculateFeeCents,
    calculateFeeNaive: calculateFeeNaive,
    canTransition: canTransition,
    runVector: runVector
  };
}));
