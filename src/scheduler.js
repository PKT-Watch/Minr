const { ipcRenderer } = require('electron');
const settingsMgr = require('./settings-mgr');

const el = {
    //overlay: document.querySelector('.overlay'),
    //settingsModals: document.querySelectorAll('.settings-modal'),
    taskSettingsModal: document.querySelector('.task-settings-modal'),
    scheduleSettingsModal: document.querySelector('.schedule-settings-modal'),
    txtTaskSettings_Time: document.querySelector('#txtTaskSettings_Time'),
    ddlTaskSettings_MiningConfigs: document.querySelector('#ddlTaskSettings_MiningConfigs'),
    btnTaskSettings_Save: document.querySelector('#btnTaskSettings_Save'),
    btnTaskSettings_Delete: document.querySelector('#btnTaskSettings_Delete'),
    btnOpenScheduleSettings: document.querySelector('#btnOpenScheduleSettings'),
    //trashDrop: document.querySelector('.trash-drop'),
    clearDayTasksControls: document.querySelectorAll('.clear-day-tasks'),
    dayTaskLists: document.querySelectorAll('.scheduler .days .day .task-list')
}

let activeTask = {
    id: null,
    task: null,
    time: null,
    configName: null,
    configId: null
};

Sortable.create(document.querySelector('.scheduler .taskbar .draggable-list'), {
    animation: 200,
    group: {
        name: "shared",
        pull: "clone",
        put: false,
        revertClone: true,
    },
    sort: false 
});

let sortableDays = [];

el.dayTaskLists.forEach(eventsList => {
    let sortable = Sortable.create(eventsList, {
        group: {
            name: "days",
            put: true,
            pull: function (to, from) {
                if (to.el.classList.contains('day-tasks')) {
                    return 'clone';
                }

                if (to.el.classList.contains('trash-drop')) {
                    return true;
                }

                return false;
            }
        },
        sort: false,
        onAdd: function (e) {
            let taskData = {
                task: e.item.dataset.task,
                taskId: Date.now(),
                taskTime: '--:--',
                configName: '',
                configId: -1,
                isClone: false
            };

            // e.to & e.from are HtmlElement. We need to hack our way
            // to the underlying object to access the group name
            let fromKey = Object.keys(e.from)[0];
            let toKey = Object.keys(e.to)[0];

            if (e.from[fromKey].options.group.name === e.to[toKey].options.group.name) {
                taskData.isClone = true;
                taskData.taskTime = e.item.dataset.taskTime;
                taskData.configName = (e.item.dataset.disabled != 'false' ? 'DISABLED' : e.item.dataset.configName),
                taskData.configId = e.item.dataset.configId;
                taskData.disabled = (e.item.dataset.disabled != 'false');
            }

            let taskEl = createTaskElement(taskData);

            e.item.replaceWith(taskEl);

            if (taskData.isClone) {
                sortTasks();
                getSchedule();
            } else {
                activeTask.id = taskData.taskId;
                activeTask.task = taskData.task;
                if (taskData.task === 'mining-stop') {
                    document.querySelector('#task-settings-mining-configs').classList.add('d-none');
                } else {
                    document.querySelector('#task-settings-mining-configs').classList.remove('d-none');
                }

                toggleModal('.task-settings-modal');
            }
            
        }
    });
    sortableDays.push(sortable);

    eventsList.addEventListener('click', e => {
        if (e.target && e.target.closest('.list-item')) {
            let taskEl = e.target.closest('.list-item');

            if (e.target.closest('.controls')) {
                activeTask.id = taskEl.dataset.id;
                activeTask.task = taskEl.dataset.task;
                activeTask.time = taskEl.dataset.taskTime;
                if (taskEl.dataset.configName) {
                    activeTask.configName = taskEl.dataset.configName;
                    activeTask.configId = taskEl.dataset.configId;
                    el.ddlTaskSettings_MiningConfigs.value = taskEl.dataset.configId;
                    document.querySelector('#task-settings-mining-configs').classList.remove('d-none');
                } else {
                    activeTask.configName = null;
                    activeTask.configId = null;
                    document.querySelector('#task-settings-mining-configs').classList.add('d-none');
                }
                el.txtTaskSettings_Time.value = taskEl.dataset.taskTime;

                toggleModal('.task-settings-modal');
            }
        }
    });
});

function createTaskElement(taskData) {
    let taskEl;

    switch (taskData.task) {
        case 'mining-start':
            taskEl = htmlToElement(`
                <div class="list-item" data-id="${taskData.taskId}" data-task="${taskData.task}" data-task-time="${taskData.taskTime}" data-config-name="${taskData.configName}" data-config-id="${taskData.configId}" data-disabled="${taskData.disabled ? true : false}">
                    <div class="body">
                        <div class="task-title"><svg class="icon text-success"><use href="#svg-play-arrow"></use></svg> Start</div>
                        <div class="controls"><svg class="icon"><use href="#svg-tune"></use></svg></div>
                    </div>
                    <div class="meta">
                        <span class="task-time">${taskData.taskTime}</span>
                        <span class="config-name">${taskData.configName}</span>
                    </div>
                </div>
            `);
            break;

        case 'mining-stop':
            taskEl = htmlToElement(`
                <div class="list-item" ${taskData.disabled ? 'disabled' : ''}"" data-id="${taskData.taskId}" data-task="${taskData.task}" data-task-time="${taskData.taskTime}" data-disabled="${taskData.disabled ? true : false}">
                    <div class="body">
                        <div class="task-title"><svg class="icon text-danger"><use href="#svg-stop"></use></svg> Stop</div>
                        <div class="controls"><svg class="icon"><use href="#svg-tune"></use></svg></div>
                    </div>
                    <div class="meta"><span class="task-time">${taskData.taskTime}</span></div>
                </div>
            `);
            break;

        case 'configuration-change':
            taskEl = htmlToElement(`
                <div class="list-item" data-id="${taskData.taskId}" data-task="${taskData.task}" data-task-time="${taskData.taskTime}" data-config-name="${taskData.configName}" data-config-id="${taskData.configId}" data-disabled="${taskData.disabled ? true : false}">
                    <div class="body">
                        <div class="task-title"><svg class="icon text-warning"><use href="#svg-swap-vert"></use></svg> Change</div>
                        <div class="controls"><svg class="icon"><use href="#svg-tune"></use></svg></div>
                    </div>
                    <div class="meta">
                        <span class="task-time">${taskData.taskTime}</span>
                        <span class="config-name">${taskData.configName}</span>
                    </div>
                </div>
            `);
            break;
    
        default:
            break;
    }

    return taskEl;
}

function hasSchedule() {
    let schedule = settingsMgr.getSetting('schedule', []);
    let hasScheduledTasks = false;

    schedule.forEach(day => {
        if (day.length) hasScheduledTasks = true;
    });

    return hasScheduledTasks;
}
exports.hasSchedule = hasSchedule;

function getSchedule() {
    let index = 0;
    let schedule = [];
    document.querySelectorAll('.scheduler .day').forEach(day => {
        let daySchedule = [];

        day.querySelectorAll('.list-item').forEach(task => {
            daySchedule.push({
                id: task.dataset.id,
                name: task.dataset.task,
                time: task.dataset.taskTime,
                configName: task.dataset.configName ? task.dataset.configName : null,
                configId: task.dataset.configId ? parseInt(task.dataset.configId) : null,
                disabled: (task.dataset.disabled != 'false')
            });
        });

        schedule.push(daySchedule);

        index++;
    });

    settingsMgr.setSetting('schedule', schedule);
    ipcRenderer.send('scheduler-initialise', '');

    return schedule;
}
exports.getSchedule = getSchedule;

function buildSchedule() {
    let schedule = settingsMgr.getSetting('schedule', []);

    for (let i = 0; i < schedule.length; i++) {
        el.dayTaskLists[i].innerHTML = '';

        schedule[i].forEach(task => {
            const taskData = {
                taskId: task.id,
                task: task.name,
                taskTime: task.time,
                configName: (task.disabled ? 'DISABLED' : task.configName),
                configId: task.configId,
                disabled: task.disabled
            }
            const taskEl = createTaskElement(taskData);
            el.dayTaskLists[i].insertAdjacentElement('beforeend', taskEl);
        }); 
    }
}
exports.buildSchedule = buildSchedule;
buildSchedule();

function sortTasks() {
    for (let i=0; i<sortableDays.length; i++) {
        sortDayTasks(i);
    }
}

function sortDayTasks(dayIndex) {
    let tasks = [];
    document.querySelectorAll(`.scheduler .day:nth-child(${dayIndex+1}) .list-item`).forEach(task => {
        tasks.push({
            id: task.dataset.id,
            time: task.dataset.taskTime
        });
    });

    function compare(a, b) {
        if (a.time > b.time) return 1;
        if (a.time < b.time) return -1;
        return 0;
    }

    tasks.sort(compare);

    const sortedTasks = tasks.map(task => task.id);

    sortableDays[dayIndex].sort(sortedTasks);

    return sortedTasks;
}

el.btnTaskSettings_Save.addEventListener('click', e => {
    const taskTime = el.txtTaskSettings_Time.value;
    const taskId =  activeTask.id;
    let configName = el.ddlTaskSettings_MiningConfigs.options[el.ddlTaskSettings_MiningConfigs.selectedIndex].text;
    let configId = el.ddlTaskSettings_MiningConfigs.value;
    let listItem = document.querySelector(`.list-item[data-id="${taskId}"]`);

    switch (activeTask.task) {
        case 'mining-start':
            listItem.querySelector('.config-name').innerHTML = configName;
            listItem.dataset.configName = configName;
            listItem.dataset.configId = configId;
            break;

        case 'mining-stop':
            
            break;

        case 'configuration-change':
            listItem.querySelector('.config-name').innerHTML = configName; 
            listItem.dataset.configName = configName;
            listItem.dataset.configId = configId;
            break;
    
        default:
            break;
    }

    listItem.dataset.taskTime = taskTime;
    listItem.querySelector('.task-time').innerHTML = taskTime;

    el.txtTaskSettings_Time.value = '00:00';

    sortTasks();
    getSchedule();
    toggleModal('.task-settings-modal');
});

el.btnTaskSettings_Delete.addEventListener('click', e => {
    document.querySelector(`.list-item[data-id="${activeTask.id}"]`).remove();
    getSchedule();
    toggleModal('.task-settings-modal');
});

el.btnOpenScheduleSettings.addEventListener('click', e => {
    toggleModal('.schedule-settings-modal');
});

function openTaskOptions(el) {
    el.btnTaskSettings_Save.dataset.taskId = el.dataset.id;
}

function htmlToElement(html) {
    var template = document.createElement('template');
    html = html.trim(); // Never return a text node of whitespace as the result
    template.innerHTML = html;
    return template.content.firstChild;
}

function loadMiningConfigurations() {
    let miningConfigs = settingsMgr.getSetting('mining_configs');

    el.ddlTaskSettings_MiningConfigs.innerHTML = '';

    miningConfigs.forEach(config => {
        el.ddlTaskSettings_MiningConfigs.insertAdjacentHTML('beforeend', `
            <option value="${config.id}">${config.config_name}</option>
        `);
    });
}
exports.loadMiningConfigurations = loadMiningConfigurations;
loadMiningConfigurations();

el.clearDayTasksControls.forEach(control => {
    control.addEventListener('click', e => {
        control.closest('.day').querySelector('.task-list').innerHTML = '';
        getSchedule();
    });
});