const { ipcRenderer } = require('electron');
const settingsMgr = require('./settings-mgr');

let settingsVersion = settingsMgr.getSetting('settings-version', 0);

if (!settingsVersion > 0) {
    settingsMgr.clearSettings();
}

let selectedColorMode = settingsMgr.getSetting('color_mode', 'light');
ipcRenderer.send('color-mode', selectedColorMode);

fetch('https://api.pkt.watch/v1/pool/list/')
.then(res => {
    if (res.status === 200) {
        return res.json(); 
    }
})
.then(pools => {
    pools.forEach(pool => {
        pool.nice_diff = pool.diff;

        if (pool.diff > 10000) {
            pool.nice_diff = `${parseInt(pool.diff / 1000)}k`
        }
    });

    // TO REMOVE IN LATER VERSION
    // Remove http://pool.pkt.world/master/4096 & http://pool.pktpool.io/diff/8192 from available pools
    pools = pools.filter(function( obj ) {
        return obj.id !== '5f07b88b-6635-4be1-bdd0-2cb9f869c21c' && obj.id !== '87ed9ddd-e66c-459a-b50b-f865ee6d0e50';
    });

    settingsMgr.setSetting('available_pools', pools);
    settingsMgr.setSetting('pools_loaded_date', new Date());

    if (settingsVersion === 1) {
        migrateDelistedPoolsToCustomPools();
        settingsMgr.setSetting('hide_cpu_temp', false);
    }

    settingsMgr.setSetting('settings-version', 2);

    setTimeout(() => {
        if (settingsMgr.getSetting('onboard_complete', false)) {
            window.location = 'index.html';
        } else {
            window.location = 'welcome.html';
        }
    }, 5000);
})

function migrateDelistedPoolsToCustomPools() {
    const mining_configs = settingsMgr.getSetting('mining_configs', []);
    const custom_pools = settingsMgr.getSetting('custom_pools', []);

    let customPoolTemplates = [
        {
            "id": "5f07b88b-6635-4be1-bdd0-2cb9f869c21c",
			"name": "Pkt Pool",
			"label": "Fixed diff 8192",
			"url": "http://pool.pktpool.io/diff/8192",
			"diff": -1,
			"nice_diff": "????",
			"goodrate": 0,
			"user_added": true
        },
        {
            "id": "87ed9ddd-e66c-459a-b50b-f865ee6d0e50",
			"name": "Pkt World",
			"label": "Fixed diff 4096",
			"url": "http://pool.pkt.world/master/4096",
			"diff": -1,
			"nice_diff": "????",
			"goodrate": 0,
			"user_added": true
        }
    ]

    // Check if the delisted pools are being used in a configuration
    // If they are, create a custom pool and replace within the configuration.
    // If not, they will be removed.
    mining_configs.forEach(config => {
        config.pools.forEach((pool, i, arr) => {
            if(!pool.user_added) {
                if (pool.id === '5f07b88b-6635-4be1-bdd0-2cb9f869c21c') {
                    if (!custom_pools.find(el => el.id === '5f07b88b-6635-4be1-bdd0-2cb9f869c21c')) {
                        custom_pools.push(customPoolTemplates[0]);
                    }
                    arr[i] = customPoolTemplates[0];
                } else if (pool.id === '87ed9ddd-e66c-459a-b50b-f865ee6d0e50') {
                    if (!custom_pools.find(el => el.id === '87ed9ddd-e66c-459a-b50b-f865ee6d0e50')) {
                        custom_pools.push(customPoolTemplates[1]);
                    }
                    arr[i] = customPoolTemplates[1];
                }
            }
            
        });
    });

    settingsMgr.setSetting('mining_configs', mining_configs);
    settingsMgr.setSetting('custom_pools', custom_pools);
}