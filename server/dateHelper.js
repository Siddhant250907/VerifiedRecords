/**
 * Date & Time Utility for MongoDB Persistence
 * 
 * Ensures that timestamps saved in MongoDB (createdAt, lastLoginAt, issuedAt, etc.)
 * accurately capture and reflect the real-world event timestamp according to the
 * local wall-clock time (e.g., India Standard Time / system timezone), preventing
 * dates from being shifted backwards by UTC offset when inspected in MongoDB Compass
 * or queried directly.
 */

function getLocalDateTime() {
    const now = new Date();
    // getTimezoneOffset() returns difference in minutes between UTC and local time.
    // E.g., for IST (UTC+5:30), getTimezoneOffset() returns -330.
    let offsetMinutes = now.getTimezoneOffset();

    // Support server deployments or containers where local system timezone might be UTC (offset 0)
    if (offsetMinutes === 0) {
        if (process.env.TIMEZONE_OFFSET) {
            offsetMinutes = -Number(process.env.TIMEZONE_OFFSET);
        } else if (process.env.TZ === "Asia/Kolkata" || process.env.TZ === "Asia/Calcutta") {
            offsetMinutes = -330;
        }
    }

    return new Date(now.getTime() - (offsetMinutes * 60 * 1000));
}

module.exports = {
    getLocalDateTime
};
