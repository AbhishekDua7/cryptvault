var ipc = require('electron').ipcRenderer;
const {google} = require('googleapis');
const propertiesParser = require('properties-parser');
const fs = require('fs');
const crypto = require('crypto');
var folder;
var publicfolder;
var event;
var justUploaded = [];
var justDownloaded = [];
var userPassword = 'dbsec';
const rounds = 16;
const saltkeyFilePath = './Documents/saltkey.bin';
const saltkeyFileName = 'saltkey.bin';
const ivkeyFilePath = './Documents/iv.bin';
const ivkeyFileName = 'iv.bin';
const datakeyFilePath = './PublicDocuments/encryptedkey.bin';
const datakeyfileName = 'encryptedkey.bin';
const dataFilePath = './PublicDocuments/userdata.bin';
const dataFileName = 'userdata.bin'
const sampleDataFilePath = './Documents/sample.bin';
const sampleText = "Hello DbSec";
const sampleFileName = 'sample.bin';
// todo add check for this list in listfiles
const acceptableNames = [saltkeyFileName, 'encypteddata.properties', 'userdata.properties'];
var isPasswordCreated = false;
const ivMap = new Map();
class Config1 {
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

  // checkForPasswordCreation() {
  //   console.log('Entering pwd exist check');
  //   var self = this;
  //   fs.stat(sampleDataFilePath, function(err, stats){
  //       if (err) {
  //           if (err.code == 'ENOENT') {
  //               isPasswordCreated = false;
  //           } else {
  //               console.log(err)
  //               console.log('fatal err in sample file')
  //               throw err
  //           }
  //       } else {
  //           isPasswordCreated = true;
  //       }
  //   })
  // }

  emptyFolderSync() {
    const files = fs.readdirSync('./Documents/');
    for (const file of files) {
      const filePath = `${folderPath}/${file}`;
      fs.unlinkSync(filePath);
    }
  }

  createSampleFile(key, iv){
    console.log('Ciphering == '+ key.length);
    let cipherData = Buffer.from(this.encryptData(sampleText, key, iv, 'binary'), 'binary');
    console.log('Encrypter SAMPLE DATA ========== ' + cipherData);
    this.createOrUpdateFile(sampleDataFilePath, sampleFileName, iv, cipherData, true);
  }

  decryptAndValidateSampleFile(key ,iv) {
    if (this.checkFileSync(sampleDataFilePath)) {
      let cipherData = fs.readFileSync(sampleDataFilePath);
      let decipherData = this.decryptData(cipherData, key, iv, 'binary');
      console.log('Deciphered = ' + decipherData);
      return (decipherData == sampleText)
    } 
    else 
    {return false;}
  }

  // assumes the files exists
  uploadFileToCloud(filePath, fileName, iv, isPrivate) {
    let self = this;
    console.log('Data in filepath -' + fs.readFileSync(filePath));
    let dataStream = fs.createReadStream(filePath);
    const drive = google.drive({version: 'v3', auth: this.auth});
    var fileId = this.getFileId(fileName, isPrivate);
    var fileMetadata = {
        'name': fileName,
        'appProperties': {'IV': Buffer.from(iv).toString('base64')}
    };
    var media = {mimeType: 'application/octet-stream', body: dataStream};
    if (fileId != '') {
        console.log('found file id for '+ fileName + ' = ' +fileId);
        drive.files.update(
            {fileId: fileId, resource: fileMetadata, media: media, fields: 'id'})
    } else {
        if (isPrivate == true) {
            fileMetadata = {
                'name': fileName,
                'parents': ['appDataFolder'],
                'appProperties': {'IV': Buffer.from(iv).toString('base64')}
            };
        } 
        drive.files.create(
        {
            resource: fileMetadata, media: media, fields: 'id'},
            function(err, file) {
              if (err) {
                // Handle error
                console.error(err);
              } else {
                ivMap.set(fileName, iv);
                console.log(
                    'Uploaded file \"' + fileName + '\", File Id: ', file.data.id);
                self.downloadfile(drive,fileName,isPrivate, file.data.id);    

              }
        });
    }

    // this is the end of function
  }

  getFileId(fileName, isPrivate) {
    var providedFolder = publicfolder;
    if (isPrivate == true) {
        providedFolder = folder;
    }
    var fileId = '';
    for(var i =0; i<providedFolder.length;i++) {
        if (fileName == providedFolder[i][0]) {
            fileId = providedFolder[i][1];
            break;
        }
    }
    console.log('Checking for ' + fileName +' and found fileId = '+ fileId);
    return fileId;
  }

  // this function just encrypts data for given key and iv
  encryptData(data, key, iv, inputFormat) {
    console.log('Key LengthE='+key.length);
    let cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    let ciphertext = cipher.update(data, inputFormat, 'binary')
    return ciphertext;
  }

  // function to generate key using salt and user password as provided by prof.
  generateKeyUsingSalt(salt, pwd) {
    console.log("Entering Key generation\ncreds=" + pwd + "\n salt = " + salt);
    const keyLength = 32; // 256-bit key for AES-256
    var hash = crypto.createHash('sha256');
    let xi = Buffer.alloc(0); // initialize x0 to a zero-filled buffer
    for (let i = 0; i < rounds; i++) {
     hash.update(xi);
     hash.update(pwd);
     hash.update(salt);
     xi = hash.digest();
     hash = crypto.createHash('sha256');
      // xi = hash.update(Buffer.concat([xi, credentials, salt])).digest();
    }
    const K = xi.subarray(0,keyLength); // the final value of xi is the first AES password
    //const K2 = crypto.randomBytes(keyLength); // generate a random key for the second password
    console.log('Returned key = '+ K);
    return K;
  }

  // this function just decypts data for given key and iv
  decryptData(data, key, iv, outputFormat) {
    console.log('Key LengthD='+key.length);
    let decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    let cleartext = decipher.update(data, 'binary', outputFormat);
    return cleartext;
  }

  checkFileSync(filePath) {
    try {
        return fs.existsSync(filePath);
      } catch (error) {
        console.error(error);
        return false;
      }
  }

  createOrUpdateFile(filePath, filename, iv, encryptedDataString, isPrivate) {
    let self = this;
    try {
     fs.writeFileSync(filePath, encryptedDataString);
     self.uploadFileToCloud(filePath, filename, iv, isPrivate);
    } catch(error) {
        console.log('Unable to create file ' + filename);
    }
    
  }

  decryptAndReadPropertiesFile(filePath, key) {
    if (this.checkFileSync(filePath)) {
      try {
        const encryptedData = fs.readFileSync(filePath);
        const iv =this.getIVFromPrivateStore();
        const propData = Buffer.from(this.decryptData(encryptedData, key, iv, 'binary'),'binary');
        console.log('Decrypted clear text ' + propData);
        return propData;
        } catch(error) {
          console.log('Unable to read ' + filePath + ' ' + error);
        }
    } else {
      console.log('Unable to find ' + filePath);
    }
  }

  

// code to encrypt and decrypt data files.---------------------------------

  generateAndUploadSaltForPrivateStore() {
    let self = this;
    if (this.checkFileSync(saltkeyFilePath)) {
        console.log('Salt exists');
        return;
    } else {
        let salt = Buffer.from(crypto.randomBytes(32), 'binary');
        console.log('Writing private salt = ' + salt);
        console.log('Writing private salt of length= ' + salt.length);
        let iv = crypto.randomBytes(16);
        this.createOrUpdateFile(saltkeyFilePath, saltkeyFileName,iv, salt, true);
        this.createOrUpdateFile(ivkeyFilePath, ivkeyFileName, iv, iv, true);
    }
  }


  getSaltFromPrivateStore() {
   // this.generateAndUploadSaltForPrivateStore();
    try {
      let privateSalt = fs.readFileSync(saltkeyFilePath);
      console.log('Reading private salt - ' + privateSalt);
      return privateSalt;
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }

  getSaltFromPublicStore(userPwd) {
    // this.generateAndUploadSaltForPrivateStore();
     try {
       let privateSalt = this.getSaltFromPrivateStore();
       let key2 = this.generateKeyUsingSalt(privateSalt, userPwd);
       let publicSalt = this.decryptAndReadPropertiesFile(datakeyFilePath, key2)
       console.log('Decrypted public salt = ' + publicSalt);
       return publicSalt;
     } catch (error) {
       console.log(error);
       return undefined;
     }
   }

  getIVFromPrivateStore() {
     try {
       let iv = Buffer.from(fs.readFileSync(ivkeyFilePath),'binary');
       console.log('Reading iv - ' + iv);
       return iv;
     } catch (error) {
       console.log(error);
       return undefined;
     }
   }

  // generate key2
  getKeyFromPrivateSalt(userPwd) {
    let privateSalt = this.getSaltFromPrivateStore();
    let key2 = this.generateKeyUsingSalt(privateSalt, userPwd);
    return key2;
  }

  // todo 
  getKeyFromPublicSalt(userPwd) {
    let publicSalt = this.getSaltFromPublicStore(userPwd);
    let key = this.generateKeyUsingSalt(publicSalt, userPwd);
    return key;
  }


  encryptGivenDataUsingPublicDataSalt(userdata, userPwd) {
    let userPass = Buffer.from(userPwd, 'binary');
    let key = this.getKeyFromPublicSalt(userPass);
    let iv = this.getIVFromPrivateStore();
    let cipheredData  = this.encryptData(userdata,key,iv,'binary');
    return cipheredData;
  }

  decryptGivenDataUsingPublicDataSalt(encryptedData, userPwd) {
    let userPass = Buffer.from(userPwd, 'binary');
    let key = this.getKeyFromPublicSalt(userPass);
    let iv = this.getIVFromPrivateStore();
    let clearData = this.decryptData(encryptedData,key,iv,'binary');
    console.log('Decrypted Userdata='+ clearData);
    return clearData;
  }

  //here keys are encrypted tags and values are clear data
  encryptAndStoreUserData(keys,values, userPwd) {
    // let userPass = Buffer.from(userPwd, 'binary');
    // console.log('Received data to encrypt =' + userdata);
    // let key = this.getKeyFromPublicSalt(userPass);
    // console.log(' key for user data =' + key);
    let iv = this.getIVFromPrivateStore();
    let propData=this.encryptGivenDataUsingPublicDataSalt(values[0],userPwd);
    // for(var i=0;i<keys.length;i++) {
    //   let cipheredData  = this.encryptGivenDataUsingPublicDataSalt(values[i], userPwd);
    //   propData+=''+keys[i]+'='+cipheredData+'\n';
    // }
    console.log('prop user data = '+ propData); 
    let binprop = Buffer.from(propData,'binary'); 
    console.log('prop user data = '+ binprop); 
    this.createOrUpdateFile(dataFilePath,dataFileName,iv,binprop, false);
  }

  decryptFileDataAndRead(keys,userPwd) {
    // let userPass = Buffer.from(userPwd, 'binary');
    // let key = this.getKeyFromPublicSalt(userPass);
    //let iv = this.getIVFromPrivateStore();
   // let clearData = this.decryptAndReadPropertiesFile(dataFilePath, key)
   // console.log('Decrypted Userdata='+ clearData);
   let encData = fs.readFileSync(dataFilePath);
  // let prop = this.parsePropertiesData(encData);
  // for(var i=0;i<keys.length;i++) {
    //prop[keys[i]]
      this.decryptGivenDataUsingPublicDataSalt(Buffer.from(encData,'binary'),userPwd);
  // }
  }


  //to be called when user creates password for first time
  storePublicSalt(userPwd) {
    if (this.checkFileSync(datakeyFilePath)) {
      console.log('Public salt exists');
      return;
    } else {
      let salt = Buffer.from(crypto.randomBytes(32),'binary');
      console.log('Writing public salt');
      let iv = this.getIVFromPrivateStore();
      let key2 = this.getKeyFromPrivateSalt(userPwd);
      console.log('\n\nPlain content= '+ salt);
      let encryptedContent= this.encryptData(salt,key2, iv, 'binary');
      console.log('encrypted content=' +encryptedContent);
      this.createOrUpdateFile(datakeyFilePath,datakeyfileName,iv,encryptedContent,false);
    }
  }

  // be very careful to use this method with validation only. it will override the basic file
  handleUserPasswordCreation(userPwd) {
    userPwd = Buffer.from(userPwd);
    console.log('creating password ');
    let key2 = this.getKeyFromPrivateSalt(userPwd);
    console.log('\n\n-------Generated Key----------\n\n' + key2 + '\n------------------------------\n');
    let iv = this.getIVFromPrivateStore();
    this.createSampleFile(key2, iv);
    this.storePublicSalt(userPwd);
    //ipc.send('PasswordGenerated', 'success');
  }

// code to encrypt and decrypt data ends -------------------------------------

  // code to download and display files
  listFiles(callback, eventVal) {
    // Test Output
    event = eventVal;
    folder = [];
    publicfolder = [];
    this.listPrivateFiles2(callback);
    isPasswordCreated = this.checkFileSync(sampleDataFilePath);
    console.log('Password created = ' + isPasswordCreated);
   // this.handleUserPasswordCreation(userPassword);
    if (isPasswordCreated == true) {
     // console.log('Listing public files');
     // this.listPublicFiles(callback);
        // if (!this.checkFileSync(datakeyFilePath)) {
        //   this.storePublicSalt(userPassword);
        // }
      // this.tryReadProp();
     // this.encryptAndStoreUserData(['Name'],['Abhishek'], userPassword);
      this.decryptFileDataAndRead(['Name'],userPassword);
    } else {
      
     // this.handleUserPasswordCreation(userPassword);
    }
  }

  // createPropertiesData(tags, values) {
  //   // implementation here
  //   // create properties object from array lists
  //   const properties = {};
  //   for (let i = 0; i < tags.length; i++) {
  //     properties[tags[i]] = values[i];
  //   }
  //   return properties
  // }

  // formatPropertiesDataForStorage(properties) {
  //   let output = '';
  //   for (let key in properties) {
  //     output += key + '=' + properties[key] + '\n';
  //   }
  //   return output;
  // }

  parsePropertiesData(propertiesString) {
    console.log('Properties provided \n' + propertiesString);
    var properties = {};
    const lines = propertiesString.toString().split('\n');
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts[1].trim();
        console.log('Adding key '+ key + ' and value=' + value);
        properties[key] = value;
      }
    }
    return properties;
  }

  tryReadProp() {
   
    let iv = this.getIVFromPrivateStore();
    console.log('public iv='+ iv);
    if (iv != undefined) {
    let key2= this.getKeyFromPrivateSalt(Buffer.from(userPassword));
    console.log('\n\n-------Generated Key2----------\n\n' + key2 + '\n------------------------------\n');
    console.log('verify password ='+this.decryptAndValidateSampleFile(key2));
    console.log('public key2='+ key2);
    let propData = this.decryptAndReadPropertiesFile(datakeyFilePath,key2);
    console.log('Decrypted data --');
    console.log(propData);
    } else {
      console.log('no iv found');
    }
    // let key2= this.getKeyFromPrivateSalt(Buffer.from(userPassword));
    // let iv = this.getIVFromPrivateStore();
    // let cipherText = this.encryptData('hello!!', key2,iv, 'binary');
    // let clearText = this.decryptData(cipherText,key2,iv,'binary');
    // console.log('Clear text value is '+ clearText);
    
  }

  getIVValue(providedFolder, keyFileName) {
    if (ivMap.has(keyFileName)) 
      return ivMap.get(keyFileName);
    else {
      for(var i =0;i<providedFolder.length;i++) {
        if (providedFolder[i][0] == keyFileName) {
          return providedFolder[i].data.appProperties.IV;
        }
      }
    }  

  }

 listPrivateFiles() {
    console.log('Entering list private');
    const drive = google.drive({version: 'v3', auth: this.auth});
    drive.files.list(
        {
          spaces: 'appDataFolder',
          pageSize: 50,
          fields: 'nextPageToken, files(id, name)'
        },
        (err, res) => {
          if (err) {
            console.log('Error getting private drive listing' + err);
            return;
          }
          const response = res.data.files;
          if (response.length) {
            console.log('Private Files:\n-----------------------------------------');
            response.map((file) => {
              console.log(`${file.name} : (${file.id})`);
              folder.push([file.name, file.id]);
            });
          } else {
            console.log('No Files in private :(');
          }
         this.handleCloudFiles(drive,folder);
         
        // this.handleDocuments();
    });
  }

  listPrivateFiles2(callback) {
    console.log('Entering list private');
    const drive = google.drive({version: 'v3', auth: this.auth});
    drive.files.list(
        {
          spaces: 'appDataFolder',
          pageSize: 50,
          fields: 'nextPageToken, files(id, name)'
        },
        (err, res) => {
          if (err) {
            console.log('Error getting private drive listing' + err);
            return;
          }
          const response = res.data.files;
          if (response.length) {
            console.log('Private Files:\n-----------------------------------------');
            response.map((file) => {
              console.log(`${file.name} : (${file.id})`);
              folder.push([file.name, file.id]);
            });
          callback(folder);
          } else {
            console.log('No Files in private :(');
          }
         this.handleCloudFiles(drive,folder);
         
        // this.handleDocuments();
    });
  }

  listPublicFiles(callback) {
    console.log('Entering list public');
    const drive = google.drive({version: 'v3', auth: this.auth});
    drive.files.list(
        {
          pageSize: 50,
          fields: 'nextPageToken, files(id, name)'
        },
        (err, res) => {
          if (err) {
            console.log('Error getting  public drive listing' + err);
            return;
          }
          const response = res.data.files;
          if (response.length) {
            console.log('Files:\n-----------------------------------------');
            response.map((file) => {
              console.log(`${file.name} : (${file.id})`);
              publicfolder.push([file.name, file.id]);
            });
            callback(folder);
          } else {
            console.log('No Files in public :(');
          }
          this.handleCloudFiles(drive,publicfolder);
          //this.handlePublicDocuments();
        });
  }

  // create given timestamp file for folder
  createTimeStampFileIfNotExists(drive,timestampFileName,providedFolder, isPrivate) {
    console.log('\nTIMESTAMP DOESNT EXIST - CREATING ' + timestampFileName)
    var self = this;
    // then we need to create it and download everything
    drive.changes.getStartPageToken({}, function(err, res) {
      console.log('Start token:', res.data.startPageToken);
      console.dir(res)
      fs.writeFile(timestampFileName, res.data.startPageToken, function(err) {
        if (err) throw err
          // timestamp created - download all cloud files to disk and
          // decrypt them
          console.log(
              'Timestamp did not exist on disk - Downloading all files to get synced with cloud.')
          for (let obj of providedFolder) {
            self.downloadfile(drive,obj[0],isPrivate,obj[1]);
          }
      })
    });
  }

  // This function downloads encrypted file from provided public/private drive.
  handleCloudFiles(drive,providedFolder) {
    console.log('HANDLECLOUD RUNNING')
    var self = this;
    var isPrivate = (providedFolder == folder);
    // one initial get - only need to download files that are newer than
    // whats on disk last update timestamp will be stored on disk in
    // .timestamp file we will use that to only download new content
   // const drive = google.drive({version: 'v3', auth: this.auth});
   
    var timestampFileName = '.public_timestamp';
    if (isPrivate == true) {
        timestampFileName = '.private_timestamp';
    }
    // read timestamp file - if it doesnt exist assume its way in past (fresh
    // install - download everything)
    fs.stat(timestampFileName, function(err, stats) {
      if (err) {
        if (err.code == 'ENOENT') {  // if file doesnt exist
            self.createTimeStampFileIfNotExists(drive,timestampFileName,providedFolder, isPrivate);
        } else {
          console.log(err)
          console.log('fatal err')
          throw err
        }
      } else {
        console.log('FILE EXISTS - READING')
        fs.readFile(timestampFileName, function(err, rawfilecontents) {
          if (err) {
            console.log(err)
            console.log(timestampFileName +' fatal error reading file that should exist')
            throw err
          }
          // now we have the timestamp
          console.log(timestampFileName + rawfilecontents)
          
          self.handleChangedFile(drive, rawfilecontents,timestampFileName, isPrivate);
        
        })
      }
      console.log('Done private downloads');
      self.generateAndUploadSaltForPrivateStore();
      // if(!isPrivate) {
      //   self.tryReadProp();
      // }
    })
  }

  // based on timestamp files tracks changes in file
  handleChangedFile(drive, rawfilecontents,timestampFileName, isPrivate) {
          let self = this;
          var listParam =  {pageToken: rawfilecontents.toString()};
          if (isPrivate == true) {
            listParam =  {spaces: 'appDataFolder', pageToken: rawfilecontents.toString()};
          }
          // get changes
          // todo use this function to throw error
          drive.changes.list(
            listParam,
            (err, res) => {
              if (err) {
                console.log('Error ' + timestampFileName+' getting changed files- ' + err);
                return;
              }
              let newversion = res.data.newStartPageToken
              let len = 0;
              if (newversion) {
                len = newversion.length;
              }
              console.log('new cloud version ' + newversion)
              fs.writeFile(
                  timestampFileName,  Buffer.alloc(len,newversion),
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
                          self.downloadfile(drive,change.file.name,isPrivate, change.fileId)
                        }
                      }
                  })
            })
  }

  // download files plainly in associated folder PublicDocuments for public drive and Documents for private.
  downloadfile(drive,fileName,isPrivate, fileid) {
    var self = this;
   // const drive = google.drive({version: 'v3', auth: this.auth});
    var downloadPath = './PublicDocuments/';
    if (isPrivate == true) {
        downloadPath = './Documents/';
    }
    // drive.files
    //     .get({
    //       fileId: fileid,
    //       fields:
    //           'name, appProperties, createdTime, modifiedTime, modifiedByMeTime'
    //     })
    //     .then(function(file) {
    //       justDownloaded.push(file.data.name)
    //       console.log('Downloaded: ' + file.data.name);
    //       let iv = Buffer.from(file.data.appProperties.IV, 'base64');
    //       console.log('Added iv ' + iv +' for ' + file.data.name)
    //       let timestamp = file.data.modifiedTime
    //       drive.files.get({fileId: fileid, alt: 'media'})
    //           .then(function(filewithdata) {
    //             console.log('ENCRYPTED FILE CONTENTS: ')
    //             console.dir(filewithdata.data)
    //             fs.writeFile(
    //                   downloadPath + file.data.name, filewithdata.data,
    //                   {encoding: 'binary'}, function(err) {
    //                     if (err) {
    //                       console.log('error writing to file ')
    //                       console.log(downloadPath + file.data.name)
    //                       throw err
    //                     } else {
    //                       console.log('WRITTEN TO FILE')
    //                     }
    //                   })
    //                   //self.tryReadProp();
    //             })
    //           .catch(function(err) {
    //             console.log('Error during second download', err);
    //           })
    //     })
    //     .catch(function(err) {
    //       console.log('Error during download', err);
    //     })
    const destFileStream = fs.createWriteStream((downloadPath+fileName));
    drive.files.get(
      { fileId: fileid, alt: 'media',fields:
                 'name, appProperties, createdTime, modifiedTime, modifiedByMeTime' },
      { responseType: 'stream' },
      (err, res) => {
        if (err) {
          console.error(`Error downloading file: ${err}`);
          return;
        }
        res.data.pipe(destFileStream);
        destFileStream.on('finish', () => {
          console.log(fileName +' - File downloaded successfully data=' + res.data);
        });
      }
    );
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

  reload() {
    event.sender.send('actionReply', folder);
    //event.sender.send('actionReply', folder);
    console.log('reloaded')
  }

}

module.exports = new Config1();