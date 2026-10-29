using System;
using System.Text.RegularExpressions;

namespace Northbank.Permits.Rules
{
    /// <summary>
    /// Eligibility rules E1 to E3: who is allowed to apply for what.
    /// </summary>
    public static class EligibilityRules
    {
        private const int MinimumAge = 18;
        private const int LargeEventAttendance = 500;

        private static readonly Regex RegistryNumberPattern =
            new Regex(@"\ANB-[0-9]{6}\z", RegexOptions.CultureInvariant);

        /// <summary>
        /// Rule E1: the applicant must be 18 or older on the event date.
        /// A birthday that falls on the event date counts as already 18.
        /// A person born on 29 February turns 18 on 28 February in a non-leap year.
        /// </summary>
        /// <param name="dateOfBirth">Applicant date of birth.</param>
        /// <param name="eventDate">Date of the event (start date).</param>
        /// <returns>True when the applicant is old enough.</returns>
        public static bool IsApplicantOldEnough(DateTime dateOfBirth, DateTime eventDate)
        {
            DateTime dob = dateOfBirth.Date;
            DateTime onDate = eventDate.Date;

            int age = onDate.Year - dob.Year;
            if (dob.AddYears(age) > onDate)
            {
                age--;
            }

            return age >= MinimumAge;
        }

        /// <summary>
        /// Rule E2: an organization registry number must be "NB-" followed by exactly six digits.
        /// </summary>
        /// <param name="registryNumber">Registry number as entered.</param>
        /// <returns>True when the format is valid. Null or blank is invalid.</returns>
        public static bool IsRegistryNumberValid(string registryNumber)
        {
            if (registryNumber == null)
            {
                return false;
            }

            return RegistryNumberPattern.IsMatch(registryNumber);
        }

        /// <summary>
        /// Rule E3: events with more than 500 expected attendees need an organization applicant.
        /// Exactly 500 is still open to individuals.
        /// </summary>
        /// <param name="applicantType">Type of applicant.</param>
        /// <param name="expectedAttendance">Expected number of attendees.</param>
        /// <returns>True when this applicant type may apply for an event of this size.</returns>
        public static bool IsApplicantTypeAllowed(ApplicantType applicantType, int expectedAttendance)
        {
            if (expectedAttendance > LargeEventAttendance)
            {
                return applicantType == ApplicantType.Organization;
            }

            return true;
        }
    }
}
