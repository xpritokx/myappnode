const convertDateExcel = (excelTimestamp) => {
    const secondsInDay = 24 * 60 * 60;
    const excelEpoch = new Date(1899, 11, 31);
    const excelEpochAsUnixTimestamp = excelEpoch.getTime();
    const missingLeapYearDay = secondsInDay * 1000;
    const delta = excelEpochAsUnixTimestamp - missingLeapYearDay;
    const excelTimestampAsUnixTimestamp = excelTimestamp * secondsInDay * 1000;
    const parsed = excelTimestampAsUnixTimestamp + delta;
    return isNaN(parsed) ? null : new Date(parsed);
};

module.exports = (arr, fieldsArray) => {
    return arr.map(item => {
        fieldsArray.forEach(field => {
            try {
                let convertedDate = convertDateExcel(item[field]);
        
                item[field] = new Date(convertedDate).toDateString();
            } catch (err) {
                console.log('--DEBUG-- Convert Date Excel something happened with date: ', item[field]);
            }
        });
        
        return item;
    });
};