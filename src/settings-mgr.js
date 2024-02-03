const Store = require('electron-store');

const store = new Store();

exports.setSetting = (name, value) => {
    store.set(name, value);
}

exports.getSetting = (name, defaultValue) => {
    if (typeof defaultValue !== 'undefined') {
        return store.get(name, defaultValue);
    }
    return store.get(name)
}

exports.deleteSetting = (name) => {
    store.delete(name);
}

exports.clearSettings = () => {
    store.clear();
}

exports.saveSettings = (settings) => {
    if (settings.packetcrypt_path) {
        store.set('packetcrypt_path', settings.packetcrypt_path);
    }
    store.set('packetcrypt_in_path', settings.packetcrypt_in_path);
}

exports.saveMiningConfiguration = (config) => {
    let mining_configs = store.get('mining_configs', []);
    mining_configs.push(config);

    store.set('mining_configs', mining_configs);
}

exports.loadMiningConfiguration = () => {
    let mining_configs = store.get('mining_configs', []);

    const miningConfig = mining_configs.find(x => x.active === true);
    miningConfig.packetcrypt_path = store.get('packetcrypt_path', '');
    miningConfig.packetcrypt_in_path = store.get('packetcrypt_in_path', false);

    return miningConfig;
}