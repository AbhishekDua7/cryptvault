var ipc = require('electron').ipcRenderer;
const {google} = require('googleapis');
const fs = require('fs');
const crypto = require('crypto');
var folder;
var publicfolder;
var event;
var justUploaded = [];
var justDownloaded = [];
var userPassword = 'vishakha';
const rounds = 16;
const saltkeyFilePath = './Documents/.saltkey'
const saltkeyFileName = '.saltkey'

// TUDO: Do we want to make this a stateful configuration? I was thinking maybe
// we can store accounts here?
class Config {
  constructor() {
    // Backend
    this.address = 'localhost';
    this.port = '3000';
    this.url = 'http://' + this.address + ':' + this.port;
    // Google API
    this.auth = null;
    this.clientID =
        '885529305581-m0ft4c8fseabf3armsmsnb26stt4qo5s.apps.googleusercontent.com';
    this.clientSecret = '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';
    this.clientCode = '';
    this.clientToken = null;

    // local web paths
    this.paths =
        {index: '/index', drive: '/drive', login: '/login', direct: '/direct'};

    // Google Auth
    this.scopes = ['https://www.googleapis.com/auth/drive','https://www.googleapis.com/auth/drive.appfolder'];
    this.urlRedirect = this.url + this.paths.direct;
    this.loginURL = null;

    // Main Window configuration
    this.winConfig = {
      width: 750,
      height: 800,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    }
                     // BrowserWindow Object  S-Linking? TUDO
                     this.windows = {
      win: null
    }
  }

  // Get/Set client code sent by Google
  setCode(code) {
    this.clientCode = code
  }
  getCode() {
    return this.clientCode
  }

  // Generate an Auth request url from Google Api Console
  generateAuth() {
    this.auth = new google.auth.OAuth2(
        this.clientID, this.clientSecret, this.urlRedirect);
    let url = this.auth.generateAuthUrl(
        {access_type: 'offline', prompt: 'consent', scope: this.scopes});
    this.loginURL = url;
   
  }

  generateToken(callback) {
     console.log(this.clientCode);
    this.auth.getToken( this.clientCode, (err, token) => {
      if (err)
        return console.error('Error retrieving token: ' + err+' '+err.result);
      else {
        this.auth.credentials = token;
        this.clientToken = token;
        callback();
      }
    });
  }

  listPublicFiles(callback, eventVal) {
    // Test Output
    event = eventVal;
    const drive = google.drive({version: 'v3', auth: this.auth});
    publicfolder = [];
    console.log('\n Reached public list files function\n');
    drive.files.list(
        {
          pageSize: 50,
          fields: 'nextPageToken, files(id, name)'
        },
        (err, res) => {
          if (err) {
            console.log('Error getting drive listing' + err);
            return;
          }
          const response = res.data.files;
          if (response.length) {
            console.log('Files:\n-----------------------------------------');
            response.map((file) => {
              console.log(`${file.name} : (${file.id})`);
              publicfolder.push([file.name, file.id]);
            });
            callback(publicfolder);
          } else {
            console.log('No Files :(');
          }
          this.handlePublicCloud();
          this.handlePublicDocuments();
        });
  }

  listFiles(callback, eventVal) {
    // Test Output
    event = eventVal;
    const drive = google.drive({version: 'v3', auth: this.auth});
    folder = [];
    console.log('\n Reached list files function\n');
    drive.files.list(
        {
          spaces: 'appDataFolder',
          pageSize: 50,
          fields: 'nextPageToken, files(id, name)'
        },
        (err, res) => {
          if (err) {
            console.log('Error getting drive listing' + err);
            return;
          }
          const response = res.data.files;
          if (response.length) {
            console.log('Files:\n-----------------------------------------');
            response.map((file) => {
              console.log(`${file.name} : (${file.id})`);
              folder.push([file.name, file.id]);
            });
           // callback(folder);
          } else {
            console.log('No Files :(');
          }
          this.handleCloud();
          this.handleDocuments();
        });
  }

  handlePublicCloud() {
    console.log('HANDLE PUBLIC CLOUD RUNNING')
    var self = this;
    // one initial get - only need to download files that are newer than
    // whats on disk last update timestamp will be stored on disk in
    // .timestamp file we will use that to only download new content
    const drive = google.drive({version: 'v3', auth: this.auth});



    // read timestamp file - if it doesnt exist assume its way in past (fresh
    // install - download everything)

    fs.stat('.publictimestamp', function(err, stats) {
      if (err) {
        if (err.code == 'ENOENT') {  // if file doesnt exist
          console.log('PUBLIC TIMESTAMP DOESNT EXIST - CREATING')
          // then we need to create it and download everything
          drive.changes.getStartPageToken({}, function(err, res) {
            console.log('Start token:', res.data.startPageToken);
            console.dir(res)
            fs.writeFile('.publictimestamp', res.data.startPageToken, function(err) {
              if (err) throw err
                // timestamp created - download all cloud files to disk and
                // decrypt them
                console.log(
                    'Public Timestamp did not exist on disk - Downloading all files to get synced with cloud.')
                for (let obj of publicfolder) {
                  self.downloadpublicfile(obj[1])
                }
            })
          });

        } else {
          console.log(err)
          console.log('fatal err')
          throw err
        }
      } else {
        console.log('PUBLIC FILE EXISTS - READING')
        fs.readFile('.publictimestamp', function(err, rawfilecontents) {
          if (err) {
            console.log(err)
            console.log('fatal error reading file that should exist')
            throw err
          }
          // now we have the timestamp
          console.log('publictimestamp ' + rawfilecontents)

          // get changes
          drive.changes.list(
              { pageToken: rawfilecontents.toString()},
              (err, res) => {
                if (err) {
                  console.log('Error getting changed files ' + err);
                  return;
                }
                // const response = res.data.files;
                // console.log('got a list of file changes:')
                // console.dir(res)
                let newversion = res.data.newStartPageToken
                console.log('new cloud version ' + newversion)
                fs.writeFile(
                    '.publictimestamp', new Buffer(res.data.newStartPageToken),
                    function(err) {
                      if (err) throw err
                        console.log(
                            res.data.changes.length.toString() +
                            ' files have changed since we last checked')
                        // console.log('individual changes:')
                        // console.dir(res.data.changes)
                        for (let change of res.data.changes) {
                          // console.dir(change)
                          if (!change.removed) {
                            console.log(
                                'Cloud copy of ' + change.file.name +
                                ' is newer - downloading')
                            self.downloadpublicfile(change.fileId)
                          }
                        }
                    })
              })
        })
      }
    })
  }

  handleCloud() {
    console.log('HANDLECLOUD RUNNING')
    var self = this;
    // one initial get - only need to download files that are newer than
    // whats on disk last update timestamp will be stored on disk in
    // .timestamp file we will use that to only download new content
    const drive = google.drive({version: 'v3', auth: this.auth});



    // read timestamp file - if it doesnt exist assume its way in past (fresh
    // install - download everything)

    fs.stat('.timestamp', function(err, stats) {
      if (err) {
        if (err.code == 'ENOENT') {  // if file doesnt exist
          console.log('TIMESTAMP DOESNT EXIST - CREATING')
          // then we need to create it and download everything
          drive.changes.getStartPageToken({}, function(err, res) {
            console.log('Start token:', res.data.startPageToken);
            console.dir(res)
            fs.writeFile('.timestamp', res.data.startPageToken, function(err) {
              if (err) throw err
                // timestamp created - download all cloud files to disk and
                // decrypt them
                console.log(
                    'Timestamp did not exist on disk - Downloading all files to get synced with cloud.')
                for (let obj of folder) {
                  self.downloadplainfile(obj[1])
                }
            })
          });

        } else {
          console.log(err)
          console.log('fatal err')
          throw err
        }
      } else {
        console.log('FILE EXISTS - READING')
        fs.readFile('.timestamp', function(err, rawfilecontents) {
          if (err) {
            console.log(err)
            console.log('fatal error reading file that should exist')
            throw err
          }
          // now we have the timestamp
          console.log('timestamp ' + rawfilecontents)

          // get changes
          drive.changes.list(
              {spaces: 'appDataFolder', pageToken: rawfilecontents.toString()},
              (err, res) => {
                if (err) {
                  console.log('Error getting changed files ' + err);
                  return;
                }
                // const response = res.data.files;
                // console.log('got a list of file changes:')
                // console.dir(res)
                let newversion = res.data.newStartPageToken
                let len = 0;
                if (newversion) {
                  len = newversion.length;
                }
                console.log('new cloud version ' + newversion)
                fs.writeFile(
                    '.timestamp',  Buffer.alloc(len,newversion),
                    function(err) {
                      if (err) throw err
                        console.log(
                            res.data.changes.length.toString() +
                            ' files have changed since we last checked')
                        // console.log('individual changes:')
                        // console.dir(res.data.changes)
                        for (let change of res.data.changes) {
                          // console.dir(change)
                          if (!change.removed) {
                            console.log(
                                'Cloud copy of ' + change.file.name +
                                ' is newer - downloading')
                            self.downloadplainfile(change.fileId)
                          }
                        }
                    })
              })
        })
      }
    })


    // after intial get - setup watching changes
    // watching changes
  }

  downloadpublicfile(fileid) {
    var self = this;
    const drive = google.drive({version: 'v3', auth: this.auth});

    drive.files
        .get({
          fileId: fileid,
          fields:
              'name, appProperties, createdTime, modifiedTime, modifiedByMeTime'

        })
        .then(function(file) {
          justDownloaded.push(file.data.name)
          console.log('Downloaded: ' + file.data.name);
          // console.dir(file)
          let iv = Buffer.from(file.data.appProperties.IV, 'base64')
          let timestamp = file.data.modifiedTime
          drive.files.get({fileId: fileid, alt: 'media'})
              .then(function(filewithdata) {
                console.log('ENCRYPTED PUBLIC FILE CONTENTS:')
                console.dir(filewithdata.data)
                self.getSecretKey('.datasaltkey',function(key) {
                  let decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
                  let cleartext =
                      decipher.update(filewithdata.data, 'binary', 'binary')
                  console.log('CLEARTEXT: ' + cleartext)
                  fs.writeFile(
                      './PublicDocuments/' + file.data.name, cleartext,
                      {encoding: 'binary'}, function(err) {
                        if (err) {
                          console.log('error writing to file ')
                          console.log('./PublicDocuments/' + file.data.name)
                          throw err
                        } else {
                          console.log('WRITTEN TO FILE')
                        }
                      })
                })
              })
              .catch(function(err) {
                console.log('Error during second download', err);
              })
        })
        .catch(function(err) {
          console.log('Error during download', err);
        })
  }

  downloadfile(fileid) {
    var self = this;
    const drive = google.drive({version: 'v3', auth: this.auth});

    drive.files
        .get({
          fileId: fileid,
          fields:
              'name, appProperties, createdTime, modifiedTime, modifiedByMeTime'

        })
        .then(function(file) {
          justDownloaded.push(file.data.name)
          console.log('Downloaded: ' + file.data.name);
          // console.dir(file)
          let iv = Buffer.from(file.data.appProperties.IV, 'base64')
          let timestamp = file.data.modifiedTime
          drive.files.get({fileId: fileid, alt: 'media'})
              .then(function(filewithdata) {
                console.log('ENCRYPTED FILE CONTENTS:')
                console.dir(filewithdata.data)
                self.getSecretKey('.saltkey',function(key) {
                  let decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
                  let cleartext =
                      decipher.update(filewithdata.data, 'binary', 'binary')
                  console.log('CLEARTEXT: ' + cleartext)
                  fs.writeFile(
                      './Documents/' + file.data.name, cleartext,
                      {encoding: 'binary'}, function(err) {
                        if (err) {
                          console.log('error writing to file ')
                          console.log('./Documents/' + file.data.name)
                          throw err
                        } else {
                          console.log('WRITTEN TO FILE')
                        }
                      })
                })
              })
              .catch(function(err) {
                console.log('Error during second download', err);
              })
        })
        .catch(function(err) {
          console.log('Error during download', err);
        })
  }

  downloadplainfile(fileid) {
    var self = this;
    const drive = google.drive({version: 'v3', auth: this.auth});

    drive.files
        .get({
          fileId: fileid,
          fields:
              'name, appProperties, createdTime, modifiedTime, modifiedByMeTime'

        })
        .then(function(file) {
          justDownloaded.push(file.data.name)
          console.log('Downloaded: ' + file.data.name);
          // console.dir(file)
          let iv = Buffer.from(file.data.appProperties.IV, 'base64')
          let timestamp = file.data.modifiedTime
          drive.files.get({fileId: fileid, alt: 'media'})
              .then(function(filewithdata) {
              //  console.log('ENCRYPTED FILE CONTENTS:')
                console.dir(filewithdata.data)
          //      self.getSecretKey('.saltkey',function(key) {
                
                  fs.writeFile(
                      './Documents/' + file.data.name, filewithdata.data,
                      {encoding: 'binary'}, function(err) {
                        if (err) {
                          console.log('error writing to file ')
                          console.log('./Documents/' + file.data.name)
                          throw err
                        } else {
                          console.log('WRITTEN TO FILE')
                        }
                      })
                })
           //   })
              .catch(function(err) {
                console.log('Error during second download', err);
              })
        })
        .catch(function(err) {
          console.log('Error during download', err);
        })
  }

  deleteFile(fileID, callback){
    const drive = google.drive({version: 'v3', auth: this.auth});
    drive.files.delete({fileId: fileID},
    (err) => {
      if (err){
        console.log('Error DELETING drive listing: ' + err);
        return;
      }
      callback();
    });
    
  }

  uploadpublicfile(fileName, ciphertext, iv, callback) {
    justUploaded.push(fileName)
    const drive = google.drive({version: 'v3', auth: this.auth});
    var fileId = '';
    var fileMetadata;
    var media = {mimeType: 'application/octet-stream', body: ciphertext};
    var i;
    for (i = 0; i < publicfolder.length; i++) {
      if (fileName == publicfolder[i][0]) {
        // console.log("Match: "+folder[i][0]);
        fileId = publicfolder[i][1];
        i = publicfolder.length;
      }
    }
    if (fileId != '') {
      fileMetadata = {
        'name': fileName,
        'appProperties': {'IV': Buffer.from(iv).toString('base64')}
      };
      console.log(fileId);
      drive.files.update(
          {fileId: fileId, resource: fileMetadata, media: media, fields: 'id'})
    } else {
      fileMetadata = {
        'name': fileName,
        'appProperties': {'IV': Buffer.from(iv).toString('base64')}
      };
      drive.files.create(
          {resource: fileMetadata, media: media, fields: 'id'},
          function(err, file) {
            if (err) {
              // Handle error
              console.error(err);
            } else {
              console.log(
                  'Uploaded file \"' + fileName + '\", File Id: ', file.id);
            }
          });
    }
    // Still need to attack the IV to the file
    callback()
  }

  uploadfile(fileName, ciphertext, iv, callback) {
    justUploaded.push(fileName)
    const drive = google.drive({version: 'v3', auth: this.auth});
    var fileId = '';
    var fileMetadata;
    var media = {mimeType: 'application/octet-stream', body: ciphertext};
    var i;
    for (i = 0; i < folder.length; i++) {
      if (fileName == folder[i][0]) {
        // console.log("Match: "+folder[i][0]);
        fileId = folder[i][1];
        i = folder.length;
      }
    }
    if (fileId != '') {
      fileMetadata = {
        'name': fileName,
        'appProperties': {'IV': Buffer.from(iv).toString('base64')}
      };
      console.log(fileId);
      drive.files.update(
          {fileId: fileId, resource: fileMetadata, media: media, fields: 'id'})
    } else {
      fileMetadata = {
        'name': fileName,
        'parents': ['appDataFolder'],
        'appProperties': {'IV': Buffer.from(iv).toString('base64')}
      };
      drive.files.create(
          {resource: fileMetadata, media: media, fields: 'id'},
          function(err, file) {
            if (err) {
              // Handle error
              console.error(err);
            } else {
              console.log(
                  'Uploaded file \"' + fileName + '\", File Id: ', file.id);
            }
          });
    }
    // Still need to attack the IV to the file
    callback()
  }

  uploadplainfile(fileName, cleartext, callback) {
    justUploaded.push(fileName)
    const drive = google.drive({version: 'v3', auth: this.auth});
    var fileId = '';
    var fileMetadata;
    var media = {mimeType: 'application/octet-stream', body: cleartext};
    var i;
    for (i = 0; i < folder.length; i++) {
      if (fileName == folder[i][0]) {
        // console.log("Match: "+folder[i][0]);
        fileId = folder[i][1];
        i = folder.length;
      }
    }
    if (fileId != '') {
      fileMetadata = {
        'name': fileName,
        'appProperties': {}
      };
      console.log(fileId);
      drive.files.update(
          {fileId: fileId, resource: fileMetadata, media: media, fields: 'id'})
    } else {
      fileMetadata = {
        'name': fileName,
        'parents': ['appDataFolder'],
        'appProperties': {}
      };
      drive.files.create(
          {resource: fileMetadata, media: media, fields: 'id'},
          function(err, file) {
            if (err) {
              // Handle error
              console.error(err);
            } else {
              console.log(
                  'Uploaded file \"' + fileName + '\", File Id: ', file.id);
            }
          });
    }
    // Still need to attach the IV to the file
    callback()
  }

  getSecretKeyOld(callback) {  // gets the symmetric key used to store unshared
                            // docs
    fs.stat('.secretkey', function(err, stats) {
      if (err) {
        if (err.code == 'ENOENT') {  // if key doesnt exist, make it
          let key = crypto.randomBytes(32)
          fs.writeFile('.secretkey', key, function(err) {
            if (err) throw err
          })
          return callback(key)
        } else
          throw err  // throw other errors
      }
      fs.readFile(
          '.secretkey',
          function(err, rawfilecontents) {  // if file exists read key
            if (err) throw err
              return callback(rawfilecontents)
          })
    })
  }

  getSecretKey(secretFileName,callback) {  // gets the symmetric key used to store unshared                        // docs
    const self = this;
    fs.stat(secretFileName, function(err, stats) {
      if (err) {
        if (err.code == 'ENOENT') {  // if key doesnt exist, make it
          let salt = crypto.randomBytes(32);
          let key = self.generateKeyUsingSalt(salt, userPassword);
          fs.writeFile(secretFileName, salt, function(err) {
            if (err) throw err
          })
          return callback(key)
        } else
          throw err  // throw other errors
      }
      fs.readFile(
          secretFileName,
          function(err, rawfilecontents) {  // if file exists read key
            if (err) throw err
              return callback(self.generateKeyUsingSalt(rawfilecontents, userPassword))
          })
    })
  }

 createDocumentSalt() {
  console.log('CREATING INITIAL SALT');
  fs.stat(saltkeyFilePath, function(err, stats) {
      if (err) {
        if (err.code == 'ENOENT') {  // if key doesnt exist, make it
          let salt = crypto.randomBytes(32);
          //let key = self.generateKeyUsingSalt(salt, userPassword);
          fs.writeFile(saltkeyFilePath, salt, function(err) {
            if (err) throw err
          })
          return
         // return callback(key)
        } else
          throw err  // throw other errors
      }
  })
}

  getSecretKeyForSalt(callback) {  // gets the symmetric key used to store unshared                        // docs
    const self = this;
    // fs.stat(secretFileName, function(err, stats) {
    //   if (err) {
    //     if (err.code == 'ENOENT') {  // if key doesnt exist, make it
    //       let salt = crypto.randomBytes(32);
    //       let key = self.generateKeyUsingSalt(salt, userPassword);
    //       fs.writeFile(secretFileName, salt, function(err) {
    //         if (err) throw err
    //       })
    //       return callback(key)
    //     } else
    //       throw err  // throw other errors
    //   }
      fs.readFile(
          saltkeyFilePath,
          function(err, rawfilecontents) {  // if file exists read key
            if (err) throw err
              return callback(self.generateKeyUsingSalt(rawfilecontents, userPassword))
          })
   // })
  }

  getEncryptedSalt(keySalt, pwd) {
    let key2 = generateKeyUsingSalt(keySalt, pwd);
    let iv = crypto.randomBytes(16)
    let cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    let ciphertext = cipher.update(rawfilecontents, 'binary', 'binary')

  }

  generateKeyUsingSalt(salt, pwd) {
    console.log("Entering Key geenration\ncreds=" + pwd + "\n salt = " + salt);
    const keyLength = 32; // 256-bit key for AES-256
    const hash = crypto.createHash('sha256');
    let xi = Buffer.alloc(keyLength, 0); // initialize x0 to a zero-filled buffer
    for (let i = 0; i < this.rounds; i++) {
      xi = hash
            .update(xi)
            .update(pwd)
            .update(salt)
            .digest();
      // xi = hash.update(Buffer.concat([xi, credentials, salt])).digest();
    }
    const K1 = xi; // the final value of xi is the first AES password
    //const K2 = crypto.randomBytes(keyLength); // generate a random key for the second password
    return K1;
  }

  shareFile(filename, user) {
    // download filename's key file of username user

    // download key sharing file

    // decrypt the symmetric key with your private key pair

    // fetch user's public key from the public key folder

    // encrypt symmetric key with user's public key

    // append to the filename's key file

    // overwrite key file with new key file
  }

  // encryptFileWithPath(fileNameWithPath) {
  //   let self = this;
  //   this.getSecretKey()
  // }

  encryptPublicFile(filename) {
    console.log("Entered Encrypt Public File");
    let self = this;  // so we can get `this` inside anonymous functions
    this.getSecretKeyForSalt(function(key2) {
      // todo use key2 to encrypt and read .encryptionkeys
      self.getSecretKey('.datasaltkey',function(key) {
      fs.readFile('./PublicDocuments/' + filename, function(err, rawfilecontents) {
        if (err) {
          console.log('error opening the file ./PublicDocuments/' + filename)
          console.dir(err)
          throw err
        }

        let iv = crypto.randomBytes(16)
        let cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
        let ciphertext = cipher.update(rawfilecontents, 'binary', 'binary')


        self.uploadpublicfile(filename, ciphertext, iv, function() {
          console.log('FINISHED AN UPLOAD')
        })

        // fs.mkdir("./.uploading", function () {
        //     fs.writeFile("./.uploading/" + filename + ".encrypted",
        //     ciphertext, { encoding: 'binary' }, function (err) {
        //         if (err) {
        //             console.log("error writing to file ")
        //             console.log("./.uploading/" + filename + ".encrypted")
        //             throw err
        //         }
        //     })
        //     console.log("IV for file " + filename + " is :")
        //     console.dir(iv)
        //     //TODO store IV somehow
        //     //we can store it on google drive with  "custom file properties",
        //     basically metadata
        //     https://developers.google.com/drive/api/v3/properties
        //     //but not sure how to get it to there?

        // })
      })
      })
  })
  }

  uploadFileToDocument(filename) {
    let self = this;  // so we can get `this` inside anonymous functions
   // this.getSecretKey('.saltkey',function(key2) {
    let stream = fs.createReadStream('./Documents/' + filename);
      // fs.readFile('./Documents/' + filename, function(err, rawfilecontents) {
      //   if (err) {
      //     console.log('error opening the file ./Documents/' + filename)
      //     console.dir(err)
      //     throw err
      //   }

        // let iv = crypto.randomBytes(16)
        // let cipher = crypto.createCipheriv('aes-256-gcm', key2, iv)
        // let ciphertext = cipher.update(rawfilecontents, 'binary', 'binary')


        self.uploadplainfile(filename,stream, function() {
          console.log('FINISHED AN UPLOAD')
        })

        // fs.mkdir("./.uploading", function () {
        //     fs.writeFile("./.uploading/" + filename + ".encrypted",
        //     ciphertext, { encoding: 'binary' }, function (err) {
        //         if (err) {
        //             console.log("error writing to file ")
        //             console.log("./.uploading/" + filename + ".encrypted")
        //             throw err
        //         }
        //     })
        //     console.log("IV for file " + filename + " is :")
        //     console.dir(iv)
        //     //TODO store IV somehow
        //     //we can store it on google drive with  "custom file properties",
        //     basically metadata
        //     https://developers.google.com/drive/api/v3/properties
        //     //but not sure how to get it to there?

        // })
     // })
   // })
  }

  handlePublicDocuments() {
    let self = this;  // so we can get `this` inside anonymous functions
    fs.mkdir('./PublicDocuments', function() {
      // this initial one-time read isnt recursive (yet)
      fs.readdir('./PublicDocuments', {withFileTypes: false}, function(err, files) {
        // get the encryption key and encrypt files
        for (var file of files) {
          // console.log(file)
          // open the file:
          // todo change here
          // todo add file check
          self.encryptPublicFile(file)
        }
        self.reload();
      })
      // setup watch on filedirectory
      console.log('Setup File watch!')
      var diskchanges = [];
      // var justDownloaded = [];  // re-empty this list just in case. only need
      // to track these while the watch-er is running.
      fs.watch('./PublicDocuments', {recursive: true}, function(eventname, filename) {
        console.log(
            'CHANGE DETECTED OF TYPE ' + eventname + ' ON FILE ' + filename)
        // change means file contents changed
        // rename means creation/deletion/rename
        if (eventname == 'change') {
          // These events always seem to be triggered twice. so we log them the
          // first time so that we can ignore them the second
          let wasjustchanged = false;
          let changedindex = -1;
          for (let i in diskchanges) {
            if (!wasjustchanged) {
              if (diskchanges[i] == filename) {
                wasjustchanged = true
                changedindex = i
              }
            }
          }

          if (wasjustchanged) {
            // ignoring the duplicate change
            console.log('duplicate change - ignored')
            diskchanges.splice(changedindex, 1)
          } else {
            diskchanges.push(filename)
            let wasjustdownloaded = false;
            let downloadindex = -1;
            for (let i in justDownloaded) {
              if (!wasjustdownloaded) {
                if (justDownloaded[i] == filename) {
                  wasjustdownloaded = true
                  downloadindex = i
                }
              }
            }
            if (wasjustdownloaded) {
              // remove from the list
              console.log(
                  'change detected but it was a file we just downloaded so lets ignore it')
              justDownloaded.splice(downloadindex, 1)
            } else {
              console.log('change detected and it seems to be legitimate')
              self.encryptPublicFile(
                  filename,
              )
            }
          }
        }
      })
    })
  }

  handleDocuments() {
    let self = this;  // so we can get `this` inside anonymous functions
    fs.mkdir('./Documents', function() {
      // this initial one-time read isnt recursive (yet)
      fs.readdir('./Documents', {withFileTypes: false}, function(err, files) {
        // get the encryption key and encrypt files
        var saltFileFound = false;
        for (var file of files) {
          // console.log(file)
          // open the file:
          if (file === saltkeyFileName) {
            self.uploadFileToDocument(file)
            saltFileFound = true;
          } 
        }
        if (!saltFileFound) {
          self.createDocumentSalt();
          self.uploadFileToDocument(saltkeyFileName);
        }
        self.reload();
      })
      // setup watch on filedirectory
      console.log('Setup File watch!')
      var diskchanges = [];
      // var justDownloaded = [];  // re-empty this list just in case. only need
      // to track these while the watch-er is running.
      fs.watch('./Documents', {recursive: true}, function(eventname, filename) {
        console.log(
            'CHANGE DETECTED OF TYPE ' + eventname + ' ON FILE ' + filename)
        // change means file contents changed
        // rename means creation/deletion/rename
        if (eventname == 'change' && filename === saltkeyFileName) {
          // These events always seem to be triggered twice. so we log them the
          // first time so that we can ignore them the second
          let wasjustchanged = false;
          let changedindex = -1;
          for (let i in diskchanges) {
            if (!wasjustchanged) {
              if (diskchanges[i] == filename) {
                wasjustchanged = true
                changedindex = i
              }
            }
          }

          if (wasjustchanged) {
            // ignoring the duplicate change
            console.log('duplicate change - ignored')
            diskchanges.splice(changedindex, 1)
          } else {
            diskchanges.push(filename)
            let wasjustdownloaded = false;
            let downloadindex = -1;
            for (let i in justDownloaded) {
              if (!wasjustdownloaded) {
                if (justDownloaded[i] == filename) {
                  wasjustdownloaded = true
                  downloadindex = i
                }
              }
            }
            if (wasjustdownloaded) {
              // remove from the list
              console.log(
                  'change detected but it was a file we just downloaded so lets ignore it')
              justDownloaded.splice(downloadindex, 1)
            } else {
              console.log('change detected and it seems to be legitimate')
              self.uploadFileToDocument(
                  filename,
              )
            }
          }
        }
      })
    })
  }
  // reloads the gui of the folder page.
  reload() {
    event.sender.send('actionReply', publicfolder);
    //event.sender.send('actionReply', folder);
    console.log('reloaded')
  }
}



module.exports = new Config();