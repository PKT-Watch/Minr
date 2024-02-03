const { ipcRenderer } = require('electron');
const { Terminal } = require('xterm');
const { FitAddon } = require('xterm-addon-fit');
const path = require('path');
const os = require('os');
const chartsMgr = require('./charts');
const walletMgr = require('./wallet-mgr');
const settingsMgr = require('./settings-mgr');
const settings = require('./page-settings');
const notificationMgr = require('./notification-mgr');
const utils = require('./utils');
const scheduler = require('./scheduler');

let awnOptions = { 
    icons: { 
        enabled: false // Not working
    },
    durations: {
        global: 3000
    }
};
let notifier = new AWN(awnOptions);

const el = {
    appVersion: document.querySelector('.app-version'),
    sidebar: document.querySelector('#sidebar'),
    statEncryptions: document.querySelector('#stat-encryptions'),
    statUpload: document.querySelector('#stat-upload'),
    statGoodrate: document.querySelector('#stat-goodrate'),
    statPools: document.querySelector('#stat-pools'),
    statStatus: document.querySelector('#stat-status .indicator'),
    statThreads: document.querySelector('#stat-threads'),
    statCPUTemp: document.querySelector('#stat-cpu-temp'),
    terminalWindow: document.querySelector('#terminal-window'),
    poolStatusList: document.querySelector('#pool-status-list'),
    btnStartMining: document.querySelector('#btnStartMining'),
    btnOpenTerminal: document.querySelector('#btnOpenTerminal'),
    btnCloseTerminal: document.querySelector('#btnCloseTerminal'),
    btnMaximiseTerminal: document.querySelector('#btnMaximiseTerminal'),
    btnMenuMiner: document.querySelector('#btnMenuMiner'),
    btnMenuWallet: document.querySelector('#btnMenuWallet'),
    btnMenuSettings: document.querySelector('#btnMenuSettings'),
    btnPageOpeners: document.querySelectorAll('.open-page'),
    btnSaveSettings: document.querySelector('#btnSaveSettings'),
    btnSaveMiningConfiguration: document.querySelector('#btnSaveMiningConfiguration'),
    txtSettingsPacketcryptPath: document.querySelector('#txtSettingsPacketcryptPath'),
    txtSettingsThreads_Count: document.querySelector('#txtSettingsThreads-Count'),
    btnSettingsPacketCryptPath: document.querySelector('#btnSettingsPacketCryptPath'),
    encryptionUnitsEl: document.querySelector('#encryption-units'),
    uploadUnitsEl: document.querySelector('#upload-units'),
    poolSelectionList: document.querySelector('#pool-selection-list'),
    poolSelectorSecondary: document.querySelector('#pool-selector-secondary'),
    btnPoolSelectorAdd: document.querySelector('#btnPoolSelectorAdd'),
    poolDefaultControls: document.querySelector('#pool-defaults'),
    statsWalletBalance: document.querySelector('#stats-wallet-balance'),
    statsWalletMined24: document.querySelector('#stats-wallet-mined-24'),
    statsWalletBalance_2: document.querySelector('#stats-wallet-balance-2'),
    statsWalletMined24_2: document.querySelector('#stats-wallet-mined-24-2'),
    miningIncomeList: document.querySelector('#mining-income-list'),
    colorModeSwitcherBtns: document.querySelectorAll('.color-mode-switcher button'),
    poolSelector: document.querySelector('#pool-selector'),
    poolSelectorLists: document.querySelectorAll('#pool-selector .pool-list'),
    poolSelectorItems: document.querySelectorAll('#pool-selector .list-item'),
    modalOverlay: document.querySelector('.modal-overlay'),
}

const params = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
});

if (params.poolDiffChanged) {
    // Removed. Pool diffs change so frequently that this is an annoyance.
    //notificationMgr.createNotification(notificationMgr.NotificationType.PoolDifficultyUpdate);
}

const globalSettings = settings.getGlobalSettings();

let miningConfig = {
    packetcrypt_path: '',
    packetcrypt_in_path: false,
    payment_addr: '',
    threads: 0,
    pools: []
}

const MiningStatus = {
    Inactive: 'Inactive',
    Active: 'Active',
    Initialising: 'Initialising'
};

const miningStats = {
    encryptions: [],
    upload: []
}

let terminalVisible = false;
var miningStatus = MiningStatus.Inactive; // 'var' so we can check for undefined in page-settings.js
let activePageEl = document.querySelector('#page-miner');
let cpuThreadCount = 0;

const term = new Terminal({theme: { background: '#232430', foreground: '#8183a3' }});
const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
term.open(document.querySelector('#terminal'));
term.write('\r\n$ ');
term.onData(e => {
    //
});

ipcRenderer.on('terminal.receiveData', (event, data) => {
    term.write(data);

    updateStats(parseLogs(data));
});

ipcRenderer.send('get-app-version');
ipcRenderer.on('app-version', (event, data) => {
    el.appVersion.innerHTML = `v${data}`;
});

ipcRenderer.on('notification', (event, notificationType) => {
    notificationMgr.createNotification(notificationType);
});

if (settingsMgr.getSetting('auto_update', true)) {
    ipcRenderer.send('check-for-update');
}

ipcRenderer.on('notifier', (event, data) => {
    notifier.success(data.message, data.options);
});

ipcRenderer.on('app-update-notification', (event, data) => {
    let noti = notifier.success(data.message, data.options);

    noti.addEventListener('click', e => {
        ipcRenderer.send('update-app');
    });
});

ipcRenderer.send('scheduler-initialise', '');
ipcRenderer.on('scheduler-initialise', (event, data) => {
   //
});

ipcRenderer.on('scheduled-task', (event, data) => {
    if (data.disabled) return;

    switch (data.task) {
        case 'mining-start':
            settings.loadMiningConfiguration(settings.getMiningConfigs().find(x => x.id === data.configId));
            if (miningStatus == MiningStatus.Inactive) {
                startMining();
            }
            notifier.success('Mining started.', {labels: {success: "Scheduled task"}});
            break;

        case 'mining-stop':
            if (miningStatus != MiningStatus.Inactive) {
                stopMining();
            }
            notifier.success('Mining stopped.', {labels: {success: "Scheduled task"}});
            break;

        case 'configuration-change':
            settings.loadMiningConfiguration(settings.getMiningConfigs().find(x => x.id === data.configId));
            notifier.success('Configuration changed.', {labels: {success: "Scheduled task"}});
            break;
    
        default:
            break;
    }
});

function loadConfiguration() {
    el.statThreads.querySelector('span:nth-child(1)').innerHTML = (settings.getActiveMiningConfig().threads > 0 ? settings.getActiveMiningConfig().threads : 'MAX');
    el.statThreads.querySelector('span:nth-child(2)').innerHTML = cpuThreadCount;

    updatePoolStats();
    getAddress(settings.getActiveMiningConfig().payment_addr);
    getIncome(settings.getActiveMiningConfig().payment_addr);
}
loadConfiguration();

function updateStats(data) {
    if (!data) return;

    miningStatus = MiningStatus.Active;
    updateMiningStatus();

    el.statEncryptions.querySelector('.value').innerHTML = `${data.encryptions}`;
    el.statEncryptions.querySelector('.units').innerHTML = `${data.encryptionsUnits}`;
    el.encryptionUnitsEl.innerHTML = `(${data.encryptionsUnits})`;
    el.statUpload.querySelector('.value').innerHTML = `${data.upload}`;
    el.statUpload.querySelector('.units').innerHTML = `${data.uploadUnits}`;
    el.uploadUnitsEl.innerHTML = '(Mb/s)'; 
    el.statThreads.querySelector('span:nth-child(2)').innerHTML = (miningConfig.threads > 0 ? miningConfig.threads : 'MAX');
    el.statThreads.querySelector('span:nth-child(2)').innerHTML = cpuThreadCount;

    for (let i = 0; i < data.goodrate.length; i++) {
        settings.getActiveMiningConfig().pools[i].goodrate = data.goodrate[i];
    }

    if (miningStats.encryptions.length === 50) {
        miningStats.encryptions.shift();
    }
    miningStats.encryptions.push(data.encryptions[0]);

    if (miningStats.upload.length === 50) {
        miningStats.upload.shift();
    }

    // Normalise all values to Mb/s
    switch (data.uploadUnits[0]) {
        case 'b/s':
            miningStats.upload.push(data.upload[0] / 1000 / 1000);
            break;
        case 'Kb/s':
            miningStats.upload.push(data.upload[0] / 1000);
            break;
        case 'Mb/s':
            miningStats.upload.push(data.upload[0]);
            break;
        case 'Gb/s':
            miningStats.upload.push(data.upload[0] * 1000);
            break;
        default:
            miningStats.upload.push(data.upload[0] / 1000);
    }  

    updatePoolStats();
    chartsMgr.updateChartEncryptions(miningStats);
}

function updateMiningStatus() {
    switch (miningStatus) {
        case MiningStatus.Inactive:
            el.statStatus.innerHTML = 'Not mining';
            el.statStatus.classList = 'indicator indicator-danger';

            btnStartMining.innerHTML = 'Start Mining';
            btnStartMining.classList.add('btn-primary');
            btnStartMining.classList.remove('btn-danger');
            break;
        case MiningStatus.Active:
            el.statStatus.innerHTML = 'Mining';
            el.statStatus.classList = 'indicator indicator-success';

            btnStartMining.innerHTML = 'Stop Mining';
            btnStartMining.classList.remove('btn-primary');
            btnStartMining.classList.add('btn-danger');
            break;
        case MiningStatus.Initialising:
            el.statStatus.innerHTML = 'Starting';
            el.statStatus.classList = 'indicator indicator-warning';

            btnStartMining.innerHTML = 'Stop Mining';
            btnStartMining.classList.remove('btn-primary');
            btnStartMining.classList.add('btn-danger');
            break;
        default:
            el.statStatus.innerHTML = 'Not mining';
            el.statStatus.classList = 'indicator indicator-danger';
            break;
    }
}

function updatePoolStats() {
    el.poolStatusList.innerHTML = '';

    if (!settings.getActiveMiningConfig().pools || settings.getActiveMiningConfig().pools.length === 0) return;

    let pools = settings.getActiveMiningConfig().pools; 

    pools.forEach(pool => {
        let status = 'Online';
        let statusIndicator = 'indicator-success';

        switch (true) {
            case pool.goodrate > 80:
                status = (miningStatus === MiningStatus.Active ? 'Online' : (miningStatus === MiningStatus.Inactive ? '---' : 'Starting'));
                statusIndicator  = (miningStatus === MiningStatus.Active ? 'indicator-success' : 'indicator-warning');
                break;
            case pool.goodrate > 0:
                status = (miningStatus === MiningStatus.Active ? 'Degraded' : (miningStatus === MiningStatus.Inactive ? '---' : 'Starting'));
                statusIndicator  = 'indicator-warning';
                break;
            default:
                status = (miningStatus === MiningStatus.Active ? 'Offline' : (miningStatus === MiningStatus.Inactive ? '---' : 'Starting'));
                statusIndicator  = (miningStatus === MiningStatus.Active ? 'indicator-danger' : 'indicator-warning');
                break;
        }

        el.poolStatusList.insertAdjacentHTML('beforeend', `
            <li>
                <div class="header">
                <div class="left">
                    <span class="indicator ${statusIndicator}">${status}</span>
                </div>
                <div class="right">
                    Goodrate
                </div>
                </div>
                <div class="pool">
                <div class="pool-name">${pool.name}</div>
                <div class="goodrate">${(miningStatus === MiningStatus.Inactive ? '---' : pool.goodrate)}%</div>
                </div>
            </li>
        `)
    });
}

btnStartMining.addEventListener('click', () => {
    if (miningStatus === MiningStatus.Inactive) {
        startMining();
    } else {
        stopMining();
    }
});

function startMining() {
    let miningConfig = settings.getActiveMiningConfig();

    if (miningConfig.pools.length === 0) {
        notifier.alert('Mining can not be started because the active configuration has no pools.', {labels: {alert: "Can't start mining"}, durations: { global: 6000 }});
        return;
    }

    let globalSettings = settings.getGlobalSettings();

    miningStatus = MiningStatus.Initialising;
    updateMiningStatus();
    updatePoolStats();

    if (!miningConfig.payment_addr) miningConfig.payment_addr = DEFAULT_PAYMENT_ADDRESS;

    let poolList = miningConfig.pools.map(function(pool) {
        return pool['url'];
    }).join(' ');
    if (os.platform() === 'win32') {
        let baseCommand = (globalSettings.packetcrypt_in_path && globalSettings.packetcrypt_path === '' ? 'packetcrypt.exe' : `& "${globalSettings.packetcrypt_path}"`);
        ipcRenderer.send('terminal.sendCommand', `${baseCommand} ann -p ${miningConfig.payment_addr} ${poolList} ${(miningConfig.threads > 0 ? '-t' + miningConfig.threads : '')}\r\n`);
    } else if (os.platform() === 'darwin') {
        let baseCommand = (globalSettings.packetcrypt_in_path && globalSettings.packetcrypt_path === '' ? '/usr/local/bin/packetcrypt' : `"${globalSettings.packetcrypt_path}"`);
        ipcRenderer.send('terminal.sendCommand', `${baseCommand} ann -p ${miningConfig.payment_addr} ${poolList} ${(miningConfig.threads > 0 ? '-t' + miningConfig.threads : '')}\r\n`);
    } else {
        let baseCommand = (globalSettings.packetcrypt_in_path && globalSettings.packetcrypt_path === '' ? 'packetcrypt' : `"${globalSettings.packetcrypt_path}"`);
        ipcRenderer.send('terminal.sendCommand', `${baseCommand} ann -p ${miningConfig.payment_addr} ${poolList} ${(miningConfig.threads > 0 ? '-t' + miningConfig.threads : '')}\r\n`);
    }

    ipcRenderer.send('prevent-app-suspension', 'mining');
}

function stopMining() {
    miningStatus = MiningStatus.Inactive;
    updateMiningStatus();
    ipcRenderer.send('terminal.interrupt', '');
    ipcRenderer.send('enable-app-suspension', 'mining');
}

window.onresize = function () {
    if (terminalVisible) {
        fitAddon.fit();
    }
};

el.btnOpenTerminal.addEventListener('click', (e) => {
    if (terminalVisible) {
        el.terminalWindow.classList.toggle('active');
        terminalVisible = false;
    } else {
        el.terminalWindow.classList.toggle('active');
        terminalVisible = true;

        setTimeout(() => {
            fitAddon.fit();
        }, 100);
    }
});

function deactiveMenuButtons() {
    sidebar.querySelectorAll('button').forEach(btn => {
        btn.classList.remove('active');
    });
}

function openPage(id) {
    let targetPage = document.querySelector(`#${id}`);

    if (targetPage === activePageEl) {
        return;
    }

    activePageEl.classList.add('d-none');
    targetPage.classList.remove('d-none');
    activePageEl = targetPage;

    if (id === 'page-settings') {
        settings.toggleMiningConfigurationForm('hide');
        settings.resetMiningConfigurationForm();
    } else if (id == 'page-schedule') {
        scheduler.loadMiningConfigurations();
    }
}

el.btnCloseTerminal.addEventListener('click', (e) => {
    el.terminalWindow.classList.toggle('active');
    terminalVisible = false;
});

el.btnMaximiseTerminal.addEventListener('click', (e) => {
    el.terminalWindow.classList.toggle('maximised');

    setTimeout(() => {
        fitAddon.fit();
    }, 100);
});

el.btnPageOpeners.forEach(btn => {
    btn.addEventListener('click', (e) => {
        deactiveMenuButtons();
        e.currentTarget.classList.add('active');

        let targetPageId = btn.dataset.target;

        openPage(targetPageId)
    });
});

function requestCPUData() {
    ipcRenderer.send('get-cpu-data');
}
requestCPUData();

ipcRenderer.on('cpu', (event,data) => {
    //console.log('cpu', data);

    if (chartsMgr.chartsReady()) {
        chartsMgr.updateChartCPU(data.usage);
        if (data.temp) {
            el.statCPUTemp.innerHTML = `${parseInt(data.temp)}°`;
        } else {
            el.statCPUTemp.innerHTML = `Can't read CPU temperature.<br>Try running as Administrator.`;
            el.statCPUTemp.classList.remove('value');
        }
    }
});

chartsMgr.buildCharts();

/**
 * SETTINGS PAGE
 */

el.btnSaveMiningConfiguration.addEventListener('click', e => {
    let config = settings.updateMiningConfiguration();
    
    if (config && config.active) {
        settings.loadMiningConfiguration(config);
        loadConfiguration();

        if (miningStatus !== MiningStatus.Inactive) {
            stopMining();

            // Timeout required on Windows
            setTimeout(() => {
                startMining();
            }, 1000);
        }
    }
});

el.btnSaveSettings.addEventListener('click', e => {
    let global_settings = settings.getGlobalSettings();
    global_settings.packetcrypt_path = el.txtSettingsPacketcryptPath.value;
    settings.saveGlobalSettings();
    
    if (miningStatus !== MiningStatus.Inactive) {
        stopMining();
       
        settings.loadActiveMiningConfiguration(config);
        loadConfiguration();

        // Timeout required on Windows
        setTimeout(() => {
            startMining();
        }, 1000);
    }
});

el.btnSettingsPacketCryptPath.addEventListener('click', e => {
    ipcRenderer.send('select-directory-triggered');
});

ipcRenderer.on('directory-selected', (_, filePath) => {
    if (filePath.length) {
        txtSettingsPacketcryptPath.value = filePath;
    }
});

/**
 * WALLET PAGE
 */
let timerGetAddress = null;
function getAddress(addr) {
    function schedule() {
        clearTimeout(timerGetAddress);
        timerGetAddress = setTimeout(() => {
            getAddress(settings.getActiveMiningConfig().payment_addr);
        }, 60000 * 2);
    }

    walletMgr.getAddress(addr, true)
    .then(data => {
        const balance = utils.numberWithCommas(utils.unitsToPkt(data.balance));
        el.statsWalletBalance.innerHTML = `${balance} PKT`;
        el.statsWalletBalance_2.innerHTML = `${balance} PKT`;

        const mined24 = utils.numberWithCommas(utils.unitsToPkt(data.mined24));
        el.statsWalletMined24.innerHTML = `${mined24} PKT`;
        el.statsWalletMined24_2.innerHTML = `${mined24} PKT`;

        schedule();
    })
    .catch(error => {
        schedule();
    });
}

function getIncome(addr) {
    walletMgr.getIncome(addr)
    .then(data => {
        el.miningIncomeList.innerHTML = '';
        let miningIncome = [];
        let dates = [];

        data.forEach(row => {
            // Exclude days without income
            if (parseInt(row.received) === 0) return;

            let pkt = utils.unitsToPkt(row.received);
            let date = new Date(row.date);
            miningIncome.push(pkt);
            dates.push(date);
            el.miningIncomeList.insertAdjacentHTML('beforeend', `
                <li class="list-group-item">
                    <div class="date">${date.toLocaleDateString()}</div>
                    <div class="value">${utils.numberWithCommas(pkt)}</div>
                </li>
            `)
        });

        chartsMgr.updateChartMiningIncome(miningIncome.reverse(), dates.reverse());
    })
    .catch(error => {
        //
    });
}

const updateOnlineStatus = () => {
    if (navigator.onLine) {
        notificationMgr.clearNotificationsByType(notificationMgr.NotificationType.NetworkError);
    } else {
        notificationMgr.createNotification(notificationMgr.NotificationType.NetworkError);
    }
}

el.colorModeSwitcherBtns.forEach(btn => {
    if (btn.dataset.mode === globalSettings.color_mode) btn.classList.add('active');

    btn.addEventListener('click', e => {
        el.colorModeSwitcherBtns.forEach(b => {
            b.classList.remove('active');
        });
        btn.classList.add('active');

        const mode = btn.dataset.mode;

        globalSettings.color_mode = mode;
        settings.saveGlobalSettings();
        ipcRenderer.send('color-mode', mode);
    });
});

window.addEventListener('online', updateOnlineStatus)
window.addEventListener('offline', updateOnlineStatus)

updateOnlineStatus()

document.querySelectorAll('.tabs').forEach(tabs => {
    tabs.addEventListener('click', e => {
        if (e.target && e.target.closest('li')) {
            const targetSelector = e.target.closest('li').dataset.target;
            e.currentTarget.querySelectorAll('li').forEach(control => {
                control.classList.remove('active');
            });
            e.target.closest('li').classList.add('active');
            const tabContent = e.currentTarget.nextElementSibling;
            tabContent.querySelectorAll('.tab').forEach(tab => {
                tab.classList.add('inactive');
            });
            tabContent.querySelector(targetSelector).classList.remove('inactive')
        }
    });
});

document.querySelector('.tabs [data-target=".box-settings-config"]').addEventListener('click', e => {
    if (e.currentTarget.classList.contains('active')) return;
    settings.resetMiningConfigurationForm();
});

document.querySelectorAll('.mining-configuration-switcher').forEach(switcher => {
    switcher.addEventListener('click', e => {
        if (e.target && e.target.closest('.active-config')) {
            switcher.classList.toggle('active');
        } else if (e.target && e.target.closest('li')) {
            const config = settings.getMiningConfigs().find(x => x.id === parseInt(e.target.closest('li').dataset.id));
            settings.loadMiningConfiguration(config);
            switcher.classList.toggle('active');
        }
    });
});

function toggleModal(selector) {
    const modal = document.querySelector(selector);

    if (modal.classList.contains('active')) {
        // Hide
        el.modalOverlay.addEventListener('transitionend', () => {
            el.modalOverlay.classList.remove('visible');
        }, {once: true});
        el.modalOverlay.classList.remove('active');

        modal.addEventListener('transitionend', () => {
            modal.classList.remove('visible');
        }, {once: true});
        modal.classList.remove('active');
    } else {
        // Show
        el.modalOverlay.classList.add('visible');
        setTimeout(() => {
            el.modalOverlay.classList.add('active');
        }, 10);

        modal.classList.add('visible');
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
    }
}

document.querySelectorAll('.modal .close-control').forEach(el => {
    el.addEventListener('click', e => {
        closeModal();
    });
});

function closeModal() {
    const modal = document.querySelector('.modal.active');

    el.modalOverlay.addEventListener('transitionend', () => {
        el.modalOverlay.classList.remove('visible');
    }, {once: true});
    el.modalOverlay.classList.remove('active');

    modal.addEventListener('transitionend', () => {
        modal.classList.remove('visible');
    }, {once: true});
    modal.classList.remove('active');
}

function openExternalLink(e, options) {
    console.log(e, options);
    let url = e.currentTarget.dataset.url;

    if (options.appendWalletAddress) {
        url += settings.getActiveMiningConfig().payment_addr;
    }

    console.log(url);
    ipcRenderer.send('open-external-link', url);
}

function toggleCPUTempWidget(hide) {
    if (hide) {
        document.querySelector('body').classList.add('hide-box-cpu-temp');
    } else {
        document.querySelector('body').classList.remove('hide-box-cpu-temp');
    }
}
toggleCPUTempWidget(settingsMgr.getSetting('hide_cpu_temp'));