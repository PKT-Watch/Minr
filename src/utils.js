
exports.unitsToPkt = (units) => {
	return units/1024/1024/1024;
}

exports.numberWithCommas = (value) => {
    if (typeof value !== 'number') { value = parseFloat(value) };

    return value.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

exports.deepCloneObject = (obj) => {
    return JSON.parse(JSON.stringify(obj));
}