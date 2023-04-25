
const secrets = require('secrets.js-grempe');
var ipc = require('electron').ipcRenderer;
var file = [];
console.log('Running Diplay.js');
const fs = require('fs');
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

let tags = [];
let values = [];

function addProperty() {
    const tagInput = document.getElementById("tagInput").value;
    const valueInput = document.getElementById("valueInput").value;

    tags.push(tagInput);
    values.push(valueInput);

    const propertiesTextArea = document.getElementById("propertiesTextArea");
    propertiesTextArea.value += `${tagInput}=${valueInput}\n`;

    document.getElementById("tagInput").value = "";
    document.getElementById("valueInput").value = "";
}

function createProperties() {
    console.log("tags: "+ tags);
    console.log("Values: "+ values);
    createPropertiesFile(tags, values);
}


function createPropertiesFile(tags, values) {
    // implementation here
    // create properties object from array lists
const properties = {};
for (let i = 0; i < tags.length; i++) {
  properties[tags[i]] = values[i];
}

// write properties object to file
fs.writeFile('data.properties', formatProperties(properties), function (err) {
  if (err) throw err;
  console.log('Properties file created!');
});

// function to format properties object into string

}

// function createPropertiesFile() {
//     let tags = [];
//     let values = [];
  
//     // check if data.properties file already exists
//     if (fs.existsSync('data.properties')) {
//       // read current properties from file
//       const currentProperties = fs.readFileSync('data.properties', 'utf8');
    
//       // parse current properties into object
//       const parsedProperties = parseProperties(currentProperties);
  
//       // populate tags and values arrays with existing properties
//       for (let key in parsedProperties) {
//         tags.push(key);
//         values.push(parsedProperties[key]);
//       }
  
//       // update text area with existing properties
//       const propertiesTextArea = document.getElementById("propertiesTextArea");
//       propertiesTextArea.value = formatProperties(parsedProperties);
//     }
  
//     // add new properties from input fields
//     const tagInput = document.getElementById("tagInput").value;
//     const valueInput = document.getElementById("valueInput").value;
//     if (tagInput && valueInput) {
//       tags.push(tagInput);
//       values.push(valueInput);
//     }
  
//     // create properties object from arrays
//     const properties = {};
//     for (let i = 0; i < tags.length; i++) {
//       properties[tags[i]] = values[i];
//     }
  
//     // write properties object to file
//     fs.writeFile('data.properties', formatProperties(properties), function (err) {
//       if (err) throw err;
//       console.log('Properties file created or updated!');
//     });
  
//     // clear input fields
//     document.getElementById("tagInput").value = "";
//     document.getElementById("valueInput").value = "";
//   }
  

function formatProperties(properties) {
    let output = '';
    for (let key in properties) {
      output += key + '=' + properties[key] + '\n';
    }
    return output;
  }

function updateProperties() {
    const propertiesTextArea = document.getElementById("propertiesTextArea");
    const lines = propertiesTextArea.value.split("\n");

    // extract tags and values from lines
    const tags = [];
    const values = [];
    for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split("=");
        if (parts.length >= 2) {
            const tag = parts[0].trim();
            const value = parts[1].trim();
            tags.push(tag);
            values.push(value);
        }
    }

    updateProperty(tags, values);
}

function updateProperty(tags, values) {
    // read current properties from file
    const currentProperties = fs.readFileSync('data.properties', 'utf8');
  
    // parse current properties into object
    const parsedProperties = parseProperties(currentProperties);
  
    // update properties in object with updated values
    for (let i = 0; i < tags.length; i++) {
        if (parsedProperties.hasOwnProperty(tags[i])) {
            parsedProperties[tags[i]] = values[i];
        }
    }
  
    // write updated properties object to file
    fs.writeFileSync('data.properties', formatProperties(parsedProperties));
  
    console.log('Properties file updated!');
  
    // function to format properties object into string
    function formatProperties(properties) {
        let output = '';
        for (let key in properties) {
            output += key + '=' + properties[key] + '\n';
        }
        return output;
    }
}

  
// function to parse properties string into object
function parseProperties(propertiesString) {
  var properties = {};
  const lines = propertiesString.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts[1].trim();
      properties[key] = value;
    }
  }
  return properties;
}

var checkboxData = new Map();

function openModal(modalId) {
  var modal = document.getElementById(modalId);
  modal.style.display = "block";
}

function closeModal(modalId) {
  var modal = document.getElementById(modalId);
  modal.style.display = "none";
}

function checkPassword() {
  var password = document.getElementById("password").value;
  if (password === "myPassword") {
    closeModal("passwordModal");
    openModal("checkboxModal");
  }
}

function openTextFields() {
    var checkboxData = new Map();
    checkboxData.set("tag1", document.getElementById("tag1").checked);
    checkboxData.set("tag2", document.getElementById("tag2").checked);
    checkboxData.set("tag3", document.getElementById("tag3").checked);
    checkboxData.set("tag4", document.getElementById("tag4").checked);
    checkboxData.set("tag5", document.getElementById("tag5").checked);
  
    console.log(checkboxData);
  
    closeModal("checkboxModal");
    openModal("textFieldModal");
  }

// window.onclick = function(event) {
//   var passwordModal = document.getElementById("passwordModal");
//   var checkboxModal = document.getElementById("checkboxModal");
  
//   if (event.target == passwordModal) {
//     closeModal("passwordModal");
//   } else if (event.target == checkboxModal) {
//     closeModal("checkboxModal");
//   }
// }


function remoteAction(action, id){ ipc.send('driveAction', [action, id]); }

function getInfo(info){
    alert(`Download ID: ${info}`);
}

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
  const enteredPassword = document.getElementById("shamirPassword").value;
  // Replace the following line with the code to check if the entered password is valid
  const isValidPassword = enteredPassword === "myPassword";

  if (!isValidPassword) {
    alert("Invalid password!");
    return;
  }

  // Close the password prompt modal
  //closePasswordModal();

  // Generate and display Shamir keys
 // generateAndDisplayShamirKeys();

}

function showShamirKeysModal() {
  document.getElementById("shamirKeysModal").style.display = "block";
}

function closeShamirKeysModal() {
  document.getElementById("shamirKeysModal").style.display = "none";
}


function generateAndDisplayShamirKeys() {
  // >>> ???
  const encryptionKey = "---";
  const hexKey = secrets.str2hex(encryptionKey);

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

  const combinedKey = secrets.combine(keysEntered);
  const decryptedKey = secrets.hex2str(combinedKey);

  // Use the decryptedKey to decrypt the data
  // ...

  // Display decrypted data in a prompt or another modal
  // ...


}

function openShamirKeysInputModal() {
  document.getElementById("shamirKeysInputModal").style.display = "block";
}

function closeShamirKeysInputModal() {
  document.getElementById("shamirKeysInputModal").style.display = "none";
}












