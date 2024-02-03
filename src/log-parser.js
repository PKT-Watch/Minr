function parseLogs(str) {
    if (!str) return;

    var encryptionsRe = /(?:\:\d{3} )(.*?)(?= [KMGTPEZY]e\/s)/g
    var encryptions = [];

    while (null != (z = encryptionsRe.exec(str))) {
        encryptions.push(z[1]);
    }

    var encryptionsUnitsRe = /\d* ([KMGTPEZY]e\/s)/g
    let encryptionsUnits = [];

    while (null != (z = encryptionsUnitsRe.exec(str))) {
        encryptionsUnits.push(z[1]);
    }

    var uploadRe = /(?:\ {2,})(.*?)(?=[KMGTPEZY]b\/s)/g
    var upload = [];

    while (null != (z = uploadRe.exec(str))) {
        upload.push(parseFloat(z[1]));
    }

    var uploadUnitsRe = /\d*([KMGTPEZY]b\/s)/g
    let uploadUnits = [];

    while (null != (z = uploadUnitsRe.exec(str))) {
        uploadUnits.push(z[1]);
    }      

    var goodrateRe = /(?:goodrate\:)(?: \[)(.*?)(?:\])/g;
    var goodrate = goodrateRe.exec(str);
    var poolCount = 1;
    if (goodrate) {
        goodrate = goodrate[1].split(', ');

        for (let i = 0; i < goodrate.length; i++) {
            goodrate[i] = parseInt(goodrate[i].slice(0, -1)); // trim "%""
        }
        poolCount = goodrate.length
    } else {
        // ## Couldn't find goodrate array
        goodrate = [];
    }

    if (encryptions) {
        for (let i = 0; i < encryptions.length; i++) {
            let eps = parseFloat(encryptions[i]);
            let units = encryptionsUnits[i];

            switch (units) {
                case 'e/s':
                    eps = eps;
                    break;
                case 'Ke/s':
                    break;
                case 'Me/s':
                    eps = eps * 1000;
                    break;
                case 'Ge/s':
                    eps = eps * 1000 * 1000;
                    break;
                case 'Te/s':
                    eps = eps * 1000 * 1000 * 1000;
                    break;
                default:
                    //
            }

            encryptions[i] = eps;
        }
    }

    let errors = [];

    if (encryptions.length === 0) {
        errors.push("Can't parse encryption per second. (eg. 834 Ke/s)");
    }
    if (encryptionsUnits.length === 0) {
        errors.push("Can't parse encryption units. (eg. Ke/s)");
    }
    if (upload.length === 0) {
        errors.push("Can't parse bandwidth per second. (eg. 12 Mb/s)");
    }
    if (uploadUnits.length === 0) {
        errors.push("Can't parse bandwidth units.  (eg. Mb/s)");
    }

    if (!errors.length) {
        return {
            encryptions: encryptions,
            encryptionsUnits: encryptionsUnits,
            upload: upload,
            uploadUnits: uploadUnits,
            goodrate: goodrate,
            poolCount: poolCount
        }
    }
    
}