const dropboxV2Api = require('dropbox-v2-api');
var config = require('../config');
const { response } = require('express');
//var Regex = require("regex-tools");
//steps 1,2,3 
/*try{
    //Make request to Dropbox to get list of files
    let result = await rp(options);

    //Filter response to images only
    let entriesFiltered = result.entries.filter( 
        function(entry){
          return entry.path_lower.search(/\.(gif|jpg|jpeg|tiff|png)$/i) > -1;
        });        

    //Get an array from the entries with only the path_lower fields
    var paths = entriesFiltered.map(function (entry) {
      return entry.path_lower;
    });

    //return a cursor only if there are more files in the current folder
*/
module.exports = {
  
 // upload: async (drive, listFileUpload, folderId, fileIndex) => {
    // index = req.params.index; 
    // const folderId = req.params.folderId ? req.params.folderId : "";
    
    // const client = getAuthenticatedClient(req.session.user.onedrive[index].token);
    // listFileUpload = req.files.file_upload;
    // lenght = (listFileUpload.length) ? listFileUpload.length : 1;
    // for (var i = 0; i < lenght; i++) {
  
    //}  

expData :   async (tokenv) => { 
 // expData :   async (drive ) => { 
  let options = {
    "path": "",
    "recursive": true,
    "include_media_info": true,
    "include_deleted": false,
    "include_has_explicit_shared_members": false,
    "include_mounted_folders": true,
    "include_non_downloadable_files": true
  };
  let resource = 'files/list_folder';
  

    // DROPBOX CLOUD ============================================================
    //set credentials
    var drive = await dropboxDriveAuth(tokenv);

return new Promise(resolve => drive({
  resource: resource,
  parameters: options,
    //readStream: (readable stream object?)
}, async (err, res) => {
    if (err) {
        console.log('The API returned an error: ' + err);
    }
    const listFiles = res.entries;

    await listFiles.map((item) => {
      if (item[".tag"] == "folder"){
          item.mimeType = "folder";
          item.path_display = item.path_display;
      } else {
        var filename = item.name;
        item.mimeType =  getFileExtension(filename); //returns xsl
        item.path_display = getPath(item.path_display, filename);
      }
      
      if (item.thumbnailLink){

        item.thumbnailLink = item.thumbnailLink;
      } else {
        item.thumbnailLink ="";
      }

     
    });   
    console.log(listFiles.length);
    console.log(listFiles);
    return resolve(listFiles);
}));
},
getFileShareWithMe: async (token) => {

  let options = {
  };
  let resource = 'sharing/list_folders';
  
  var drive = await dropboxDriveAuth(token);

  return new Promise(resolve => drive({
    resource: resource,
    parameters: options
  }, async (err, res) => {
    if (err) {
      console.log('The API returned an error: ' + err);
    }
    const listFiles = res.entries;

    await listFiles.map(async (item) => {

     
          item.mimeType = "folder";
  
      
      if (item.thumbnailLink){

        item.thumbnailLink = item.thumbnailLink;
      } else {
          item.thumbnailLink = "";
        }
        
      
      if (item.webUrl){
        item.webUrl = item.webUrl;
      } else {
        item.webUrl =  item.preview_url;
      }
      if (item.client_modified){
        item.client_modified = item.client_modified;
      } else {
        item.client_modified = item.time_invited;
      }
      if (item.server_modified){
        item.server_modified = item.server_modified;
      } else {
        item.server_modified = item.time_invited;
      }
      item.driveType = "dropbox";

    });   
    console.log(listFiles.length);
    console.log(listFiles); 
    return resolve(listFiles);
  }));

},
getInfoDrive : async (token) => {
  let options = {
  };
  let resource = 'users/get_space_usage';
  
  var drive = await dropboxDriveAuth(token);

  return new Promise(resolve => drive({
    resource: resource,
    parameters: options
  }, async (err, res) => {
    if (err) {
      console.log('The API returned an error: ' + err);
    }
    const listFiles = res;

    console.log(listFiles.length);
    console.log("get infor");
    console.log(listFiles); 
    return resolve(listFiles);
  }));
},
/*createFolder: async (drive, nameFolder, parents)
if (parents == "root"){
  var url = "/me/drive/root/children";
} else {
  var url = `/me/drive/items/${parents}/children`;
}
*/
createFolder: async (token, nameFolder, parents) => {
  try{

    CreateFolder = async () => {
      if (parents == "root"){
        var options = {
          "path":  nameFolder,
        "autorename": false,
          
        };
      } else {
        var options = {
          "path":  parents + "/" + nameFolder,
        "autorename": false,
          
        };
      }
        
        let resource = 'files/create_folder_v2';

        var drive = await dropboxDriveAuth(token);
      return new Promise(resolve => drive({
        resource: resource,
        parameters: options
      }, async (err, folder) => {
       
          if (err) {
              console.log('Can not create folder');
          } else {
              console.log('Folder Created');
          }
          folder.mimeType = 'folder';
          resolve(folder);
        })); 
  }
  return CreateFolder();

    } catch(err){ throw new Error(err);}
},

upload: async (token, listFileUpload, folderId, fileIndex) => {


  var tempFileUpload = (listFileUpload[fileIndex]) ? listFileUpload[fileIndex] : listFileUpload;
//create session
var drive = await dropboxDriveAuth(token);

const contentStream = fs.createReadStream(tempFileUpload);
//create upload stream
const uploadStream = drive({
    resource: 'files/upload',
    parameters: {
        //path: '/dropbox/path/to'
        path: folderId
    }
}, (err, result, response) => {
    // upload completed
    console.log("upload success");
    return response;
   // var folderName = response.name;
   // var folderPath = path_display;
});
contentStream
 //   .pipe(securityChecks)
    .pipe(uploadStream);
//use nodejs stream
///fs.createReadStream('path/to/file.txt').pipe(uploadStream);
//const securityChecks = ... //your security checks

  //}  
},



/*
async function listFolderContinue(token,path){

    let options={
      url: config.DBX_API_DOMAIN + config.DBX_LIST_FOLDER_CONTINUE_PATH, 
      headers:{"Authorization":"Huyen "+token},
      method: 'GET',
      json: true ,
      body: {"path":path}
    }
  
    try{
      //Make request to Dropbox to get list of files
      let result = await rp(options);
  
      //Filter response to images only
      let entriesFiltered = result.entries.filter( 
          function(entry){
            return entry.path_lower.search(/\.(gif|jpg|jpeg|tiff|png)$/i) > -1;
          });        
  
      //Get an array from the entries with only the path_lower fields
      var paths = entriesFiltered.map(function (entry) {
        return entry.path_lower;
      });
  
      //return a cursor only if there are more files in the current folder
      let response= {};
      response.paths= paths;
      if(result.hasmore) response.cursor= result.cursor;        
      return response;
  
    }catch(error){
      return next(new Error('error listing folder. '+error.message));
    }        
  } 



/*
//get list files from drive
module.exports.getListFiles = async (token) => {
    var drive = await googleDriveAuth(token);

    return new Promise(resolve => drive.files.list({
      //orderBy: 'modifiedTime desc',
      fields: 'nextPageToken, files(id, name, size, mimeType, thumbnailLink, createdTime, modifiedTime)',
    }, async (err, res) => {
        if (err) {
            console.log('The API returned an error: ' + err);
        }
        const listFiles = res.data.files;
        return resolve(listFiles);
    }));
}

//get list folder from dropbox


const { token } = require('morgan');*/

//get list files from driv
};

dropboxDriveAuth = (tokenv) => {
  const dropbox = dropboxV2Api.authenticate({
    client_id: config.dropboxAuth.clientID,
    client_secret: config.dropboxAuth.clientSecret,
    redirect_uri: config.dropboxAuth.callbackURL,
    token: tokenv
    });
    return dropbox;
}



getFileExtension = (filename) => {
  return filename.split('.').pop();
}
getPath = (path, filename) => {
  return path.replace('/' + filename, '');
}
