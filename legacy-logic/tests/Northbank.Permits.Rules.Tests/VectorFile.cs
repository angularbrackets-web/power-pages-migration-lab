using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace Northbank.Permits.Rules.Tests
{
    /// <summary>One shared test case from legacy-logic/test-vectors.</summary>
    public sealed class VectorCase
    {
        public string Id { get; set; }
        public string Rule { get; set; }
        public JsonElement Input { get; set; }
        public JsonElement Expected { get; set; }
        public string Note { get; set; }
    }

    /// <summary>Loads the shared JSON vector files copied next to the test assembly.</summary>
    public static class VectorFile
    {
        private static readonly string[] FileNames =
            { "eligibility.json", "validation.json", "fees.json", "status.json" };

        public static List<VectorCase> Load(string fileName)
        {
            string path = Path.Combine(AppContext.BaseDirectory, "test-vectors", fileName);
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            return JsonSerializer.Deserialize<List<VectorCase>>(File.ReadAllText(path), options);
        }

        public static List<VectorCase> LoadAll()
        {
            return FileNames.SelectMany(Load).ToList();
        }

        /// <summary>Data for xUnit MemberData: one row per case id.</summary>
        public static IEnumerable<object[]> Ids(string fileName)
        {
            return Load(fileName).Select(c => new object[] { c.Id });
        }

        public static VectorCase Find(string fileName, string id)
        {
            return Load(fileName).Single(c => c.Id == id);
        }

        public static string Str(this JsonElement e, string name)
        {
            JsonElement v = e.GetProperty(name);
            return v.ValueKind == JsonValueKind.Null ? null : v.GetString();
        }

        public static DateTime Date(this JsonElement e, string name)
        {
            string s = e.GetProperty(name).GetString();
            string[] formats = { "yyyy-MM-dd", "yyyy-MM-ddTHH:mm" };
            return DateTime.ParseExact(s, formats, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None);
        }

        public static T Enum<T>(this JsonElement e, string name) where T : struct
        {
            return System.Enum.Parse<T>(e.GetProperty(name).GetString());
        }
    }
}
