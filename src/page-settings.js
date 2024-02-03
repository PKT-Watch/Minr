const { ipcRenderer , dialog} = require('electron');
const utils = require('./utils');
const settingsMgr = require('./settings-mgr');
const { getAddress } = require('./wallet-mgr');
const scheduler = require('./scheduler');
const uuidv4 = require('uuid').v4;

let awnOptions = { 
    icons: { 
        enabled: false // Not working
    },
    durations: {
        global: 3000
    }
};
let notifier = new AWN(awnOptions);
let mining_configs = [];
let active_mining_config = {};  // The config that is actively being used to mine or was last used
let editing_mining_config = {}; // The config that is currently being edited
const global_settings = {
    color_mode: 'light',
    packetcrypt_path: '',
    packetcrypt_in_path: false,
    auto_update: true,
    schedule_prevent_sleep: true,
    schedule_use: true
}
exports.getMiningConfigs = () => { return mining_configs };
exports.getActiveMiningConfig = () => { return active_mining_config };
exports.getEditingMiningConfig = () => { return editing_mining_config };
exports.getGlobalSettings = () => { return global_settings };

const available_pools = settingsMgr.getSetting('available_pools', []).concat(settingsMgr.getSetting('custom_pools', []));

const el = {
    txtSettingsConfigName: document.querySelector('#txtSettingsConfigName'),
    txtSettingsPacketcryptPath: document.querySelector('#txtSettingsPacketcryptPath'),
    formNoteSettingsPacketCryptPath: document.querySelector('#formNoteSettingsPacketCryptPath'),
    txtSettingsThreads: document.querySelector('#txtSettingsThreads'),
    txtSettingsThreads_Count: document.querySelector('#txtSettingsThreads-Count'),
    txtSettingsPaymentAddr: document.querySelector('#txtSettingsPaymentAddr'),
    chkSettingsAutoUpdate: document.querySelector('#chkSettingsAutoUpdate'),
    chkSettingsHideCPUTemp: document.querySelector('#chkSettingsHideCPUTemp'),
    chkSettingsSchedulePreventSleep: document.querySelector('#chkSettingsSchedulePreventSleep'),
    chkSettingsScheduleUse: document.querySelector('#chkSettingsScheduleUse'),
    poolListAvailable: document.querySelector('.pool-list-available'),
    poolListSelected: document.querySelector('.pool-list-selected'),
    savedConfigList: document.querySelector('.saved-config-list'),
    statThreads: document.querySelector('#stat-threads'),
    formMiningConfiguration: document.querySelector('#form-mining-configuration'),
    btnCreateCustomPool: document.querySelector('#btnCreateCustomPool'),
    btnCreateMiningConfiguration: document.querySelector('#btnCreateMiningConfiguration'),
    btnSaveMiningConfiguration: document.querySelector('#btnSaveMiningConfiguration'),
    btnCancelMiningConfiguration: document.querySelector('#btnCancelMiningConfiguration'),
    btnSaveSettings: document.querySelector('#btnSaveSettings'),
    miningConfigurationSwitcher: document.querySelector('.mining-configuration-switcher'),
    statsWalletBalance: document.querySelector('#stats-wallet-balance'),
    statsWalletMined24: document.querySelector('#stats-wallet-mined-24'),
    statsWalletBalance_2: document.querySelector('#stats-wallet-balance-2'),
    statsWalletMined24_2: document.querySelector('#stats-wallet-mined-24-2'),
    miningIncomeList: document.querySelector('#mining-income-list'),
    ddlCustomPool_Pool: document.querySelector('#ddlCustomPool_Pool'),
    txtCustomPool_Label: document.querySelector('#txtCustomPool_Label'),
    txtCustomPool_URL: document.querySelector('#txtCustomPool_URL'),
    hdnCustomPool_Id: document.querySelector('#hdnCustomPool_Id'),
    btnSaveCustomPoolSettings: document.querySelector('#btnSaveCustomPoolSettings'),
    btnDeleteCustomPoolSettings: document.querySelector('#btnDeleteCustomPoolSettings')
}

function initilaisePage() {
    loadGlobalSettings();
    loadMiningConfigurations();
    loadActiveMiningConfiguration();

    if (el.ddlCustomPool_Pool.options.length === 1) {
        const poolNames = getPoolNames();
        poolNames.forEach(name => {
            el.ddlCustomPool_Pool.insertAdjacentHTML('beforeend', `<option>${name}</option>`);
        });
    }

    // Set a default pool list based on the currently active config
    const callback = function() {
        buildSelectedPoolsList(active_mining_config.pools);
    }
    buildAvailablePoolList(callback); 
}
initilaisePage();

function loadGlobalSettings() {
    global_settings.color_mode = settingsMgr.getSetting('color_mode', 'light');
    global_settings.packetcrypt_path = settingsMgr.getSetting('packetcrypt_path', '');
    global_settings.packetcrypt_in_path = settingsMgr.getSetting('packetcrypt_in_path', false);
    global_settings.auto_update = settingsMgr.getSetting('auto_update', true);
    global_settings.hide_cpu_temp = settingsMgr.getSetting('hide_cpu_temp', false);
    global_settings.schedule_prevent_sleep = settingsMgr.getSetting('schedule_prevent_sleep', true);
    global_settings.schedule_use = settingsMgr.getSetting('schedule_use', true);

    loadSettingsForm();
}

function saveGlobalSettings() {
    console.log(global_settings);
    settingsMgr.setSetting('color_mode', global_settings.color_mode);
    settingsMgr.setSetting('packetcrypt_path', global_settings.packetcrypt_path);
    settingsMgr.setSetting('packetcrypt_in_path', global_settings.packetcrypt_in_path);
    settingsMgr.setSetting('auto_update', global_settings.auto_update);
    settingsMgr.setSetting('hide_cpu_temp', global_settings.hide_cpu_temp);
    settingsMgr.setSetting('schedule_prevent_sleep', global_settings.schedule_prevent_sleep);
    settingsMgr.setSetting('schedule_use', global_settings.schedule_use);

    notifier.success('Settings updated.', {labels: {success: "Saved"}});
}
exports.saveGlobalSettings = saveGlobalSettings;

function loadMiningConfigurations() {
    mining_configs = settingsMgr.getSetting('mining_configs', []);

    buildSavedConfigurationList();
}

function loadMiningConfiguration(config, ignorePoolStats) {
    mining_configs.forEach(c => c.active = false);
    config.active = true;
    if (!config.payment_addr) config.payment_addr = DEFAULT_PAYMENT_ADDRESS;
    active_mining_config = config;

    let index = mining_configs.findIndex(item => item.id === parseInt(config.id));
    if (index > -1) {
        mining_configs[index] = config;
        el.miningConfigurationSwitcher.querySelector('.name').innerHTML = config.config_name;
        el.statThreads.querySelector('span:nth-child(1)').innerHTML = (config.threads > 0 ? config.threads : 'MAX');
        settingsMgr.setSetting('mining_configs', mining_configs);
        const callback = function() {
            buildSelectedPoolsList(config.pools);
        }
        buildAvailablePoolList(callback); 
        loadMiningConfigurations();
        walletMgr.getAddress(config.payment_addr)
        .then(data => {
            const balance = utils.numberWithCommas(utils.unitsToPkt(data.balance));
            el.statsWalletBalance.innerHTML = `${balance} PKT`;
            el.statsWalletBalance_2.innerHTML = `${balance} PKT`;
    
            const mined24 = utils.numberWithCommas(utils.unitsToPkt(data.mined24));
            el.statsWalletMined24.innerHTML = `${mined24} PKT`;
            el.statsWalletMined24_2.innerHTML = `${mined24} PKT`;
        });
        walletMgr.getIncome(config.payment_addr)
        .then(data => {
            el.miningIncomeList.innerHTML = '';
            
            let miningIncome = [];
            let dates = [];

            data.forEach(row => {
                let pkt = utils.unitsToPkt(row.received);
                let date = row.date.substring(0, 10);
                miningIncome.push(pkt);
                dates.push(date);
                el.miningIncomeList.insertAdjacentHTML('beforeend', `
                    <li class="list-group-item">
                        <div class="date">${date}</div>
                        <div class="value">${utils.numberWithCommas(pkt)}</div>
                    </li>
                `)
            });

            chartsMgr.updateChartMiningIncome(miningIncome.reverse(), dates.reverse());
        })

        if (!ignorePoolStats) {
            updatePoolStats();
        }

        if (typeof miningStatus !== 'undefined' && miningStatus !== MiningStatus.Inactive) {
            stopMining();

            if(active_mining_config.pools.length === 0) {
                notifier.alert('Mining was stopped because the active configuration has no pools.', {labels: {alert: "Mining stopped"}, durations: { global: 6000 }});
                return;
            }

            // Timeout required on Windows
            setTimeout(() => {
                startMining();
            }, 1000);
        }
    }
}
exports.loadMiningConfiguration = loadMiningConfiguration;

function loadActiveMiningConfiguration() {
    active_mining_config = mining_configs.find(x => x.active === true);

    loadMiningConfiguration(active_mining_config, true);
}

function createMiningConfiguration() {
    if (el.txtSettingsConfigName.value.trim() === '') {
        notifier.warning('Please give this configuration a name.', {labels: {warning: ""}});
        return;
    }
    if (editing_mining_config.pools.length === 0) {
        notifier.warning('Please select at least one mining pool.', {labels: {warning: ""}});
        return;
    }
    editing_mining_config.active = false;
    editing_mining_config.id = Date.now();
    editing_mining_config.config_name = el.txtSettingsConfigName.value.trim();
    editing_mining_config.payment_addr = el.txtSettingsPaymentAddr.value.trim();
    editing_mining_config.threads = (el.txtSettingsThreads.value ? parseInt(el.txtSettingsThreads.value) : 0);

    mining_configs.push(editing_mining_config);
    settingsMgr.setSetting('mining_configs', mining_configs);

    loadMiningConfigurations();

    notifier.success('Mining configuration created.', {labels: {success: "Saved"}});

    return editing_mining_config;
}
exports.createMiningConfiguration = createMiningConfiguration;

function editMiningConfiguration(config) {
    loadMiningConfigurations();

    if (config) {
        editing_mining_config = config;
    } else {
        editing_mining_config = utils.deepCloneObject(mining_configs.find(x => x.active === true));
    }

    loadMiningConfigurationForm();
    el.btnSaveMiningConfiguration.textContent = 'Save configuration';
    toggleMiningConfigurationForm('show');
}

function updateMiningConfiguration() {
    const index = mining_configs.findIndex(item => item.id === editing_mining_config.id);

    if (index > -1) {
        editing_mining_config.config_name = el.txtSettingsConfigName.value.trim();
        editing_mining_config.payment_addr = el.txtSettingsPaymentAddr.value.trim();
        editing_mining_config.threads = (el.txtSettingsThreads.value ? parseInt(el.txtSettingsThreads.value) : 0);
        mining_configs[index] = editing_mining_config;
        settingsMgr.setSetting('mining_configs', mining_configs);

        loadMiningConfigurations();

        notifier.success('Mining configuration updated.', {labels: {success: "Saved"}});

        return editing_mining_config;
    } else {
        return createMiningConfiguration();
    }
}
exports.updateMiningConfiguration = updateMiningConfiguration;

function buildSavedConfigurationList() {
    let listEl = el.savedConfigList.querySelector('.insertion-point');
    listEl.innerHTML = '';

    let switcherListEl = el.miningConfigurationSwitcher.querySelector('ul');
    let switcherActiveConfigEl = el.miningConfigurationSwitcher.querySelector('.active-config');
    switcherListEl.innerHTML = '';

    mining_configs.forEach(config => {
        listEl.insertAdjacentHTML('beforeend', `
            <div class="list-item ${config.active ? 'active' : ''}" data-id="${config.id}">
                <div>
                    <div>${config.config_name}</div>
                </div>
                <div class="controls">
                    <a class="" data-action="edit">Edit</a>
                    <a class="" data-action="delete">Delete</a>
                </div>
            </div>
        `);
        switcherListEl.insertAdjacentHTML('beforeend', `
            <li data-id="${config.id}">${config.config_name}</li>
        `);

        if (config.active) {
            switcherActiveConfigEl.querySelector('.name').innerHTML = config.config_name;
        }
        
    });

}

function loadSettingsForm() {
    el.txtSettingsPacketcryptPath.value = global_settings.packetcrypt_path;
    el.chkSettingsAutoUpdate.checked = global_settings.auto_update;
    el.chkSettingsHideCPUTemp.checked = global_settings.hide_cpu_temp;
    el.chkSettingsSchedulePreventSleep.checked = global_settings.schedule_prevent_sleep;
    el.chkSettingsScheduleUse.checked = global_settings.schedule_use;
    if (global_settings.packetcrypt_in_path) {
        el.formNoteSettingsPacketCryptPath.classList.remove('d-none');
    }
}

function loadMiningConfigurationForm() {
    el.txtSettingsConfigName.value = editing_mining_config.config_name;
    el.txtSettingsThreads.value = (editing_mining_config.threads > 0 ? editing_mining_config.threads : '');
    el.txtSettingsPaymentAddr.value = editing_mining_config.payment_addr;
    el.btnSaveMiningConfiguration.disabled = false;

    const callback = function() {
        buildSelectedPoolsList(editing_mining_config.pools);
    }
    buildAvailablePoolList(callback); 
}

function resetMiningConfigurationForm() {
    editing_mining_config = {};
    
    el.txtSettingsConfigName.value = "";
    el.txtSettingsThreads.value = '';
    el.txtSettingsPaymentAddr.value = '';

    const callback = function() {
        buildSelectedPoolsList(active_mining_config.pools);
    }
    buildAvailablePoolList(callback); 
}
exports.resetMiningConfigurationForm = resetMiningConfigurationForm;

function toggleMiningConfigurationForm(visibility) {
    switch (visibility) {
        case 'hide':
            el.formMiningConfiguration.classList.add('d-none');
            break;
        case 'show':
            el.formMiningConfiguration.classList.remove('d-none');
            break;
        default:
            el.formMiningConfiguration.classList.toggle('d-none');
            break;
    }
}
exports.toggleMiningConfigurationForm = toggleMiningConfigurationForm;

const poolListAvailableSortable = new Sortable(el.poolListAvailable, {
    group: 'shared', // set both lists to same group
    animation: 150,
    ghostClass: "sortable-ghost",
    onEnd: function (evt) {
        filterAvailablePoolsByDiff();
        filterDuplicatePools();
        getSelectedPools();
        const pools = getSelectedPools();
        el.btnSaveMiningConfiguration.disabled = (pools.length === 0);
    },
    onAdd: function (evt) {
		// same properties as onEnd
        onSelectPool(evt);
	},
    onRemove: function (evt) {
		// same properties as onEnd
	},
    onMove: function(evt) {
        return !isDuplicatePool(evt.dragged.dataset.id);
    }
});

const poolListSelectedSortable = new Sortable(el.poolListSelected, {
    group: 'shared', // set both lists to same group
    animation: 150,
    ghostClass: "sortable-ghost",
    onEnd: function (evt) {
        filterAvailablePoolsByDiff();
        filterDuplicatePools();
        const pools = getSelectedPools();
        el.btnSaveMiningConfiguration.disabled = (pools.length === 0);
    },
    onAdd: function (evt) {
        getSelectedPools();

        onSelectPool(evt);
	},
    onRemove: function (evt) {
        getSelectedPools();
	}
});

function getSelectedPools() {
    editing_mining_config.pools = [];
    el.poolListSelected.querySelectorAll('.list-item').forEach(poolEl => {
        const pool = getPoolById(poolEl.dataset.id);
        editing_mining_config.pools.push(pool);
    });
    return editing_mining_config.pools;
}

function getPoolById(id) {
    return available_pools.find(x => x.id === id);
}

function getPrimaryPoolDifficulty() {
    const primaryPoolEl = el.poolListSelected.firstElementChild;
    return (primaryPoolEl ? available_pools.find(x => x.id === primaryPoolEl.dataset.id).diff : 9999999);
}

function getPoolNames() {
    return [...new Set(settingsMgr.getSetting('available_pools', []).map(item => item.name))];
}

function isDuplicatePool(id) {
    const poolName = available_pools.find(x => x.id === id).name;
    let foundPool = false;

    editing_mining_config.pools.forEach(pool => {
        if (pool.name === poolName) {
            foundPool = true;
        }
    });

    return foundPool;
}

function filterDuplicatePools() {
    el.poolListAvailable.querySelectorAll('.list-item').forEach(el => {
        el.classList.remove('disabled');
    });

    editing_mining_config.pools.forEach(pool => {
        available_pools.filter(function (el) {
            return el.name === pool.name;
        }).forEach(pool => {
            const listAvailableItemEl = el.poolListAvailable.querySelector(`[data-id="${pool.id}"]`);
            if (listAvailableItemEl) {
                listAvailableItemEl.classList.add('disabled');
            }
        });
    });
}

function filterAvailablePoolsByDiff() {
    const primaryPoolEl = el.poolListSelected.firstElementChild;
    const diff = getPrimaryPoolDifficulty();

    available_pools.forEach(pool => {
        const listAvailableItemEl = el.poolListAvailable.querySelector(`[data-id="${pool.id}"]`);
        const listSelectedItemEl = el.poolListSelected.querySelector(`[data-id="${pool.id}"]`);   

        if (pool.diff > diff) {
            if (listAvailableItemEl) {
                listAvailableItemEl.classList.add('invalid-diff');
            } else if (listSelectedItemEl) {
                listSelectedItemEl.classList.add('invalid-diff');
            }
        } else {
            if (listAvailableItemEl) {
                listAvailableItemEl.classList.remove('invalid-diff');
            } else if (listSelectedItemEl) {
                listSelectedItemEl.classList.remove('invalid-diff');
            }
        }
    });
}

function onSelectPool(evt) {
    //
}

function onSortEnd(evt) {
    // console.log('evt.to', evt.to);    // target list
    // console.log('evt.from', evt.from);  // previous list
    // console.log('evt.oldIndex', evt.oldIndex);  // element's old index within old parent
    // console.log('evt.newIndex', evt.newIndex);  // element's new index within new parent
    // console.log('evt.oldDraggableIndex', evt.oldDraggableIndex); // element's old index within old parent, only counting draggable elements
    // console.log('evt.newDraggableIndex', evt.newDraggableIndex); // element's new index within new parent, only counting draggable elements
}

function buildAvailablePoolList(callback) {
    el.poolListAvailable.innerHTML = '';

    available_pools.forEach(pool => {
        el.poolListAvailable.insertAdjacentHTML('beforeend', `
            <li class="list-item" data-id="${pool.id}">
                ${pool.user_added ? `<div class="settings"><svg class="icon"><use href="#svg-tune"></use></svg></div>` : `<div class="diff">${pool.nice_diff}</div>`}
                <div class="meta">
                    <div class="name">${pool.user_added ? pool.label : pool.name}</div>
                    <div class="url">${pool.url}</div>
                </div>
                <div class="controls">
                    <svg class="icon"><use href="#svg-drag-indicator"></use></svg>
                </div>
            </li>
        `);
    })

    if (typeof callback === 'function') {
        callback();
    }
}

function buildSelectedPoolsList(pools) {
    if (!pools || pools.length === 0) el.btnSaveMiningConfiguration.disabled = true;;

    editing_mining_config.pools = [];
    el.poolListSelected.innerHTML = '';
    pools.forEach(pool => {
        const listEl = el.poolListAvailable.querySelector(`[data-id="${pool.id}"]`);
        el.poolListSelected.insertAdjacentElement('beforeend', listEl);
        editing_mining_config.pools.push(pool);
    });

    filterAvailablePoolsByDiff();
    filterDuplicatePools();
}

el.txtSettingsThreads.addEventListener('input', e => {
    const val = parseInt(el.txtSettingsThreads.value);
    if (val < 0) {
        el.txtSettingsThreads.value = cpuThreadCount-1;
    } else if (val === 0 || val >= cpuThreadCount) {
        el.txtSettingsThreads.value = '';
    }
});

el.btnCreateMiningConfiguration.addEventListener('click', e => {
    resetMiningConfigurationForm();
    el.btnSaveMiningConfiguration.textContent = 'Create configuration';
    toggleMiningConfigurationForm('show');
});

el.btnCancelMiningConfiguration.addEventListener('click', e => {
    toggleMiningConfigurationForm('hide');
});

el.btnCreateCustomPool.addEventListener('click', e => {
    el.hdnCustomPool_Id.value = -1;
    el.ddlCustomPool_Pool.value = -1;
    el.txtCustomPool_Label.value = '';
    el.txtCustomPool_URL.value = '';
    el.btnDeleteCustomPoolSettings.classList.add('d-none');
    toggleModal('.custom-pool-settings-modal');
});

el.savedConfigList.addEventListener('click', e => {
    if (e.target && e.target.closest('.list-item a')) {
        const btn = e.target.closest('.list-item a');
        const listItem = e.target.closest('.list-item');
        const config = mining_configs.find(x => x.id === parseInt(listItem.dataset.id));
        let index = -1;

        switch (btn.dataset.action) {
            case 'load':
                loadMiningConfiguration(config);                         
                break;

            case 'edit':
                editMiningConfiguration(config);
                break;

            case 'delete':
                if (config.active) {
                    notifier.alert('The active configuration can not be deleted.', {labels: {alert: "You can't do that"}});
                    return;
                }
                
                const configId = parseInt(listItem.dataset.id);
                let schedule = settingsMgr.getSetting('schedule', []);
                let configIsScheduled = false;
                let scheduledTasks = [];
                schedule.forEach(day => {
                    day.forEach(task => {
                        if (task.configId === configId) {
                            configIsScheduled = true;
                            scheduledTasks.push(task);
                        }
                    });
                });

                if (configIsScheduled) {
                    let res = confirm('This configuration is used in your schedule.\n\nAny tasks using this configuration will be disabled.')
                    if (!res) {
                        break;
                    }

                    scheduledTasks.forEach(task => {
                        task.disabled = true;
                    });
                    settingsMgr.setSetting('schedule', schedule);

                    scheduler.buildSchedule();
                }

                index = mining_configs.findIndex(item => item.id === configId);
                if (index > -1) {
                    mining_configs.splice(index, 1);
                    settingsMgr.setSetting('mining_configs', mining_configs);
                    loadMiningConfigurations();
                } 

                break;

            default:
                break;
        }     

    }
});

el.chkSettingsAutoUpdate.addEventListener('change', e => {
    global_settings.auto_update = el.chkSettingsAutoUpdate.checked;
    saveGlobalSettings();
});

el.chkSettingsHideCPUTemp.addEventListener('change', e => {
    global_settings.hide_cpu_temp = el.chkSettingsHideCPUTemp.checked;
    saveGlobalSettings();

    toggleCPUTempWidget(global_settings.hide_cpu_temp);
});

el.chkSettingsSchedulePreventSleep.addEventListener('change', e => {
    global_settings.schedule_prevent_sleep = el.chkSettingsSchedulePreventSleep.checked;
    saveGlobalSettings();

    if (global_settings.schedule_prevent_sleep && global_settings.schedule_use && scheduler.hasSchedule()) {
        ipcRenderer.send('prevent-app-suspension', 'schedule');
    } else {
        ipcRenderer.send('enable-app-suspension', 'schedule');
    }
});

el.chkSettingsScheduleUse.addEventListener('change', e => {
    global_settings.schedule_use = el.chkSettingsScheduleUse.checked;
    saveGlobalSettings();

    if (global_settings.schedule_prevent_sleep && global_settings.schedule_use && scheduler.hasSchedule()) {
        ipcRenderer.send('prevent-app-suspension', 'schedule');
    } else {
        ipcRenderer.send('enable-app-suspension', 'schedule');
    }

    if (global_settings.schedule_use) {
        ipcRenderer.send('scheduler-initialise', '');
    } else {
        ipcRenderer.send('scheduler-destroy', '');
    }
});

el.btnSaveCustomPoolSettings.addEventListener('click', e => {
    const poolId = el.hdnCustomPool_Id.value;
    const poolName = el.ddlCustomPool_Pool.value;
    const label = el.txtCustomPool_Label.value;
    const url = el.txtCustomPool_URL.value;

    const obj = {
        id: (poolId ? poolId : -1),
        name: poolName,
        label: label,
        url: url,
    };
    saveCustomPool(obj);
    buildAvailablePoolList();
    buildSelectedPoolsList(editing_mining_config.pools);
    closeModal();
});

el.btnDeleteCustomPoolSettings.addEventListener('click', e => {
    const poolId = el.hdnCustomPool_Id.value;
    deleteCustomPool(poolId);
    buildAvailablePoolList();
    buildSelectedPoolsList(editing_mining_config.pools);
    closeModal();
});

function saveCustomPool(obj) {  
    obj.diff = -1;
    obj.nice_diff = '????';
    obj.goodrate = 0;
    obj.user_added = true;

    let custom_pools = settingsMgr.getSetting('custom_pools', []);

    if (obj.id != -1) {
        // Update
        const poolIndex = custom_pools.findIndex(x => x.id === obj.id);
        custom_pools[poolIndex] = obj;

        const poolAvailableIndex = available_pools.findIndex(x => x.id === obj.id);
        available_pools[poolAvailableIndex] = obj;

        let editingIndex = editing_mining_config.pools.findIndex(x => x.id === obj.id);
        editing_mining_config.pools[editingIndex] = obj;
    } else {
        // Create
        obj.id = uuidv4();
        custom_pools.push(obj);
        available_pools.push(obj);
    }   

    settingsMgr.setSetting('custom_pools', custom_pools);
}

function deleteCustomPool(id) {
    let custom_pools = settingsMgr.getSetting('custom_pools', []);
    const poolIndex = custom_pools.findIndex(x => x.id === id);
    custom_pools.splice(poolIndex, 1);
    settingsMgr.setSetting('custom_pools', custom_pools);

    const poolAvailableIndex = available_pools.findIndex(x => x.id === id);
    available_pools.splice(poolAvailableIndex, 1);

    const poolEditingIndex = editing_mining_config.pools.findIndex(x => x.id === id);
    editing_mining_config.pools.splice(poolEditingIndex, 1);

    // Remove custom pool from all mining configurations.
    let foundInActiveConfig = false;
    mining_configs.forEach(config => {
        const poolIndex = config.pools.findIndex(x => x.id === id);
        config.pools.splice(poolIndex, 1);

        if (config.active && poolIndex > -1) {
            foundInActiveConfig = true;
        }
    });
    settingsMgr.setSetting('mining_configs', mining_configs);

    active_mining_config = mining_configs.find(x => x.active === true);

    // Pool has been removed the active configuration. Restart mining process.
    if (foundInActiveConfig && miningStatus !== MiningStatus.Inactive) {
        updateMiningConfiguration();
        loadConfiguration();
        
        stopMining();

        // Timeout required on Windows
        setTimeout(() => {
            startMining();
        }, 1000);
    }
}

[el.poolListAvailable, el.poolListSelected].forEach(poolList => {
    poolList.addEventListener('click', e => {
        if (e.target && e.target.closest('.settings')) {
            editCustomPool(e.target.closest('.list-item').dataset.id);
        }
    });
});

function editCustomPool(id) {
    const pool = available_pools.find(x => x.id === id);

    el.hdnCustomPool_Id.value = pool.id;
    el.ddlCustomPool_Pool.value = pool.name;
    el.txtCustomPool_Label.value = pool.label;
    el.txtCustomPool_URL.value = pool.url;
    el.btnDeleteCustomPoolSettings.classList.remove('d-none');

    toggleModal('.custom-pool-settings-modal');
}

ipcRenderer.on('cpu-data', (event,data) => {
    cpuThreadCount = data.cores;

    el.statThreads.querySelector('span:nth-child(2)').innerHTML = cpuThreadCount;
    el.txtSettingsThreads_Count.innerHTML = cpuThreadCount; 
});
