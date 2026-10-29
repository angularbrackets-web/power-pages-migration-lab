using System;
using System.Text;
using System.Text.RegularExpressions;

namespace Northbank.Permits.Rules
{
    /// <summary>
    /// Validation rules V1 to V4: dates, licences and contact details.
    /// </summary>
    public static class ValidationRules
    {
        private const int StandardLeadDays = 21;
        private const int LargeEventLeadDays = 45;
        private const int LargeEventThreshold = 250;
        private const int MaxEventDays = 3;

        // Canadian postal codes never use D, F, I, O, Q or U. W and Z are not used as the first letter.
        private static readonly Regex PostalCodePattern =
            new Regex(@"\A[ABCEGHJKLMNPRSTVXY][0-9][ABCEGHJKLMNPRSTVWXYZ][0-9][ABCEGHJKLMNPRSTVWXYZ][0-9]\z",
                RegexOptions.CultureInvariant);

        /// <summary>
        /// Rule V1 (part 1): minimum number of days between submission and event start.
        /// 21 days, or 45 days when more than 250 attendees are expected.
        /// </summary>
        /// <param name="expectedAttendance">Expected number of attendees.</param>
        /// <returns>Minimum lead time in days.</returns>
        public static int GetMinimumLeadDays(int expectedAttendance)
        {
            return expectedAttendance > LargeEventThreshold ? LargeEventLeadDays : StandardLeadDays;
        }

        /// <summary>
        /// Rule V1 (part 2): the application must be submitted early enough.
        /// Compares calendar dates; the time of day is ignored. Exactly the minimum number of days is accepted.
        /// </summary>
        /// <param name="submissionDate">Date the application is submitted.</param>
        /// <param name="eventStart">Start of the event.</param>
        /// <param name="expectedAttendance">Expected number of attendees.</param>
        /// <returns>True when the lead time is long enough.</returns>
        public static bool IsSubmittedInTime(DateTime submissionDate, DateTime eventStart, int expectedAttendance)
        {
            int leadDays = (eventStart.Date - submissionDate.Date).Days;
            return leadDays >= GetMinimumLeadDays(expectedAttendance);
        }

        /// <summary>
        /// Rule V2: the event must end after it starts and may span at most 3 consecutive calendar days.
        /// </summary>
        /// <param name="eventStart">Start date and time.</param>
        /// <param name="eventEnd">End date and time.</param>
        /// <returns>True when the duration is valid.</returns>
        public static bool IsEventDurationValid(DateTime eventStart, DateTime eventEnd)
        {
            if (eventEnd <= eventStart)
            {
                return false;
            }

            int calendarDays = (eventEnd.Date - eventStart.Date).Days + 1;
            return calendarDays <= MaxEventDays;
        }

        /// <summary>
        /// Rule V3: when alcohol is served a liquor licence number is required.
        /// </summary>
        /// <param name="alcoholServed">True when alcohol will be served.</param>
        /// <param name="liquorLicenceNumber">Licence number as entered. May be null.</param>
        /// <returns>True when the combination is acceptable.</returns>
        public static bool IsLiquorLicenceProvided(bool alcoholServed, string liquorLicenceNumber)
        {
            if (!alcoholServed)
            {
                return true;
            }

            return !string.IsNullOrWhiteSpace(liquorLicenceNumber);
        }

        /// <summary>
        /// Rule V4 (part 1): normalise a North American phone number to "(xxx) xxx-xxxx".
        /// Non-digits are ignored and a leading country code 1 is dropped.
        /// The area code may not start with 0 or 1.
        /// </summary>
        /// <param name="phone">Phone number as entered.</param>
        /// <returns>The formatted number, or null when it is not a valid 10-digit number.</returns>
        public static string NormalizePhone(string phone)
        {
            if (phone == null)
            {
                return null;
            }

            StringBuilder digits = new StringBuilder();
            foreach (char c in phone)
            {
                if (c >= '0' && c <= '9')
                {
                    digits.Append(c);
                }
            }

            string d = digits.ToString();
            if (d.Length == 11 && d[0] == '1')
            {
                d = d.Substring(1);
            }

            if (d.Length != 10 || d[0] == '0' || d[0] == '1')
            {
                return null;
            }

            return "(" + d.Substring(0, 3) + ") " + d.Substring(3, 3) + "-" + d.Substring(6, 4);
        }

        /// <summary>
        /// Rule V4 (part 2): normalise a Canadian postal code to "A1A 1A1".
        /// Case and spacing are ignored.
        /// </summary>
        /// <param name="postalCode">Postal code as entered.</param>
        /// <returns>The formatted code, or null when it is not valid.</returns>
        public static string NormalizePostalCode(string postalCode)
        {
            if (postalCode == null)
            {
                return null;
            }

            string compact = postalCode.Replace(" ", string.Empty).ToUpperInvariant();
            if (!PostalCodePattern.IsMatch(compact))
            {
                return null;
            }

            return compact.Substring(0, 3) + " " + compact.Substring(3, 3);
        }
    }
}
