const DEFAULT_APP_TIME_OFFSET_MINUTES = 120;

const getAppTimeOffsetMinutes = () => {
    const configuredOffset = Number(process.env.APP_TIME_OFFSET_MINUTES || process.env.TIME_OFFSET_MINUTES);
    return Number.isFinite(configuredOffset) ? configuredOffset : DEFAULT_APP_TIME_OFFSET_MINUTES;
};

const isDatabaseDateTime = (value) => (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(value)
);

const formatAppDateTime = (value = new Date()) => {
    if (isDatabaseDateTime(value)) {
        return value.replace('T', ' ');
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return formatAppDateTime(new Date());
    }

    const adjustedDate = new Date(date.getTime() + getAppTimeOffsetMinutes() * 60 * 1000);
    return adjustedDate.toISOString().slice(0, 19).replace('T', ' ');
};

module.exports = { formatAppDateTime };