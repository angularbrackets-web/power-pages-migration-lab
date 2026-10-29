using System;

namespace Northbank.Permits.Rules
{
    /// <summary>
    /// Fee rules F1 to F5. All money values are <see cref="decimal"/>.
    /// </summary>
    public static class FeeCalculator
    {
        private const decimal NonProfitBaseFeeFactor = 0.5m;
        private const decimal LateApplicationFee = 75.00m;
        private const decimal MinimumFee = 25.00m;

        /// <summary>
        /// Rule F1: base fee by event category (fee table).
        /// Community 45.50, Commercial 425.50, Sports 150.15.
        /// </summary>
        /// <param name="category">Event category.</param>
        /// <returns>Base fee in dollars.</returns>
        /// <exception cref="ArgumentException">The category is not a defined value.</exception>
        public static decimal GetBaseFee(EventCategory category)
        {
            switch (category)
            {
                case EventCategory.Community:
                    return 45.50m;
                case EventCategory.Commercial:
                    return 425.50m;
                case EventCategory.Sports:
                    return 150.15m;
                default:
                    throw new ArgumentException("Unknown event category.", "category");
            }
        }

        /// <summary>
        /// Rule F2: attendance tier surcharge.
        /// 0-100: 0, 101-250: 50, 251-500: 150, 501 and above: 400.
        /// </summary>
        /// <param name="expectedAttendance">Expected number of attendees. Must not be negative.</param>
        /// <returns>Surcharge in dollars.</returns>
        /// <exception cref="ArgumentOutOfRangeException">Attendance is negative.</exception>
        public static decimal GetAttendanceSurcharge(int expectedAttendance)
        {
            if (expectedAttendance < 0)
            {
                throw new ArgumentOutOfRangeException("expectedAttendance", "Attendance cannot be negative.");
            }

            if (expectedAttendance <= 100)
            {
                return 0m;
            }

            if (expectedAttendance <= 250)
            {
                return 50m;
            }

            if (expectedAttendance <= 500)
            {
                return 150m;
            }

            return 400m;
        }

        /// <summary>
        /// Rules F1 to F5 combined.
        /// F3: a registered non-profit pays 50% of the base fee (surcharges are not discounted).
        /// F4: an application approved by exception inside the V1 window adds a flat 75.00.
        /// F5: the total is rounded half-up (away from zero) to cents, and is never below 25.00.
        /// Rounding happens once, on the final total.
        /// </summary>
        /// <param name="category">Event category.</param>
        /// <param name="expectedAttendance">Expected number of attendees.</param>
        /// <param name="isRegisteredNonProfit">True for a registered non-profit applicant.</param>
        /// <param name="isLateException">True when a late application was approved by exception.</param>
        /// <returns>Total fee in dollars, two decimal places.</returns>
        public static decimal Calculate(
            EventCategory category,
            int expectedAttendance,
            bool isRegisteredNonProfit,
            bool isLateException)
        {
            decimal baseFee = GetBaseFee(category);
            decimal surcharge = GetAttendanceSurcharge(expectedAttendance);

            if (isRegisteredNonProfit)
            {
                baseFee = baseFee * NonProfitBaseFeeFactor;
            }

            decimal total = baseFee + surcharge;
            if (isLateException)
            {
                total += LateApplicationFee;
            }

            total = Math.Round(total, 2, MidpointRounding.AwayFromZero);
            if (total < MinimumFee)
            {
                total = MinimumFee;
            }

            return total;
        }
    }
}
