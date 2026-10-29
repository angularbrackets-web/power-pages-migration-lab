using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Xunit;

namespace Northbank.Permits.Rules.Tests
{
    /// <summary>Runs every shared JSON vector against the C# rules.</summary>
    public class RuleVectorTests
    {
        public static IEnumerable<object[]> EligibilityIds() { return VectorFile.Ids("eligibility.json"); }
        public static IEnumerable<object[]> ValidationIds() { return VectorFile.Ids("validation.json"); }
        public static IEnumerable<object[]> FeeIds() { return VectorFile.Ids("fees.json"); }
        public static IEnumerable<object[]> StatusIds() { return VectorFile.Ids("status.json"); }

        [Theory]
        [MemberData(nameof(EligibilityIds))]
        public void Eligibility(string id)
        {
            VectorCase c = VectorFile.Find("eligibility.json", id);
            JsonElement i = c.Input;
            bool actual;
            switch (c.Rule)
            {
                case "E1":
                    actual = EligibilityRules.IsApplicantOldEnough(i.Date("dateOfBirth"), i.Date("eventDate"));
                    break;
                case "E2":
                    actual = EligibilityRules.IsRegistryNumberValid(i.Str("registryNumber"));
                    break;
                case "E3":
                    actual = EligibilityRules.IsApplicantTypeAllowed(
                        i.Enum<ApplicantType>("applicantType"), i.GetProperty("expectedAttendance").GetInt32());
                    break;
                default:
                    throw new InvalidOperationException("Unhandled rule " + c.Rule);
            }

            Assert.True(c.Expected.GetBoolean() == actual, id + ": " + c.Note);
        }

        [Theory]
        [MemberData(nameof(ValidationIds))]
        public void Validation(string id)
        {
            VectorCase c = VectorFile.Find("validation.json", id);
            JsonElement i = c.Input;
            switch (c.Rule)
            {
                case "V1":
                    Assert.Equal(c.Expected.GetBoolean(), ValidationRules.IsSubmittedInTime(
                        i.Date("submissionDate"), i.Date("eventStart"), i.GetProperty("expectedAttendance").GetInt32()));
                    break;
                case "V2":
                    Assert.Equal(c.Expected.GetBoolean(),
                        ValidationRules.IsEventDurationValid(i.Date("eventStart"), i.Date("eventEnd")));
                    break;
                case "V3":
                    Assert.Equal(c.Expected.GetBoolean(), ValidationRules.IsLiquorLicenceProvided(
                        i.GetProperty("alcoholServed").GetBoolean(), i.Str("liquorLicenceNumber")));
                    break;
                case "V4":
                    string actual = i.TryGetProperty("phone", out _)
                        ? ValidationRules.NormalizePhone(i.Str("phone"))
                        : ValidationRules.NormalizePostalCode(i.Str("postalCode"));
                    string expected = c.Expected.ValueKind == JsonValueKind.Null ? null : c.Expected.GetString();
                    Assert.Equal(expected, actual);
                    break;
                default:
                    throw new InvalidOperationException("Unhandled rule " + c.Rule);
            }
        }

        [Theory]
        [MemberData(nameof(FeeIds))]
        public void Fees(string id)
        {
            VectorCase c = VectorFile.Find("fees.json", id);
            JsonElement i = c.Input;
            string error = null;
            decimal? actual = null;

            try
            {
                switch (c.Rule)
                {
                    case "F1":
                        actual = FeeCalculator.GetBaseFee(ParseCategory(i.Str("category")));
                        break;
                    case "F2":
                        actual = FeeCalculator.GetAttendanceSurcharge(i.GetProperty("expectedAttendance").GetInt32());
                        break;
                    default:
                        actual = FeeCalculator.Calculate(
                            ParseCategory(i.Str("category")),
                            i.GetProperty("expectedAttendance").GetInt32(),
                            i.GetProperty("isRegisteredNonProfit").GetBoolean(),
                            i.GetProperty("isLateException").GetBoolean());
                        break;
                }
            }
            catch (ArgumentOutOfRangeException)
            {
                error = "invalid_attendance";
            }
            catch (ArgumentException)
            {
                error = "invalid_category";
            }

            if (c.Expected.ValueKind == JsonValueKind.Object)
            {
                Assert.Equal(c.Expected.GetProperty("error").GetString(), error);
            }
            else
            {
                Assert.Null(error);
                Assert.Equal(c.Expected.GetDecimal(), actual.Value);
            }
        }

        [Theory]
        [MemberData(nameof(StatusIds))]
        public void Status(string id)
        {
            VectorCase c = VectorFile.Find("status.json", id);
            bool actual = StatusRules.CanTransition(
                c.Input.Enum<PermitStatus>("from"), c.Input.Enum<PermitStatus>("to"), c.Input.Enum<UserRole>("role"));
            Assert.Equal(c.Expected.GetBoolean(), actual);
        }

        [Fact]
        public void VectorSetIsWellFormed()
        {
            List<VectorCase> all = VectorFile.LoadAll();
            Assert.InRange(all.Count, 40, 80);
            Assert.Equal(all.Count, all.Select(c => c.Id).Distinct().Count());

            string[] rules = { "E1", "E2", "E3", "V1", "V2", "V3", "V4", "F1", "F2", "F3", "F4", "F5", "S1" };
            foreach (string rule in rules)
            {
                Assert.Contains(all, c => c.Rule == rule);
            }
        }

        // An unknown or numeric category name is treated the same as an undefined enum value.
        private static EventCategory ParseCategory(string name)
        {
            if (!Enum.GetNames(typeof(EventCategory)).Contains(name))
            {
                return (EventCategory)(-1);
            }

            return Enum.Parse<EventCategory>(name);
        }
    }
}
