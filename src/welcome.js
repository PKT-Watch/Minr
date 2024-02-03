const { ipcRenderer, app } = require('electron');
const os = require('os');
const fs = require('fs');
const settingsMgr = require('./settings-mgr');
const DecompressZip = require('decompress-zip');
const commandExists = require('command-exists');
const path = require('path');

const platform = os.platform();

const el = {
    onboardEl: document.querySelector('.onboard'),
    nextOnboardStepButtons: document.querySelectorAll('[data-step]'),
    onboardSteps: document.querySelectorAll('.onboard-step'),
    btnOnboardPacketcryptInstalled_true: document.querySelector('#btnOnboardPacketcryptInstalled_true'),
    btnOnboardPacketcryptInstalled_false: document.querySelector('#btnOnboardPacketcryptInstalled_false'),
    btnOnboardPacketcryptDownload: document.querySelector('#btnOnboardPacketcryptDownload'),
    btnOnboardEnd: document.querySelector('#btnOnboardEnd'),
    btnOnboardSkip: document.querySelector('#btnOnboardSkip'),
    txtOnboardPaymentAddr: document.querySelector('#txtOnboardPaymentAddr'),
    txtOnboardThreads: document.querySelector('#txtOnboardThreads'),
    txtOnboardThreads_Count: document.querySelector('#txtOnboardThreads-Count'),
    poolSelectionList: document.querySelector('#pool-selection-list'),
    onboardPacketcryptInstallInstructions: document.querySelector('#onboard-packetcrypt-install-instructions'),
    onboardPacketcryptCheck: document.querySelector('#onboard-packetcrypt-check'),
    addressValidationError: document.querySelector('#address-validation-error')
};

let preselectedPools = settingsMgr.getSetting('available_pools').filter(function (pool) {
    return pool.preselected === true;
});

let cpuThreadCount;
let activeStep = '#onboard-welcome';
const globalSettings = {
    color_mode: 'system',
    hide_cpu_temp: false,
    packetcrypt_path: '',
    packetcrypt_in_path: false
}
let miningConfig = {
    payment_addr: '',
    threads: 0,
    pools: preselectedPools
};

// let installInstructions = {
//     MacOS: `<p>Once the download is complete, I will try to open the PacketCrypt installer.</p>
//             <p>Please follow the instructions to complete the intallation and press the button below once you have finished...</p>`,
//     Win32: `<p>Once the download is complete, I will try to extract the archive and install PacketCrypt.</p>
//             <p>Please wait...</p>`,
//     Linux: `<p>------</p>
//             <p>Please follow the instructions to complete the intallation and press the button below once you have finished...</p>`
// }

el.nextOnboardStepButtons.forEach(button => {
    button.addEventListener('click', e => {
        navigateToStep(button.dataset.step);
    });
});

function makeVisible(platformName) {
    let hideSelector;
    let showSelector;
    switch (platformName) {
        case 'win32':
            hideSelector = '.visible-macos, .visible-linux';
            showSelector = '.visible-win32';
            break;
        case 'darwin':
            hideSelector = '.visible-win32, .visible-linux';
            showSelector = '.visible-macos';
            break;
        case 'linux':
            hideSelector = '.visible-win32, .visible-macos';
            showSelector = '.visible-linux';
            break;
        default:
            break;
    }

    document.querySelectorAll(hideSelector).forEach(el => {
        el.classList.add('d-none');
    });

    document.querySelectorAll(showSelector).forEach(el => {
        el.classList.remove('d-none');
    });
}
makeVisible(platform);

function navigateToStep(selector) {

    if (!validateStepForm(selector)) {
        console.log(`Invalid step ${selector}`);
        return;
    };

    document.querySelector(activeStep).classList.add('anim-out');

    setTimeout(() => {
        document.querySelector(activeStep).classList.remove('active', 'anim-in', 'anim-out');

        const nextStep = document.querySelector(selector);

        nextStep.classList.add('active');

        setTimeout(() => {
            nextStep.classList.add('anim-in');

            activeStep = selector;
        }, 400);
    }, 400);
};

function validateStepForm(stepName) {
    console.log(stepName);
    switch (stepName) {
        case '#onboard-threads':
            const {valid, error} = validatePktAddress(txtOnboardPaymentAddr.value.trim());

            if (error !== '') {
                let errorMessage = "Hmmm, that address doesn't look correct.";
                switch (error) {
                    case 'length-error':
                        errorMessage = `${errorMessage} Please check it carefully.`;
                        break;
                    case 'metamask-error':
                        errorMessage = `It looks like you might have entered a WPKT address. Please enter a PKT address instead.`;
                        break;
                    case 'format-error':
                        errorMessage = `${errorMessage} Please check it carefully.`;
                        break;
                    default:
                        break;
                }
                el.addressValidationError.textContent = errorMessage;
                el.addressValidationError.classList.add('active');
            }

            return valid;
        default:
            break;
    }

    return true;
}

function validatePktAddress(address) {
    console.log(`validatePktAddress() ${address}`);

    let valid = false;
    let error = '';

    if (address.length === 0) {
        // If no address is entered. Default address will be used
        valid = true;
    } else if (address.substring(0, 4) === 'pkt1') {
        console.log(`${address} is 'pkt1' address with length ${address.length}`);
        if (address.length !== 43 && address.length != 63) {
            error = 'length-error';
        } else {
            valid = true;
        }
    } else if (address.substring(0, 1) === 'p') {
        console.log(`${address} is 'p' address with length ${address.length}`);
        if (address.length !== 34) {
            error = 'length-error';
        } else {
            valid = true;
        }
    } else if (address.substring(0, 2) === '0x') {
        console.log(`${address} is '0x' address`);
        error = 'metamask-error';
    } else {
        console.log(`${address} is unrecognised format`);
        error = 'format-error';
    }

    return {valid, error};
}

ipcRenderer.on('directory-selected', (_, filePath) => {
    if (filePath.length === 0) {
        // Dialog was cancelled
        navigateToStep('#onboard-packetcrypt-check');
        return;
    }

    globalSettings.packetcrypt_path = filePath[0];

    navigateToStep('#onboard-payment-address');
    
});

function requestCPUData() {
    ipcRenderer.send('get-cpu-data');
}
requestCPUData();

ipcRenderer.on('cpu-data', (event,data) => {
    cpuThreadCount = data.cores;

    el.txtOnboardThreads.max = cpuThreadCount;
    el.txtOnboardThreads_Count.innerHTML = cpuThreadCount;
});

el.btnOnboardPacketcryptInstalled_true.addEventListener('click', e => {
    locatePacketcrypt();
});

el.btnOnboardPacketcryptDownload.addEventListener('click', e => {
    installPacketcrypt();
});

el.btnOnboardEnd.addEventListener('click', e => {
    saveAndExit();
});

el.btnOnboardSkip.addEventListener('click', e => {
    saveAndExit();
});

function saveAndExit() {
    miningConfig.config_name = 'Default configuration';
    miningConfig.id = Date.now();
    miningConfig.payment_addr = (el.txtOnboardPaymentAddr.value && el.txtOnboardPaymentAddr.value.trim() ? el.txtOnboardPaymentAddr.value.trim() : 'pkt1q6sj0mchq7ltwm8c9tpm2wteqmeldr2ye5lcr60');
    miningConfig.threads = (el.txtOnboardThreads.value ? parseInt(el.txtOnboardThreads.value) : 0);
    miningConfig.active = true;

    let mining_configs = [];
    mining_configs.push(miningConfig);

    settingsMgr.setSetting('mining_configs', mining_configs);
    settingsMgr.setSetting('color_mode', globalSettings.color_mode);
    settingsMgr.setSetting('packetcrypt_path', globalSettings.packetcrypt_path);
    settingsMgr.setSetting('packetcrypt_in_path', globalSettings.packetcrypt_in_path);
    settingsMgr.setSetting('onboard_complete', true);

    window.location = 'index.html';
}

el.txtOnboardThreads.addEventListener('input', e => {
    const val = parseInt(el.txtOnboardThreads.value);
    if (val < 0) {
        el.txtOnboardThreads.value = cpuThreadCount-1;
    } else if (val === 0 || val >= cpuThreadCount) {
        el.txtOnboardThreads.value = '';
    }
});

function setUp() {
    packetcryptInstalled()
    .then(res => {
        console.log('PackectCrypt installed?', res);

        setTimeout(() => {
            if (res) {
                navigateToStep('#onboard-payment-address');
            } else {
                navigateToStep('#onboard-packetcrypt-check');
            }
        }, 3000);
    });
};
setUp();

function packetcryptInstalled() {
    // Check if packetcrypt is in PATH
    let commandToCheck = platform === 'win32' ? 'packetcrypt.exe' : 'packetcrypt';
    return commandExists(commandToCheck)
    .then(function(command){
        console.log(`${commandToCheck} Command exists !! ${command}`);
        globalSettings.packetcrypt_path = '';
        globalSettings.packetcrypt_in_path = true;
        return true;
    }).catch(function(){
        console.log(`${commandToCheck}  Command doesn\'t exist !!`);
        globalSettings.packetcrypt_in_path = false;
        return false;
    }); 
}

function locatePacketcrypt() {
    ipcRenderer.send('select-directory-triggered');
};

function installPacketcrypt() {
    const packages = [
        'https://github.com/cjdelisle/packetcrypt_rs/releases/download/packetcrypt-v0.5.2/packetcrypt-v0.5.2-windows.zip',  // Windows
        'https://github.com/cjdelisle/packetcrypt_rs/releases/download/packetcrypt-v0.5.2/packetcrypt-v0.5.2-linux_amd64',  // Linux
        'https://pkt.watch/minr/downloads/packetcrypt_builds/macos/x64/clang-jemalloc/packetcrypt',                         // Mac Intel
        'https://pkt.watch/minr/downloads/packetcrypt_builds/macos/arm64/clang-jemalloc/packetcrypt'                        // Mac ARM
    ];

    let url = (platform === 'win32' ? packages[0] : (platform == 'linux' ? packages[1] : (process.arch === 'arm64' ? packages[3] : packages[2])));

    const info = {
        url: url,
        properties: {
            saveAs: false
        }
    }
    ipcRenderer.send('download-packetcrypt-release', info);
};

ipcRenderer.on('download-packetcrypt-complete', (_, filePath) => {
    console.log('download-packetcrypt-complete', filePath);

    let userDataPath = ipcRenderer.sendSync('get-userdata-path');

    if (platform === 'win32') {
        extractArchive(filePath);
    } else if (platform === 'linux') {        
        fs.mkdir(`${userDataPath}/bin`, { recursive: true }, (err) => {
            if (err) throw err;

            fs.rename(filePath, `${userDataPath}/bin/packetcrypt`, function(err) {
                if ( err ) console.log('ERROR: ' + err);
                globalSettings.packetcrypt_path = `${userDataPath}/bin/packetcrypt`;
                navigateToStep('#onboard-payment-address');
            });
        });
        
    } else {
        // MacOS
        fs.mkdir(`${userDataPath}/bin`, { recursive: true }, (err) => {
            if (err) throw err;

            fs.rename(filePath, `${userDataPath}/bin/packetcrypt`, function(err) {
                if ( err ) console.log('ERROR: ' + err);
                globalSettings.packetcrypt_path = `${userDataPath}/bin/packetcrypt`;
                navigateToStep('#onboard-payment-address');
            });
        });
    }
    
});

function addPoolListItem(pool) {
    el.poolSelectionList.insertAdjacentHTML('beforeend', `
            <li class="list-group-item" data-id="${pool.id}">
                <div>
                    <div class="name">${pool.name}</div>
                    <div class="url">${pool.url}</div>
                </div>
            </li>
        `);
}

function buildSelectedPoolsList() {
    el.poolSelectionList.innerHTML = '';
    miningConfig.pools.forEach(pool => {
        addPoolListItem(pool);
    });
}
buildSelectedPoolsList();

function extractArchive(filePath) {
    let userDataPath = ipcRenderer.sendSync('get-userdata-path');
    var unzipper = new DecompressZip(filePath);
    let fileNames = [];

    unzipper.on('error', function (err) {
        console.log('Caught an error');
    });

    unzipper.on('extract', function (log) {
        console.log('Finished extracting');

        globalSettings.packetcrypt_path = `${userDataPath}${path.sep}${fileNames.join(path.sep)}`;

        navigateToStep('#onboard-payment-address');
    });

    unzipper.on('progress', function (fileIndex, fileCount) {
        console.log('Extracted file ' + (fileIndex + 1) + ' of ' + fileCount);
    });

    unzipper.on('list', function (files) {
        console.log('The archive contains:');
        console.log(files);
        fileNames = files[files.length-1].split(path.sep);
    });
    
    unzipper.list();

    console.log('Extract to', userDataPath);

    unzipper.extract({
        path: userDataPath,
        filter: function (file) {
            return file.type !== "SymbolicLink";
        }
    });
    
}

function openExternalLink(e) {
    const url = e.currentTarget.dataset.url;
    ipcRenderer.send('open-external-link', url);
}