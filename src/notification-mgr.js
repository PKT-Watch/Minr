const { ipcRenderer } = require('electron');

const NotificationType = {
    NetworkError: 'NetworkError',
    PoolDifficultyUpdate: 'PoolDifficultyUpdate',
    AppUpdateAvailable: 'AppUpdateAvailable'
}
exports.NotificationType = NotificationType;

const NotificationAction = {
    UpdateApp: 'UpdateApp'
}

const notificationContainerEl = document.querySelector('#notifications-container .notifications');

exports.createNotification = (notificationType) => {
    let notificationClass = '';
    let notificationMessage = '';
    let notificationAction = '';
    let dismissible = true;

    switch (notificationType) {
        case NotificationType.NetworkError:
            notificationClass = 'notification-error';
            notificationMessage = 'Network error. Please check your internet connection.';
            dismissible = false;
            break;

        case NotificationType.PoolDifficultyUpdate:
            notificationClass = 'notification-warning';
            notificationMessage = 'A pool has updated its mining difficulty. This may effect your bandwidth usage.';
            break;

        case NotificationType.AppUpdateAvailable:
            notificationClass = 'notification-warning';
            notificationMessage = 'There is a newer version of Minr is ready to install. Click here to relaunch.';
            notificationAction = NotificationAction.UpdateApp;
            dismissible = false;         
            break;

        default:
            break;
    }

    if (notificationContainerEl.querySelector(`.${notificationClass}`)) return;

    const template = document.createElement('template');
    template.innerHTML = `<li class="notification ${notificationClass} ${dismissible ? 'dismissible' : ''}">${notificationMessage}${dismissible ? '<span class="close"></span>' : ''}</li>`;
    const notificationEl = template.content.firstChild;

    bindAction(notificationEl, notificationAction);

    notificationContainerEl.insertAdjacentElement('beforeend', notificationEl);

    return notificationEl;
};

exports.clearNotificationsByType = (notificationType) => {
    let notifications = [];
    switch (notificationType) {
        case NotificationType.NetworkError:
            notifications = notificationContainerEl.querySelectorAll('.notification-error');
            break;
    
        default:
            break;
    }

    notifications.forEach(el => {
        el.remove();
    });
};

function bindAction(notificationEl, notificationAction) {
    switch (notificationAction) {
        case NotificationAction.UpdateApp:
            notificationEl.addEventListener('click', e => {
                ipcRenderer.send('update-app');
            });
            break;
        default:
            break;
    }
}

notificationContainerEl.addEventListener('click', e => {
    if (e.target && e.target.closest('.close')) {
        e.target.closest('.notification').remove();
    }
});