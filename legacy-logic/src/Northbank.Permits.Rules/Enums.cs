namespace Northbank.Permits.Rules
{
    /// <summary>Kind of person or body applying for a permit.</summary>
    public enum ApplicantType
    {
        /// <summary>A private individual.</summary>
        Individual,

        /// <summary>A registered or unregistered organization.</summary>
        Organization
    }

    /// <summary>Event category. Drives the base fee (rule F1).</summary>
    public enum EventCategory
    {
        /// <summary>Community event.</summary>
        Community,

        /// <summary>Commercial event.</summary>
        Commercial,

        /// <summary>Sports event.</summary>
        Sports
    }

    /// <summary>Lifecycle status of a permit application.</summary>
    public enum PermitStatus
    {
        /// <summary>Saved by the applicant, not yet submitted.</summary>
        Draft,

        /// <summary>Submitted and waiting for a reviewer.</summary>
        Submitted,

        /// <summary>A reviewer has picked it up.</summary>
        UnderReview,

        /// <summary>Approved. Final.</summary>
        Approved,

        /// <summary>Rejected. Only an Admin can reopen it.</summary>
        Rejected,

        /// <summary>Reviewer asked the applicant for more information.</summary>
        MoreInfoNeeded
    }

    /// <summary>Portal role of the user performing an action.</summary>
    public enum UserRole
    {
        /// <summary>Citizen or organization member who applies.</summary>
        Applicant,

        /// <summary>Town staff who review applications.</summary>
        Reviewer,

        /// <summary>Portal administrator.</summary>
        Admin
    }
}
