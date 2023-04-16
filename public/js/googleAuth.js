const config = require('../../config/config');
const {google} = require('googleapis');

function newAuthRequest() {
    return new google.auth.OAuth2(
        config.clientID,
        config.clientSecret,
        config.url
    );
}

function getURL(auth) {
    return auth.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: config.scopes
    });
}

function authRequest() {
    const auth = newAuthRequest();
    const url = getURL(auth);
    console.log('GOOGLE AUTH URL: ' + url);
    return url;
}

authRequest();