
const secrets = require('secrets.js-grempe');
//const config= require('../../config/config1');
var ipc = require('electron').ipcRenderer;
var file = [];
var requestedKeys = [];
var userValidPwd = '';
var userDecryptedData = {};
var tagMap = {
  'tag1':'SSN',
  'tag2':'Account Number',
  'tag3':'Bank Password',
  'tag4':'Phone Pin',
  'tag5':'Other'
}

const { dialog } = require('electron')

// var textMap = {
//   'text1':'SSN',
//   'text2':'Account Number',
//   'text3':'Bank Password',
//   'text4':'Phone Pin',
//   'text5':'Other'
// }

var revtextMap = {
  'SSN':'text1',
  'Account Number':'text2',
  'Bank Password':'text3',
  'Phone Pin':'text4',
  'Other':'text5'
}

console.log('Running Diplay.js');
const fs = require('fs');
const { error } = require('console');
function printFiles(folder)
{
    var i
    for(i = 0; i<folder.length; i++)
    {
        // file.push(document.createElement("tr"));
        // file[i].setAttribute('class', 'drive-item');
        // file[i].id = i;
        // file[i].innerHTML = `
        // <div class="item-inner">
        // <img class="thumb" src=${folder[i][2]} onerror="this.onerror=null;this.src='../icons/fileicon.png';"> 
        // </br>
        // <div class="info-box">
        // <img src=${folder[i][3]}> 
        // </br> ${folder[i][0]}
        // </div>
        // </div>`;

        // var box = document.getElementById("folder");
        // box.appendChild(file[i]);

        // file[i].addEventListener ("click", function() {
        //     alert("Download ID: "+folder[this.id][1]);
        // });

        file.push(document.createElement('tr'));
        file[i].setAttribute('class', 'file-item');
        file[i].id = i;
        file[i].innerHTML = `
        <th scope="row"> ${i} </th>
        <td class="col-actions"> ${(folder[i][3]) ? '<img src="' + folder[i][3] + '">' : '<i class="fas fa-lock"></i>'} </td>
        <td> ${folder[i][0]} </td>
        <td class="align-bottom col-actions">
            <button onClick="getInfo('${folder[i][1]}')">
                <i class="fas fa-info-circle"></i>
            </button>
            <button class="danger-button" onClick="remoteAction('DELETE', '${folder[i][1]}')"> 
                <i class="fas fa-trash"></i>
            </button>
        </td>
        `;

        document.getElementById('fileCollection').appendChild(file[i]);

        // file[i].addEventListener ("click", function() {
        //     alert("Download ID: "+folder[this.id][1]);
        // });
    }
}

// let tags = [];
// let values = [];

// function addProperty() {
//     const tagInput = document.getElementById("tagInput").value;
//     const valueInput = document.getElementById("valueInput").value;

//     tags.push(tagInput);
//     values.push(valueInput);

//     const propertiesTextArea = document.getElementById("propertiesTextArea");
//     propertiesTextArea.value += `${tagInput}=${valueInput}\n`;

//     document.getElementById("tagInput").value = "";
//     document.getElementById("valueInput").value = "";
// }


//var checkboxData = new Map();

function openModal(modalId) {
  var modal = document.getElementById(modalId);
  modal.style.display = "block";
  if (modalId == "textFieldModal") {
    updateModalUI();
  }
}

function updateModalUI() {
  if(userDecryptedData.hasOwnProperty("error")) {
    document.getElementById("errorLabelText").display = "block";
    return;
  }
  document.getElementById("errorLabelText").display = "none";
  var k = Object.values(revtextMap)
  for(var i=0;i<k.length;i++) {
    var textinput = document.getElementById(k[i]);
    textinput.disabled = true;
    textinput.value = ''; 
  }


  for(var i=0;i<requestedKeys.length;i++) {
    var textinput = document.getElementById(revtextMap[requestedKeys[i]]);
    textinput.disabled = false;
    if (userDecryptedData.hasOwnProperty(requestedKeys[i])) {
        textinput.value = userDecryptedData[requestedKeys[i]];
    }
  }
}


function closeModal(modalId) {
  var modal = document.getElementById(modalId);
  if (modalId == "passwordModal") {
    document.getElementById("password").value='';
    document.getElementById("errorLabel").style.display="none";
  }
  // if (modalId == "textFieldModal") {
  //   handleTextFieldModalClose();
  // } 
  modal.style.display = "none";
  
}

function checkChangePassword(tag) {
  var password = document.getElementById("changePassword").value;
  console.log('Sending ' + password);
  
  ipc.send('VerifyPassword', [password, tag]);
}

function setNewPassword(tag){
  var oldpwd = document.getElementById("changePassword").value;
  console.log('old password' + oldpwd);
  var userpwd = document.getElementById("newPassword").value;
  //console.log('new pwd' + userpwd);
  console.log('Sending new password: ' + userpwd);
  ipc.send('GenerateNewPassword', [oldpwd, userpwd, tag]);
}



function handleTextFieldModalClose() {
  let k = [];
  let v = [];
  if(userDecryptedData.hasOwnProperty("error")) {
    document.getElementById("errorLabelText").display = "block";
    closeModal("textFieldModal")
    return;
  }
  document.getElementById("errorLabelText").display = "none";
  for(var i=0;i<requestedKeys.length;i++) {
    k.push(requestedKeys[i]);
    var textinput = document.getElementById(revtextMap[requestedKeys[i]]);
    v.push(textinput.value);
  }
  ipc.send('SaveUserDataForKeysEvent', [k,v, userValidPwd]);
}

function handleTextFieldModalCloseResponse(resp) {
    //closeModal("textFieldModal");
    if (resp == true) {
      document.getElementById("errorLabelText").display = "none";
      closeModal("textFieldModal");
      userDecryptedData = {};
    } else {
      document.getElementById("errorLabelText").display = "block";
    }
}

 function checkPassword(tag) {
  requestedKeys =[];
  userValidPwd = '';
  userDecryptedData = {};
  var password = document.getElementById("password").value;
  console.log("inside checkPassword" + password);
  console.log('Sending ' + password);
  this.userValidPwd = password;
  ipc.send('VerifyPassword', [password, tag]);
}

function checkShamirPassword(tag) {
  var password = document.getElementById("spassword").value;
  console.log('Sending' + password)
  ipc.send('VerifyPassword', [password,tag]);
}

function loadcheckboxModal() {
  closeModal("passwordModal");
  openModal("checkboxModal");
}

function checkPasswordValue(pass, tag) {
  if (pass) {
    afterSuccessfulPwdVerification(tag);
  } else {
    if(tag == "DataEntryFlow1"){
      var errorLabel = document.getElementById("errorLabel");
      errorLabel.style.display = "block";
    }

    else if(tag == "shamirKey") {
      document.getElementById("errorShamirPwdLabel").style.display = "block";
    }

    else if (tag == "ChangePassword") {
      var errorLabel = document.getElementById("lblChangePwd");
      errorLabel.style.display = "block";
    }
   
    this.userValidPwd = '';
  }
}

function afterSuccessfulPwdVerification(tag) {
  if (tag == "DataEntryFlow1") {
    loadcheckboxModal();
  }

  else if (tag == "ChangePassword"){
    closeChangePasswordModal();
    showNewPasswordModal();
  }

  else if (tag == "shamirKey"){
    console.log("yayyy");
    validatePasswordAndGenerateShamirKeys();
  }
}

function openTextFields() {
    var checkboxData = new Map();
    checkboxData.set("tag1", document.getElementById("tag1").checked);
    checkboxData.set("tag2", document.getElementById("tag2").checked);
    checkboxData.set("tag3", document.getElementById("tag3").checked);
    checkboxData.set("tag4", document.getElementById("tag4").checked);
    checkboxData.set("tag5", document.getElementById("tag5").checked);
    var keys = Array.from(checkboxData.keys());
    console.log('Existing keys='+keys[0] + 'len=' + keys.length);
    for(var i=0;i<keys.length;i++) {
      if (checkboxData.get(keys[i]) == true) {
        this.requestedKeys.push(this.tagMap[keys[i]]);
      }
    }
    console.log(checkboxData);
    console.log('\n '+ requestedKeys);
    ipc.send('GetUserDataForKeysEvent', [requestedKeys, userValidPwd]);
    
  }

  function showUserData(data) {
    console.log(data);
    userDecryptedData = data;
    closeModal("checkboxModal");
    openModal("textFieldModal");
  }

  ipc.on('GetUserDataForKeysReply', function(event, response){
    showUserData(response);
});

ipc.on('SaveUserDataForKeysReply', function(event, response){
  console.log("Encrypted and saved="+ response);
  handleTextFieldModalCloseResponse(response);
});


function remoteAction(action, id){ ipc.send('driveAction', [action, id]); }

function getInfo(info){
    alert(`Download ID: ${info}`);
}

ipc.on('VerifyPasswordReply', function(event, response){
    checkPasswordValue(response[0], response[1]);
});

ipc.on('GenerateNewPwdReply',function(event, response){
  
  document.getElementById("newPassword").disabled = true;
  document.getElementById("btnNewPwdOk").disabled =true; 
  if (response[0] == true) {
    document.getElementById("successMessage").style.display = "block";
  } else {
    document.getElementById("successMessage").value= "Error";
    document.getElementById("successMessage").style.display = "block";
  }
});

ipc.on('getKeyReply', function(event, response){
  console.log("inside get key reply")

  response = Buffer.from(response, 'binary');
  console.log(response);
  console.log(response.length);

  console.log("inside getKeyReply" + String(response));
  
  generateAndDisplayShamirKeys(response);
});

ipc.on('decryptReply',function(event, response){
  console.log('response: ' + response);
  console.log('SSN: ' + response['SSN']);
  console.log('p pin: ' + response['Phone Pin']);
  updateAndShowDecryptedShamirModal(response);
})

ipc.once('actionReply', function(event, response){
        printFiles(response);
});


ipc.send('invokeAction', 'someData');

function showPasswordModal() {
  document.getElementById("shamirPasswordModal").style.display = "block";
}

function closePasswordModal() {
  document.getElementById("shamirPasswordModal").style.display = "none";
}

function generateRandomKey() {
  let key = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    key += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return key;
}

// Create the Shamir shares
function createShamirShares(key) {
  const n = 3;
  const t = 2;
  const hexKey = secrets.str2hex(key); // Convert the key to a hex string
  const shares = secrets.share(hexKey, n, t);
  return shares;
}

function validatePasswordAndGenerateShamirKeys() {
  closePasswordModal();

  // Generate and display Shamir keys
  getKeyForShamir();

}

function showChangePasswordModal() {
  document.getElementById("changePasswordModal").style.display = "block";
}

function closeChangePasswordModal() {
  document.getElementById("changePasswordModal").style.display = "none";
}

function showNewPasswordModal() {
  document.getElementById("newPasswordModal").style.display = "block";
}

function closeNewPasswordModal() {
  document.getElementById("newPasswordModal").style.display = "none";
}

function showShamirKeysModal() {
  document.getElementById("shamirKeysModal").style.display = "block";
}

function closeShamirKeysModal() {
  document.getElementById("shamirKeysModal").style.display = "none";
}

function showShamirDecryptModal() {
  document.getElementById("decryptedShamirModal").style.display = "block";
}

function closeShamirDecryptModal() {
  document.getElementById("decryptedShamirModal").style.display = "none";
  document.getElementById("label1").textContent = "";
  document.getElementById("label2").textContent = "";
  document.getElementById("label3").textContent = "";
  document.getElementById("label4").textContent = "";
  document.getElementById("label5").textContent = "";

}

function getKeyForShamir(){
  console.log("inside getkeyforshamir");
  ipc.send('getKey', this.userValidPwd);
}


function generateAndDisplayShamirKeys(encryptionKey) {
  console.log("generateAndDisplayShamirKeys "+this.encryptionKey);
  console.log("buffer "+ encryptionKey);

  const hexKey = encryptionKey.toString('hex');
  const shamirShares = secrets.share(hexKey, 3, 2);
  document.getElementById("shamirKeyDisplay1").innerText = shamirShares[0];
  document.getElementById("shamirKeyDisplay2").innerText = shamirShares[1];
  document.getElementById("shamirKeyDisplay3").innerText = shamirShares[2];
  
  showShamirKeysModal();
}

function decryptDataUsingShamirKeys() {
 
  const inputShamirKey1 = document.getElementById("inputShamirKey1").value;
  const inputShamirKey2 = document.getElementById("inputShamirKey2").value;
  const inputShamirKey3 = document.getElementById("inputShamirKey3").value;

  const keysEntered = [inputShamirKey1, inputShamirKey2, inputShamirKey3].filter(key => key.trim() !== "");

  if (keysEntered.length < 2) {
    alert("Please enter at least two keys!");
    return;
  }

  try{
    console.log(keysEntered);
    const combinedKey = secrets.combine(keysEntered);
    console.log(combinedKey);
    decryptedHexKey = Buffer.from(combinedKey, 'hex');
    console.log(decryptedHexKey);
    decryptedBinaryKey = Buffer.from(decryptedHexKey, 'binary');
    if(decryptedBinaryKey.length != 32){
      throw new Error("Invalid Shamir keys")
    }
    console.log("dec hex " + decryptedBinaryKey.toString('hex'));
    console.log("decrypt: " + decryptedBinaryKey + " " + decryptedBinaryKey.length);
    ipc.send('decrypt', decryptedBinaryKey);
    closeShamirKeysInputModal();
    showShamirDecryptModal();  
  }
  catch(e){
    alert("Shamir Key Decryption Error: " + e);
  }
}

function updateAndShowDecryptedShamirModal(decryptedData) {
  console.log('SSN: ' + decryptedData['SSN']);
  document.getElementById("label1").textContent = decryptedData['SSN'] || "";
  document.getElementById("label2").textContent = decryptedData['Account Number'] || "";
  document.getElementById("label3").textContent = decryptedData['Bank Password'] || "";
  document.getElementById("label4").textContent = decryptedData['Phone Pin'] || "";
  document.getElementById("label5").textContent = decryptedData['Other'] || "";

  // Show the modal
  const modal = document.getElementById("decryptedShamirModal");
  modal.style.display = "block";
}

function openShamirKeysInputModal() {
  document.getElementById("shamirKeysInputModal").style.display = "block";
}

function closeShamirKeysInputModal() {
  document.getElementById("shamirKeysInputModal").style.display = "none";
}












