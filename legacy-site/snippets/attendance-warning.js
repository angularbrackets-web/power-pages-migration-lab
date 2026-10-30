/*
 * Custom JavaScript for step 1 of the "Northbank Permit Application"
 * multistep form (paste into the step's Custom JavaScript field, without
 * <script> tags).
 *
 * Deliberately written in the old portal style to give the CSS/JS refactor
 * something to work on: jQuery document-ready, ES5, element ids copied from
 * column logical names, inline styles set from script, Bootstrap 3 era
 * colours. It is UX only. The real lead-time rule (V1) must also be checked
 * on the server.
 *
 * Rule V1: events with more than 250 attendees must be submitted at least
 * 45 days before the event (21 days otherwise).
 */
$(document).ready(function () {
    var $attendance = $('#nb_expectedattendance');
    if ($attendance.length === 0) {
        return;
    }

    var $warning = $('<div id="nb-leadtime-warning" style="display:none; ' +
        'background-color:#fcf8e3; border:1px solid #faebcc; color:#8a6d3b; ' +
        'padding:8px 12px; margin-top:6px; font-weight:bold;"></div>');
    $attendance.after($warning);

    function checkAttendance() {
        var count = parseInt($attendance.val(), 10);
        if (!isNaN(count) && count > 250) {
            $warning.text('Events with more than 250 people must apply at least 45 days before the event.').show();
            $attendance.css({ 'border-color': '#a94442', 'background-color': '#f2dede' });
        } else {
            $warning.hide();
            $attendance.css({ 'border-color': '', 'background-color': '' });
        }
    }

    $attendance.on('change keyup', checkAttendance);
    checkAttendance();
});
