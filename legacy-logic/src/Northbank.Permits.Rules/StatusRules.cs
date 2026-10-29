namespace Northbank.Permits.Rules
{
    /// <summary>
    /// Status rule S1: allowed status transitions and who may perform them.
    /// </summary>
    public static class StatusRules
    {
        /// <summary>
        /// Rule S1.
        /// Draft to Submitted: Applicant.
        /// Submitted to UnderReview: Reviewer.
        /// UnderReview to Approved, Rejected or MoreInfoNeeded: Reviewer.
        /// MoreInfoNeeded to Submitted: Applicant (resubmits).
        /// Rejected to UnderReview: Admin only (reopen).
        /// Every other transition is not allowed, including staying in the same status.
        /// </summary>
        /// <param name="from">Current status.</param>
        /// <param name="to">Requested status.</param>
        /// <param name="role">Role of the user making the change.</param>
        /// <returns>True when the transition is allowed.</returns>
        public static bool CanTransition(PermitStatus from, PermitStatus to, UserRole role)
        {
            switch (from)
            {
                case PermitStatus.Draft:
                    return to == PermitStatus.Submitted && role == UserRole.Applicant;

                case PermitStatus.Submitted:
                    return to == PermitStatus.UnderReview && role == UserRole.Reviewer;

                case PermitStatus.UnderReview:
                    return role == UserRole.Reviewer
                        && (to == PermitStatus.Approved
                            || to == PermitStatus.Rejected
                            || to == PermitStatus.MoreInfoNeeded);

                case PermitStatus.MoreInfoNeeded:
                    return to == PermitStatus.Submitted && role == UserRole.Applicant;

                case PermitStatus.Rejected:
                    return to == PermitStatus.UnderReview && role == UserRole.Admin;

                default:
                    return false;
            }
        }
    }
}
