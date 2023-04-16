'use strict'

const path = require('path');
//const {app, BrowserWindow, ipcMain} = require('electron');
const {app, BrowserWindow} = require('electron');

const {launchServer} = require('./localServer');
const config = require('./config/config');
let win = null;

function launchApp(){
    win = new BrowserWindow(config.winConfig);
    config.windows.win = win;

    //Start local server; needed for login redirect
    //TUDO: Am I using Async correct here?
    try { 
        //Browser Cache keeps pages from updating sometimes
        //Clear cache before launching server
        win.webContents.session.clearCache(() => { console.log('+ Cleared Browser Cache +'); } );
        launchServer();
    }
    catch(e) { 
        console.log('Failed to initialize application:\n' + e); 
        app.quit();
        process.exit();
    }

    //win loads application address
    win.loadURL(config.url);

    // //Handle redirection requests
    // win.webContents.on('will-navigate', (event, url) => {
    //     console.log('++redirect request: ' + url);
    //     //win.loadURL(url);
    // });
    
    //Graceful display of renderer window
    win.once('ready-to-show', () => {
        win.show();
    })
}

//Launch app on ready
app.on('ready', launchApp);

//Exit process when user closes all GUI
app.on('window-all-closed', () => {
    app.quit();
});