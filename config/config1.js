var ipcMain = require('electron').ipcMain;
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
let userFileModified = false;
const saltkeyFilePath = './Documents/saltkey.bin';
const saltkeyFileName = 'saltkey.bin';
const ivkeyFilePath = './Documents/iv.bin';
const ivkeyFileName = 'iv.bin';
const datakeyFilePath = './PublicDocuments/publicsalt.bin';
const datakeyfileName = 'publicsalt.bin';
const dataFilePath = './PublicDocuments/userdata.json';
const dataFileName = 'userdata.json'
const sampleDataFilePath = './Documents/sample.bin';
const sampleText = "Hello DbSec";
const sampleFileName = 'sample.bin';
const lenFilePath = './Documents/len.txt'
const lenFileName = 'len.txt'
const acceptableTagList = ['SSN','Account Number','Bank Password','Phone Pin','Other']
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
        this.scopes = ['https://www.googleapis.com/auth/drive','https://www.googleapis.com/auth/drive.appfolder','https://www.googleapis.com/auth/drive.metadata'];
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

  // utility function not to be used everytime
   uploadprivatesaltandiv() {
    let iv = this.getIVFromPrivateStore();
    this.uploadFileToCloud(ivkeyFilePath,ivkeyFileName, iv,true);
    this.uploadFileToCloud(saltkeyFilePath,saltkeyFileName,iv,true);
  }
 

  createSampleFile(key, iv){
 //   console.log('Ciphering == '+ key.length);
    let cipherData = Buffer.from(this.encryptData(sampleText, key, iv, 'binary'), 'binary');
   // console.log('Encrypter SAMPLE DATA ========== ' + cipherData);
    this.createOrUpdateFile(sampleDataFilePath, sampleFileName, iv, cipherData, true);
  }

  decryptAndValidateSampleFile(key ,iv) {
    if (this.checkFileSync(sampleDataFilePath)) {
      let cipherData = fs.readFileSync(sampleDataFilePath);
      let decipherData = this.decryptData(cipherData, key, iv, 'binary');
   //   console.log('Deciphered = ' + decipherData);
      return (decipherData == sampleText)
    } 
    else 
    {return false;}
  }

  saveFileLen(fileName) {
    if (fileName == dataFileName) {
      var data = fs.readFileSync(dataFilePath);
      fs.writeFileSync(lenFilePath, data.length+'');
      let iv = this.getIVFromPrivateStore();
      this.uploadFileToCloud(lenFilePath,lenFileName,iv,true);
    }
  } 

  FileLenMatch(fileName) {
    if (fileName==dataFileName && this.checkFileSync(lenFilePath) && this.checkFileSync(dataFilePath)) {
      var datalen = fs.readFileSync(dataFilePath).length+'';
      var l = fs.readFileSync(lenFilePath);
     // console.log('SavedLen='+ l);
    //  console.log('DataLen='+ datalen);
      if (l == datalen) {
        userFileModified = false;
      } else {
        userFileModified = true;
      }
     
    } else {
      userFileModified = false;
    }
    
  } 

  // assumes the files exists
  uploadFileToCloud(filePath, fileName, iv, isPrivate) {
    let self = this;
    //console.log('Data in filepath -' + fs.readFileSync(filePath));
    let dataStream = fs.createReadStream(filePath);
    const drive = google.drive({version: 'v3', auth: this.auth});
    var fileId = this.getFileId(fileName, isPrivate);
    var fileMetadata = {
        'name': fileName,
        'appProperties': {'IV': Buffer.from(iv).toString('base64')}
    };
    var media = {mimeType: 'application/octet-stream', body: dataStream};
    if (fileId != '') {
       // console.log('found file id for '+ fileName + ' = ' +fileId);
        drive.files.update(
            {fileId: fileId, resource: fileMetadata, media: media, fields: 'id,appProperties,name, modifiedTime, modifiedByMeTime'},(err, file) => {
              if (err) {
                console.error('Error updating file:', err);
                return;
              }
              self.saveFileLen(fileName);
           //   console.log(`File modified time: ${file.modifiedTime}`);
           //   console.log(`File modified by me time: ${file.modifiedByMeTime}`);
              self.downloadfile(drive,fileName,isPrivate, fileId); 
            })
            
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
            resource: fileMetadata, media: media, fields: 'id,appProperties,name, modifiedTime, modifiedByMeTime'},
            function(err, file) {
              if (err) {
                // Handle error
                console.error(err);
              } else {
                ivMap.set(fileName, iv);
                self.saveFileLen(fileName);
                console.log(
                    'Uploaded file \"' + fileName + '\", File Id: ', file.data.id);
               // console.log(`File modified time: ${file.modifiedTime}`);
               // console.log(`File modified by me time: ${file.modifiedByMeTime}`);    
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
      console.log('Checking file for id ==========' + providedFolder[i][0]);
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
    //console.log('Key LengthE='+key.length);
    let cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    let ciphertext = cipher.update(data, inputFormat, 'binary')
    return ciphertext;
  }

  // function to generate key using salt and user password as provided by prof.
  generateKeyUsingSalt(salt, pwd) {
  //  console.log("Entering Key generation\ncreds=" + pwd + "\n salt = " + salt);
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
   // console.log('Returned key = '+ K);
    return K;
  }

  // this function just decypts data for given key and iv
  decryptData(data, key, iv, outputFormat) {
    //console.log('Key LengthD='+key.length);
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

 

// code to encrypt and decrypt data files.---------------------------------
// utility function not to be used everytime
  generateAndUploadSaltForPrivateStore() {
    let self = this;
    if (this.checkFileSync(saltkeyFilePath)) {
        console.log('Salt exists');
        return;
    } else {
        let salt = Buffer.from(crypto.randomBytes(32), 'binary');
      //  console.log('Writing private salt = ' + salt);
       // console.log('Writing private salt of length= ' + salt.length);
        let iv = crypto.randomBytes(16);
        this.createOrUpdateFile(saltkeyFilePath, saltkeyFileName,iv, salt, true);
        this.createOrUpdateFile(ivkeyFilePath, ivkeyFileName, iv, iv, true);
    }
  }


  getSaltFromPrivateStore() {
   // this.generateAndUploadSaltForPrivateStore();
    try {
      let privateSalt = fs.readFileSync(saltkeyFilePath);
     // console.log('Reading private salt - ' + privateSalt);
      return privateSalt;
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }

  getSaltFromPublicStore(userPwd) {
    // this.generateAndUploadSaltForPrivateStore();
     try {
      //  let privateSalt = this.getSaltFromPrivateStore();
      //  let key2 = this.generateKeyUsingSalt(privateSalt, userPwd);
       let publicSalt = Buffer.from(fs.readFileSync(datakeyFilePath),'binary') //this.decryptAndReadPropertiesFile(datakeyFilePath, key2)
      // console.log(' public salt = ' + publicSalt);
       return publicSalt;
     } catch (error) {
       console.log(error);
       return undefined;
     }
   }

  getIVFromPrivateStore() {
     try {
       let iv = Buffer.from(fs.readFileSync(ivkeyFilePath),'binary');
      // console.log('Reading iv - ' + iv);
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


  // function to encrypt given data using key generated from publicly stored salt
  encryptGivenDataUsingPublicDataSalt(userdata, userPwd) {
    let userPass = Buffer.from(userPwd, 'binary');
    let key = this.getKeyFromPublicSalt(userPass);
    let iv = this.getIVFromPrivateStore();
    let cipheredData  = this.encryptData(userdata,key,iv,'binary');
    return cipheredData;
  }

  // function to encrypt given data using key generated from privately stored salt
  encryptGivenDataUsingPrivateSalt(userdata, userPwd) {
    let userPass = Buffer.from(userPwd, 'binary');
    let key = this.getKeyFromPrivateSalt(userPass);
    let iv = this.getIVFromPrivateStore();
    let cipheredData  = this.encryptData(userdata,key,iv,'binary');
    return cipheredData;
  }

  // function to decrypt given data using the public stored salt and password
  decryptGivenDataUsingPublicDataSalt(encryptedData, userPwd) {
    let userPass = Buffer.from(userPwd, 'binary');
    let key = this.getKeyFromPublicSalt(userPass);
    let iv = this.getIVFromPrivateStore();
    let clearData = this.decryptData(encryptedData,key,iv,'binary');
  //  console.log('Decrypted Public Userdata='+ clearData);
    return clearData;
  }

  // function to decrypt given data using the key
  decryptGivenDataUsingPublicKey(encryptedData, key) {
   // let userPass = Buffer.from(userPwd, 'binary');
   // let key = this.getKeyFromPublicSalt(userPass);
    let iv = this.getIVFromPrivateStore();
    let clearData = this.decryptData(encryptedData,key,iv,'binary');
    console.log('Decrypted Public Userdata='+ clearData);
    return clearData;
  }

  // function to decrypt given data using the privately stored salt and password
  decryptGivenDataUsingPrivateSalt(encryptedData, userPwd) {
    let userPass = Buffer.from(userPwd, 'binary');
    let key = this.getKeyFromPrivateSalt(userPass);
    let iv = this.getIVFromPrivateStore();
    let clearData = this.decryptData(encryptedData,key,iv,'binary');
    //console.log('Decrypted Private Userdata='+ clearData);
    return clearData;
  }

  //here keys are tags and values are clear data, are encrypted given password
  encryptAndStoreUserData(keys,values, userPwd) {
    let iv = this.getIVFromPrivateStore();
    let propData= {};//this.encryptGivenDataUsingPublicDataSalt(values[0],userPwd);
    for(var i=0;i<keys.length;i++) {
      let cipheredKey = Buffer.from(this.encryptGivenDataUsingPrivateSalt(keys[i], userPwd),'binary');
      let cipheredData  = Buffer.from(this.encryptGivenDataUsingPublicDataSalt(values[i], userPwd),'binary');
      propData[cipheredKey.toString('base64')]=cipheredData.toString('base64');
     // propData+=keys[i]+'='+cipheredData+'\n';
    }
   // console.log('prop user data = '+ JSON.stringify(propData)); 
    let binprop = Buffer.from(JSON.stringify(propData),'utf8'); 
    //console.log('prop user data = '+ binprop); 
    this.createOrUpdateFile(dataFilePath,dataFileName,iv,binprop, false);
    return true;
  }

  // decrypt data when given user password
  decryptFileDataAndRead(keys,userPwd) {
   let encData = fs.readFileSync(dataFilePath);
   let propData = JSON.parse(encData.toString('utf8'));
   let op = {};
   for(var i=0;i<keys.length;i++) {
    //prop[keys[i]]
      var encKey = Buffer.from(this.encryptGivenDataUsingPrivateSalt(keys[i], userPwd),'binary');
      var encKeyVal = encKey.toString('base64');
      let decKey = this.decryptGivenDataUsingPrivateSalt(Buffer.from(encKey, 'base64'),userPwd);
      var encDataVal = Buffer.from(propData[encKeyVal],'base64');
      let decVal = this.decryptGivenDataUsingPublicDataSalt(encDataVal,userPwd);
      op[decKey]=decVal;
   }
   return op;
  }

  // used for shamir, when key is passed
  decryptFileDataUsingKey(key) {
    if (!this.checkFileSync(dataFilePath)) {return {"error":''};}
    let encData = fs.readFileSync(dataFilePath);
    let propData = JSON.parse(encData.toString('utf8'));
    let op = {};
    let userdata = Object.values(propData);
    for(var i=0;i<acceptableTagList.length;i++) {
       var encDataVal = Buffer.from(userdata[i],'base64');
       let decVal = this.decryptGivenDataUsingPublicKey(encDataVal,key);
       op[acceptableTagList[i]]=decVal;
    }
    return op;
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
     //encryptedContent
      this.createOrUpdateFile(datakeyFilePath,datakeyfileName,iv,salt,false);
    }
  }

  // be very careful to use this method with validation only. it will override the basic file
  handleUserPasswordCreation(oldPwd, userPwd) {
     //todo getdecdata and encdata if files exist using old pwd before
     if (!this.checkFileSync(saltkeyFilePath) || oldPwd == null || userPwd == null) {
      return false;
     }
     var oldData = null;
     if (this.checkFileSync(dataFilePath)) {
        oldData = this.decryptFileDataAndRead(acceptableTagList, oldPwd);
        console.log('Reading old data' + Object.keys(oldData));
     }
    userPwd = Buffer.from(userPwd);
    console.log('creating password ');
    let key2 = this.getKeyFromPrivateSalt(userPwd);
    console.log('\n\n-------Generated Key----------\n\n' + key2 + '\n------------------------------\n');
    let iv = this.getIVFromPrivateStore();
    this.createSampleFile(key2, iv);
    this.storePublicSalt(userPwd);
    if (oldData != null) {
      var k =Object.keys(oldData);
      var v = Object.values(oldData);
      console.log('Encrypting olddata');
      this.encryptAndStoreUserData(k,v,userPwd);
    }
    return true;
    //ipc.send('PasswordGenerated', 'success');
  }

// code to encrypt and decrypt data ends -------------------------------------

  // code to download and display files
  listFiles(callback, eventVal) {
    // Test Output
    event = eventVal;
    folder = [];
    publicfolder = [];
    this.listPrivateFiles();
    isPasswordCreated = this.checkFileSync(sampleDataFilePath);
    if (isPasswordCreated == true) {
      console.log('Listing public files');
      this.listPublicFiles(callback);
    } else {
      console.log('Please ========== RELOAD ========= ');
    }
  }

  // creates folder on creation
  resetfolders() {
    let folderPath1='./PublicDocuments/';
    let folderPath2= './Documents/';
    if (this.checkFileSync('.public_timestamp')){
      fs.unlinkSync('.public_timestamp');
    }
    if (fs.existsSync(folderPath1)) {
      // delete the folder and its contents
      fs.rmdirSync(folderPath1, { recursive: true });
    }
    if (this.checkFileSync('.private_timestamp')) {
      fs.unlinkSync('.private_timestamp')
    }
    if (!fs.existsSync(folderPath2)) {
      // create folder and its contents
      fs.mkdirSync(folderPath2);
    }
    fs.mkdirSync(folderPath1);
   
  }

  // function to verify if given password is correct
  verifyPassword(userPwd) {
    let userPass = Buffer.from(userPwd,'binary');
    let iv = this.getIVFromPrivateStore();
    let key2= this.getKeyFromPrivateSalt(userPass);
    return this.decryptAndValidateSampleFile(key2, iv);
  }

  // downloads private stored files
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
    });
  }

  // change the call to this function in listFile to view private stored files
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
            callback(publicfolder);
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
                          //if (isPrivate == true) {
                            
                         // }
                          
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
       // let modifiedByMeTs = res.modifiedByMeTime;
       // let modifiedTs = res.modifiedTime;
       // console.log("Ts for filename="+fileName);
        //console.log('Modifiedbyme='+ modifiedByMeTs);
       // console.log('ModifiedTime=' + modifiedTs);

        res.data.pipe(destFileStream);
        destFileStream.on('finish', () => {
          self.FileLenMatch(fileName);
          console.log(fileName +' - File downloaded successfully data=' + res.data);
        });
      }
    );
  }

  deleteFile(fileID, callback){
    const drive = google.drive({version: 'v3', auth: this.auth});
    drive.files.delete({fileId: fileID},
    (err) => {
      if (err) {
        console.log('Error DELETING drive listing: ' + err);
        return;
      }
      callback();
    });
    
  }

  reload() {
    event.sender.send('actionReply', publicfolder);
    //event.sender.send('actionReply', folder);
    console.log('reloaded')
  }


  // Button click events
  verifyPasswordEvent(passwordData,callback, eventVal) {
    console.log('Password from localserver=' + passwordData[0]);
    const ans = this.verifyPassword(passwordData[0]);
    console.log('Sending ans='+ans);
    callback([ans, passwordData[1]]);
  }

  verifySetPasswordEvent(data,callback, eventVal) {
    console.log('verifying set password event')
    if (!data[0] && !data[1]) {
      callback(false, data[2]);
      return;
    }
  //  console.log('oldpwd: ' + data[0])
  //  console.log('userpwd: ' + data[1])
  //  console.log('tag: ' + data[2])
    const ans = this.handleUserPasswordCreation(data[0],data[1]);
    console.log('Sending ans =' + ans);
    callback([ans, data[2]]);
  }

  decryptedDataForKeysEvent(data,callback,eventVal) {
   // console.log('Password from localserver=' + data[1]);
   // console.log('Keys from localserver=' + data[0]);
    if (!this.checkFileSync(dataFilePath)) {
      var prop = {};
      for(var i=0;i<data[0].length;i++) {
        prop[data[0][i]] = '';
      }
      callback(prop);
      //let values = ['','','','',''];
      //this.encryptAndStoreUserData(acceptableTagList, values,data[1]);
    } else {
      this.FileLenMatch(dataFileName);
    //  console.log('Decrypting data for modifying  isFIleModified=' + userFileModified);
      if (userFileModified == true) {
        var prop = {
          "error":"Modified File"
        };
        callback(prop);
      } else {
      const ans = this.decryptFileDataAndRead(data[0],data[1]);
      callback(ans);
      }
    }
  }

  encryptDataForKeysEvent(data,callback,eventVal) {
    if (data[2] == '') {
      return callback(false);
    }
  //  console.log('Password from localserver=' + data[2]);
  //  console.log('Values from localserver=' + data[1]);
   // console.log('Keys from localserver=' + data[0]);
    let prop={};
    if (this.checkFileSync(dataFilePath)) {
       prop = this.decryptFileDataAndRead(acceptableTagList,data[2]);
    } else {
      for(var i=0;i<acceptableTagList.length;i++) {
        prop[acceptableTagList[i]] ='';
      }
    }
    for(var i=0;i<data[0].length;i++) {
      prop[data[0][i]] = data[1][i];
    }
    var k = Object.keys(prop);
    var v = Object.values(prop);
    const ans = this.encryptAndStoreUserData(k,v,data[2]);
    callback(ans);
  }
  

}


module.exports = new Config1();