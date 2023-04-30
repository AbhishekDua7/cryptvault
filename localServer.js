const config = require('./config/config1');
const path = require('path');
const express = require('express');
const app = express();

const generateOAuth = (req, res, next) => {
    config.generateAuth();
    res.redirect(config.loginURL);
    next();
}

const getCode = (req, res, next) => {
    let code = null;
    const index = req.originalUrl.indexOf("=");
    console.log('\n Code = '+req.originalUrl+'\n');
    if (req.originalUrl.indexOf("?code=") != -1) {
        code = req.originalUrl.slice(index + 1, req.originalUrl.length);
        config.setCode(decodeURIComponent(code));
        console.log('\n DeCode = '+decodeURIComponent(code)+'\n');
    } else {
        res.redirect(config.paths.login);
        //TUDO: Error message when Google does not return 
        return;
    }
    return
}

function launchServer() {
    //Use public directory - required if we want to serve styles/js in seperate sub-directories
    app.use(express.static(path.join(__dirname, 'public')));
    //Root
    app.use('/', express.static(path.join(__dirname, 'public', 'pages')));
    //Custom middleware on GET request to Google sign on
    app.get(config.paths.login, generateOAuth);
    app.get(config.paths.direct, (req, res, next) => {
        getCode(req,res,next);
        config.generateToken(next);
    }, (req, res, next) => {
        //On Successful token generation, direct to drive page
        res.redirect(config.paths.drive);
        next();
    });
    //app.get('/drive', getCode);
    //Set path aliases for other pages
    //app.use('/login', express.static(path.join(__dirname, 'public', 'pages/login.html')));
    app.use(config.paths.drive, express.static(path.join(__dirname, 'public', 'pages' + config.paths.drive + '.html')));

    app.listen(config.port, (/* req, res */) => {
        console.log('\033c');
        console.log('\x1b[34m', 'Local Server running on ' + config.url, '\x1b[0m');
    });
}

var ipc = require('electron').ipcMain;
ipc.on('invokeAction', (event, data) => {
    function sendData(data) {
        console.log(data[0][0]);
        console.log('Run Good');
        event.sender.send('actionReply', data);
    }
    console.log('Listing files');
    config.listFiles(sendData, event);
    //config.listPublicFiles(sendData, event);
});

ipc.on('VerifyPassword', (event, data) => {
   // console.log('Recvd='+data);
    function sendData(data2) {
       console.log('VerifyPasswordReply');
      //  console.log('Run Good');
        event.sender.send('VerifyPasswordReply', data2);
    }
   // config.uploadprivatesaltandiv();
   //let dataToPrint = config.decryptFileDataUsingKey(config.getKeyFromPublicSalt(data[0]));
   // console.log('Key generated = '+ Object.keys(dataToPrint) +'\n'+ Object.values(dataToPrint));
    config.verifyPasswordEvent(data, sendData, event)
})

ipc.on('GetUserDataForKeysEvent', (event, data) => {
    // console.log('Recvd='+data);
     function sendData(data2) {
        console.log('GetUserDataForKeysEvent');
       //  console.log('Run Good');
         event.sender.send('GetUserDataForKeysReply', data2);
     }
    // config.uploadprivatesaltandiv();
     config.decryptedDataForKeysEvent(data, sendData, event)
 })

 ipc.on('SaveUserDataForKeysEvent', (event, data) => {
    // console.log('Recvd='+data);
     function sendData(data2) {
        console.log('SaveUserDataForKeysEvent');
       //  console.log('Run Good');
         event.sender.send('SaveUserDataForKeysReply', data2);
     }
     config.encryptDataForKeysEvent(data, sendData, event)
 })

 ipc.on('getKey', (event, data) => {
    console.log("Inside get key");
    console.log(data);
    key  = config.getKeyFromPublicSalt(data);
    console.log("Original key = " + key)
    console.log('length of key' + key.length);
    event.sender.send('getKeyReply', key);
 })

ipc.on('decrypt', (event, data) => {
    console.log("data " + data + " " + data.length);
    console.log(Buffer.from(data, 'binary'));
    decryptedData = config.decryptFileDataUsingKey(data);
    console.log('decdata' +" SSN : "+ decryptedData['SSN'] + ", Acc No. : " + decryptedData['Account Number']);
    event.sender.send('decryptReply', decryptedData);
});


ipc.on('driveAction', (event, data) => {
    if(data[0].toUpperCase == 'DELETE'.toUpperCase)
        config.deleteFile(data[1], () => { config.windows.win.reload();});
    else
        console.log('Unidentified Action')
});

module.exports.launchServer = launchServer;



