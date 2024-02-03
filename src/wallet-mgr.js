const utils = require('./utils');

const apiBase = 'https://explorer.pkt.cash/api/v1/PKT/pkt/';

exports.getAddress = (addr) => {
    if (!addr) addr = DEFAULT_PAYMENT_ADDRESS;
    
    return fetch(`${apiBase}address/${addr}`)
    .then(res => res.json())
    .then(data => {
        return data;
    })
    .catch((error) => {
        return Promise.reject(error);
    });
}

exports.getBalance = (addr, formatted) => {
    if (!addr) addr = DEFAULT_PAYMENT_ADDRESS;

    return this.getAddress(addr)
    .then(data => {
        return (formatted ? utils.numberWithCommas(utils.unitsToPkt(data.balance)) : utils.unitsToPkt(data.balance));
    })
    .catch((error) => {
        return Promise.reject(error);
    });
}

exports.getIncome = (addr) => {
    if (!addr) addr = DEFAULT_PAYMENT_ADDRESS;

    return fetch(`${apiBase}address/${addr}/income/?mining=only`)
    .then(res => res.json())
    .then(data => {
        return filterMiningIncome(data.results.reverse()).reverse();
    })
    .catch((error) => {
        return Promise.reject(error);
    });
}

function filterMiningIncome(data) {
    // Determine mining start date
    let startIndex = 0;
    for (let i = 0; i < data.length; i++) {
        if (data[i].received > 0) {
            startIndex = i;
            break;
        }
    }

    data.splice(0, startIndex)

    return data;
}