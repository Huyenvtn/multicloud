var graph = require('@microsoft/microsoft-graph-client');
const { reject } = require('async');
const { all } = require('../routes/index.routes');
const { DocumentQuery } = require('mongoose');
const { response } = require('express');
require('isomorphic-fetch');
var fs = require('fs');
var refresh = require('passport-oauth2-refresh');

module.exports = {
  getUserDetails: async function(accessToken) {
    const client = getAuthenticatedClient(accessToken);

    const user = await client.api('/me').get();
    return user;
  },
  getAllItem: async function(accessToken) {
    try {
      var client = await getAuthenticatedClient(accessToken);

      var listItems = [];
      var itemsInRoot = await client.api('/me/drive/root/children?$expand=thumbnails').top(1000).get();
      listItems = itemsInRoot.value;
      //var itemsPage1 = await client.api("/me/drive/root/search(q='')?$expand=thumbnails").get();
      fullItems = await getAllFiles(itemsInRoot.value, listItems, client);

      await fullItems.map(async (item) => {
        if (item.file){
          item.mimeType = item.file.mimeType;
          item.capabilities = {
            "canAddChildren": false,
            "canAddMyDriveParent": false,
            "canChangeCopyRequiresWriterPermission": true,
            "canChangeViewersCanCopyContent": true,
            "canComment": true,
            "canCopy": true,
            "canDelete": true,
            "canDownload": true,
            "canEdit": true,
            "canListChildren": false,
            "canModifyContent": true,
            "canMoveChildrenWithinDrive": false,
            "canMoveItemIntoTeamDrive": true,
            "canMoveItemOutOfDrive": true,
            "canMoveItemWithinDrive": true,
            "canReadRevisions": true,
            "canRemoveChildren": false,
            "canRemoveMyDriveParent": true,
            "canRename": true,
            "canShare": true,
            "canTrash": true,
            "canUntrash": true
          };
          if (item.thumbnails.length > 0 ){
            item.thumbnailLink = item.thumbnails[0].large.url;
          } else {
            item.thumbnailLink ="";
          }
        } else if (item.folder){
          item.mimeType = "folder";
          item.capabilities = {
            "canAddChildren": true,
            "canAddMyDriveParent": false,
            "canChangeCopyRequiresWriterPermission": false,
            "canChangeViewersCanCopyContent": false,
            "canComment": true,
            "canCopy": true,
            "canDelete": true,
            "canDownload": true,
            "canEdit": true,
            "canListChildren": true,
            "canModifyContent": true,
            "canMoveChildrenWithinDrive": true,
            "canMoveItemIntoTeamDrive": true,
            "canMoveItemOutOfDrive": true,
            "canMoveItemWithinDrive": true,
            "canReadRevisions": false,
            "canRemoveChildren": true,
            "canRemoveMyDriveParent": true,
            "canRename": true,
            "canShare": true,
            "canTrash": true,
            "canUntrash": true
          };
        } else {
          item.mimeType = "one-note"; 
          item.capabilities = {
            "canAddChildren": false,
            "canAddMyDriveParent": false,
            "canChangeCopyRequiresWriterPermission": true,
            "canChangeViewersCanCopyContent": true,
            "canComment": true,
            "canCopy": true,
            "canDelete": true,
            "canDownload": true,
            "canEdit": true,
            "canListChildren": false,
            "canModifyContent": true,
            "canMoveChildrenWithinDrive": false,
            "canMoveItemIntoTeamDrive": true,
            "canMoveItemOutOfDrive": true,
            "canMoveItemWithinDrive": true,
            "canReadRevisions": true,
            "canRemoveChildren": false,
            "canRemoveMyDriveParent": true,
            "canRename": true,
            "canShare": true,
            "canTrash": true,
            "canUntrash": true
          };
        }
      });

      return fullItems;
    } catch (err) {
      console.log(err);
    }
  },
  upload: async (drive, listFileUpload, folderId, fileIndex) => {

    var tempFileUpload = (listFileUpload[fileIndex]) ? listFileUpload[fileIndex] : listFileUpload;
    try {
      const folder = await drive.api(`/me/drive/items/${folderId}`).get();
      var folderName = folder.name;
      var folderPath = folder.parentReference.path.split("/drive/root:")[1];
    } catch (error) {
      console.log(error);
    }

    fileUpload = async (drive, file) => {
      try {
        let response = await largeFileUpload(drive, file, folderId, folderName, folderPath);
        console.log(response);
        console.log("File Uploaded Successfully.!!");
        return response;
      } catch (error) {
        console.log(error);
      }
    }
    return fileUpload(drive, tempFileUpload);
  },
  downloadFile: (drive, fileId, dest) => {
    return new Promise(async function(resolve) {
      try{
          fileDownload = async () => {
              let downloadStream = await drive.api('/me/drive/items/'+ fileId +'/content').getStream();
              await new Promise((resolve1, reject1) => {
                  downloadStream.pipe(dest);
                  dest.on('finish', () => {
                      console.log('Done');
                  });
                  dest.on("close", resolve1);
                  dest.on('error', err => {
                      console.log('Error', err);
                  });
              });
              resolve();
          }
          await fileDownload();
      } catch(err){ throw new Error(err);}
    });
  },
  downloadFolder: (listFiles, drive, dir, countFolder = 0) => {
    return new Promise(async function(resolve) {
      if(listFiles.length > 0){
        //count number of folder in folder
        await listFiles.map(async (file) => {
          if(file.mimeType == "folder"){
            countFolder++;
          }
        });
  
        folderDownload = async () => {
            //download file in folder
            for(const file of listFiles){
                let dirFile = dir + "/" + file.name;
                if (file.mimeType != "folder") {
                    let dest = fs.createWriteStream(dirFile);
                    let downloadStream = await drive.api('/me/drive/items/'+ file.id +'/content').getStream();
                    await new Promise((resolve1, reject1)=> {
                        downloadStream.pipe(dest);
                        dest.on('finish', () => {
                            console.log('Done');
                        });
                        dest.on("close", resolve1);
                        dest.on('error', err => {
                            console.log('Error', err);
                        });
                    });
                } else {
                    try {
                        let dirFolder = dir + "/" + file.name;
                        fs.mkdirSync(dirFolder, { recursive: true });
                        var getItemInFolder = await require('./onedrive.controller').getFileOfFolder(drive, file.id);
                        await require('./onedrive.controller').downloadFolder(getItemInFolder, drive, dirFolder, 0);
                        countFolder--;
                    } catch (error) {
                        console.log(error);
                    }
                }  
            };
        }
        await folderDownload();
        if (countFolder == 0) {
            resolve();
        }
      };
    });
  },
  rename: (drive, fileId, newName) => {
    try{
        fileRename = async () => {
          return new Promise(resolve => 
            drive.api('/me/drive/items/'+ fileId ).patch({name: newName}, function (err, file) {
              if (err) {
                  console.log('Can not rename file');
              } else {
                  console.log('Files renamed');
              }
              resolve();
          }));
        }
        return fileRename();
    } catch(err){ throw new Error(err);}
  },
  delete: async (drive, fileId) => {
    try{
        fileDelete = async () => {
            return new Promise(resolve =>  
              drive.api('/me/drive/items/'+ fileId ).delete((err, file) => {
                if (err) {
                    console.log('Can not delete file to trash');
                } else {
                    console.log('Files deleted to trash');
                }
                resolve();
              }));
        }
        return fileDelete();
    } catch(err){ 
      throw new Error(err);
    }
  },
  duplicate: async (drive, fileId, destination) => {
    try{
      fileDuplicate = async () => {
          return new Promise((resolve, reject) =>  
            drive.api('/me/drive/items/'+ fileId).get(async (err, file) => {
                if (err) {
                    console.log('Can not get file');
                } else {
                  try {
                    let i = 0;
                    var rawResponse = new Response();
                    do {
                      if (i == 0 ) {
                        var indexText = "";
                      } else {
                        var indexText = `Copy of (${i})`;
                      }

                      if (destination) {
                        var parentReference = {"id": destination};
                      } else {
                        var parentReference = file.parentReference;
                      }

                      var options = {
                        "parentReference": parentReference,
                        "name": `${indexText} ${file.name}`
                      }
                      rawResponse = await drive.api('/me/drive/items/'+ fileId +'/copy').responseType(graph.ResponseType.RAW).post(options);
                      i = i + 1;
                    } while (rawResponse.statusText != "Accepted");
                    
                    if (rawResponse.statusText == "Accepted") {
                      getProgress = async () => {
                        try {
                          function streamToString(stream, cb) {
                            const chunks = [];
                            stream.on('data', (chunk) => {
                              chunks.push(chunk.toString());
                            });
                            stream.on('end', () => {
                              cb(chunks.join(''));
                            });
                          }
                          
                          var progress = await drive.api(rawResponse.headers._headers.location[0]).responseType(graph.ResponseType.RAW).get();
                          streamToString(progress.body, (data) => {
                            let progressDone = JSON.parse(data);
                            drive.api('/me/drive/items/'+ progressDone.resourceId).get(async (err, file) => {
                              if (err) {
                                console.log('Can not get file');
                                reject(err);
                              } else {
                                resolve(file);
                              }
                            });
                          });
                        } catch (error) {
                          console.log(error);
                        }
                      };
                      getProgress();
                    } else {
                      console.log(rawResponse.statusText);
                      resolve(rawResponse.statusText);
                    }
                  } catch (error) {
                    console.log(error);
                  }
                }
              })
           );
      }
      return fileDuplicate();
    } catch(err){ 
      throw new Error(err);
    }
  },
  createFolder: async (drive, nameFolder, parents) => {
    try{
      CreateFolder = async () => {
            var options = {
              "name": nameFolder,
              "folder": { },
              "@microsoft.graph.conflictBehavior": "rename"
            };

            if (parents == "root"){
              var url = "/me/drive/root/children";
            } else {
              var url = `/me/drive/items/${parents}/children`;
            }

            return new Promise(resolve =>  
              drive.api(url).post(options, (err, folder) => {
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
    } catch(err){ 
      throw new Error(err);
    }
  },
  getMyDrive: async function(client) {
    //var items = await client.api('/me/drive/root/children?$expand=thumbnails').get();
    try {
      //var listItems = [];
      var fullItems = await client.api('/me/drive/root/children?$expand=thumbnails').get();
      // listItems = [...itemsPage1.value];
      // const fullItems = await getAll(itemsPage1, listItems, client);
      await fullItems.value.map((item) => {
        if (item.file){
          item.mimeType = item.file.mimeType;
          item.capabilities = {
            "canAddChildren": false,
            "canAddMyDriveParent": false,
            "canChangeCopyRequiresWriterPermission": true,
            "canChangeViewersCanCopyContent": true,
            "canComment": true,
            "canCopy": true,
            "canDelete": true,
            "canDownload": true,
            "canEdit": true,
            "canListChildren": false,
            "canModifyContent": true,
            "canMoveChildrenWithinDrive": false,
            "canMoveItemIntoTeamDrive": true,
            "canMoveItemOutOfDrive": true,
            "canMoveItemWithinDrive": true,
            "canReadRevisions": true,
            "canRemoveChildren": false,
            "canRemoveMyDriveParent": true,
            "canRename": true,
            "canShare": true,
            "canTrash": true,
            "canUntrash": true
          };
        } else if (item.folder) {
            item.mimeType = "folder"; 
            item.capabilities = {
              "canAddChildren": true,
              "canAddMyDriveParent": false,
              "canChangeCopyRequiresWriterPermission": false,
              "canChangeViewersCanCopyContent": false,
              "canComment": true,
              "canCopy": true,
              "canDelete": true,
              "canDownload": true,
              "canEdit": true,
              "canListChildren": true,
              "canModifyContent": true,
              "canMoveChildrenWithinDrive": true,
              "canMoveItemIntoTeamDrive": true,
              "canMoveItemOutOfDrive": true,
              "canMoveItemWithinDrive": true,
              "canReadRevisions": false,
              "canRemoveChildren": true,
              "canRemoveMyDriveParent": true,
              "canRename": true,
              "canShare": true,
              "canTrash": true,
              "canUntrash": true
            };
          } else {
            item.mimeType = "one-note";  
            item.capabilities = {
              "canAddChildren": false,
              "canAddMyDriveParent": false,
              "canChangeCopyRequiresWriterPermission": true,
              "canChangeViewersCanCopyContent": true,
              "canComment": true,
              "canCopy": true,
              "canDelete": true,
              "canDownload": true,
              "canEdit": true,
              "canListChildren": false,
              "canModifyContent": true,
              "canMoveChildrenWithinDrive": false,
              "canMoveItemIntoTeamDrive": true,
              "canMoveItemOutOfDrive": true,
              "canMoveItemWithinDrive": true,
              "canReadRevisions": true,
              "canRemoveChildren": false,
              "canRemoveMyDriveParent": true,
              "canRename": true,
              "canShare": true,
              "canTrash": true,
              "canUntrash": true
            };
          }

        if (item.thumbnails.length > 0 ){
          item.thumbnailLink = item.thumbnails[0].large.url;
        } else {
          item.thumbnailLink ="";
        }
      });   
      return fullItems.value;
    } catch (err) {
      console.log(err);
    }
  },
  getFileOfFolder: async (client, folderID) => {
    //var items = await client.api('/me/drive/root/children?$expand=thumbnails').get();
    try {
      //var listItems = [];
      var fullItems = await client.api(`/me/drive/items/${folderID}/children?$expand=thumbnails`).get();
      // listItems = [...itemsPage1.value];
      // const fullItems = await getAll(itemsPage1, listItems, client);
      await fullItems.value.map((item) => {
        if (item.file){
          item.mimeType = item.file.mimeType;
          item.capabilities = {
            "canAddChildren": false,
            "canAddMyDriveParent": false,
            "canChangeCopyRequiresWriterPermission": true,
            "canChangeViewersCanCopyContent": true,
            "canComment": true,
            "canCopy": true,
            "canDelete": true,
            "canDownload": true,
            "canEdit": true,
            "canListChildren": false,
            "canModifyContent": true,
            "canMoveChildrenWithinDrive": false,
            "canMoveItemIntoTeamDrive": true,
            "canMoveItemOutOfDrive": true,
            "canMoveItemWithinDrive": true,
            "canReadRevisions": true,
            "canRemoveChildren": false,
            "canRemoveMyDriveParent": true,
            "canRename": true,
            "canShare": true,
            "canTrash": true,
            "canUntrash": true
          };
        } else if (item.folder) {
          item.mimeType = "folder"; 
          item.capabilities = {
            "canAddChildren": true,
            "canAddMyDriveParent": false,
            "canChangeCopyRequiresWriterPermission": false,
            "canChangeViewersCanCopyContent": false,
            "canComment": true,
            "canCopy": true,
            "canDelete": true,
            "canDownload": true,
            "canEdit": true,
            "canListChildren": true,
            "canModifyContent": true,
            "canMoveChildrenWithinDrive": true,
            "canMoveItemIntoTeamDrive": true,
            "canMoveItemOutOfDrive": true,
            "canMoveItemWithinDrive": true,
            "canReadRevisions": false,
            "canRemoveChildren": true,
            "canRemoveMyDriveParent": true,
            "canRename": true,
            "canShare": true,
            "canTrash": true,
            "canUntrash": true
          };
        } else {
          item.mimeType = "one-note";  
          item.capabilities = {
            "canAddChildren": false,
            "canAddMyDriveParent": false,
            "canChangeCopyRequiresWriterPermission": true,
            "canChangeViewersCanCopyContent": true,
            "canComment": true,
            "canCopy": true,
            "canDelete": true,
            "canDownload": true,
            "canEdit": true,
            "canListChildren": false,
            "canModifyContent": true,
            "canMoveChildrenWithinDrive": false,
            "canMoveItemIntoTeamDrive": true,
            "canMoveItemOutOfDrive": true,
            "canMoveItemWithinDrive": true,
            "canReadRevisions": true,
            "canRemoveChildren": false,
            "canRemoveMyDriveParent": true,
            "canRename": true,
            "canShare": true,
            "canTrash": true,
            "canUntrash": true
          };
        }

        if (item.thumbnails.length > 0 ){
          item.thumbnailLink = item.thumbnails[0].large.url;
        } else {
          item.thumbnailLink ="";
        }
      });   
      return fullItems.value;
    } catch (err) {
      console.log(err);
    }
  },
  getFileByID: async (client, fileId) => {
    try {
      //var listItems = [];
      var item = await client.api(`/me/drive/items/${fileId}?$expand=thumbnails`).get();
      // listItems = [...itemsPage1.value];
      // const fullItems = await getAll(itemsPage1, listItems, client);
      if (item.file){
        item.mimeType = item.file.mimeType;
        item.capabilities = {
          "canAddChildren": false,
          "canAddMyDriveParent": false,
          "canChangeCopyRequiresWriterPermission": true,
          "canChangeViewersCanCopyContent": true,
          "canComment": true,
          "canCopy": true,
          "canDelete": true,
          "canDownload": true,
          "canEdit": true,
          "canListChildren": false,
          "canModifyContent": true,
          "canMoveChildrenWithinDrive": false,
          "canMoveItemIntoTeamDrive": true,
          "canMoveItemOutOfDrive": true,
          "canMoveItemWithinDrive": true,
          "canReadRevisions": true,
          "canRemoveChildren": false,
          "canRemoveMyDriveParent": true,
          "canRename": true,
          "canShare": true,
          "canTrash": true,
          "canUntrash": true
        };
      } else if (item.folder) {
        item.mimeType = "folder"; 
        item.capabilities = {
          "canAddChildren": true,
          "canAddMyDriveParent": false,
          "canChangeCopyRequiresWriterPermission": false,
          "canChangeViewersCanCopyContent": false,
          "canComment": true,
          "canCopy": true,
          "canDelete": true,
          "canDownload": true,
          "canEdit": true,
          "canListChildren": true,
          "canModifyContent": true,
          "canMoveChildrenWithinDrive": true,
          "canMoveItemIntoTeamDrive": true,
          "canMoveItemOutOfDrive": true,
          "canMoveItemWithinDrive": true,
          "canReadRevisions": false,
          "canRemoveChildren": true,
          "canRemoveMyDriveParent": true,
          "canRename": true,
          "canShare": true,
          "canTrash": true,
          "canUntrash": true
        };
      } else {
        item.mimeType = "one-note";  
        item.capabilities = {
          "canAddChildren": false,
          "canAddMyDriveParent": false,
          "canChangeCopyRequiresWriterPermission": true,
          "canChangeViewersCanCopyContent": true,
          "canComment": true,
          "canCopy": true,
          "canDelete": true,
          "canDownload": true,
          "canEdit": true,
          "canListChildren": false,
          "canModifyContent": true,
          "canMoveChildrenWithinDrive": false,
          "canMoveItemIntoTeamDrive": true,
          "canMoveItemOutOfDrive": true,
          "canMoveItemWithinDrive": true,
          "canReadRevisions": true,
          "canRemoveChildren": false,
          "canRemoveMyDriveParent": true,
          "canRename": true,
          "canShare": true,
          "canTrash": true,
          "canUntrash": true
        };
      }

      if (item.thumbnails.length > 0 ){
        item.thumbnailLink = item.thumbnails[0].large.url;
      } else {
        item.thumbnailLink ="";
      } 
      return item;
    } catch (err) {
      console.log(err);
    }
  },
  getFileShareWithMe: async function(client) {
    try {
      var fullItems = await client.api('/me/drive/sharedWithMe').get();
      await fullItems.value.map((item) => {
        if (item.file){
          item.mimeType = item.file.mimeType;
          item.capabilities = {
            "canAddChildren": false,
            "canAddMyDriveParent": false,
            "canChangeCopyRequiresWriterPermission": true,
            "canChangeViewersCanCopyContent": true,
            "canComment": true,
            "canCopy": true,
            "canDelete": true,
            "canDownload": true,
            "canEdit": true,
            "canListChildren": false,
            "canModifyContent": true,
            "canMoveChildrenWithinDrive": false,
            "canMoveItemIntoTeamDrive": true,
            "canMoveItemOutOfDrive": true,
            "canMoveItemWithinDrive": true,
            "canReadRevisions": true,
            "canRemoveChildren": false,
            "canRemoveMyDriveParent": true,
            "canRename": true,
            "canShare": true,
            "canTrash": true,
            "canUntrash": true
          };
        } else if (item.folder) {
          item.mimeType = "folder"; 
          item.capabilities = {
            "canAddChildren": true,
            "canAddMyDriveParent": false,
            "canChangeCopyRequiresWriterPermission": false,
            "canChangeViewersCanCopyContent": false,
            "canComment": true,
            "canCopy": true,
            "canDelete": true,
            "canDownload": true,
            "canEdit": true,
            "canListChildren": true,
            "canModifyContent": true,
            "canMoveChildrenWithinDrive": true,
            "canMoveItemIntoTeamDrive": true,
            "canMoveItemOutOfDrive": true,
            "canMoveItemWithinDrive": true,
            "canReadRevisions": false,
            "canRemoveChildren": true,
            "canRemoveMyDriveParent": true,
            "canRename": true,
            "canShare": true,
            "canTrash": true,
            "canUntrash": true
          };
        } else {
          item.mimeType = "one-note";  
          item.capabilities = {
            "canAddChildren": false,
            "canAddMyDriveParent": false,
            "canChangeCopyRequiresWriterPermission": true,
            "canChangeViewersCanCopyContent": true,
            "canComment": true,
            "canCopy": true,
            "canDelete": true,
            "canDownload": true,
            "canEdit": true,
            "canListChildren": false,
            "canModifyContent": true,
            "canMoveChildrenWithinDrive": false,
            "canMoveItemIntoTeamDrive": true,
            "canMoveItemOutOfDrive": true,
            "canMoveItemWithinDrive": true,
            "canReadRevisions": true,
            "canRemoveChildren": false,
            "canRemoveMyDriveParent": true,
            "canRename": true,
            "canShare": true,
            "canTrash": true,
            "canUntrash": true
          };
        }

        if (item.thumbnails){
          item.thumbnailLink = item.thumbnails[0].large.url;
        } else {
          item.thumbnailLink ="";
        }
      });   
      return fullItems.value;
    } catch (err) {
      console.log(err);
    }
  },
  getInfoDrive: async (token) => {
    try{
      getInfoDrive = async () => {
        var drive = await getAuthenticatedClient(token);
        return new Promise(resolve =>  
          drive.api('/me/drive').get((err, info) => {
            if (err) {
                console.log('Can not get info drive');
            } else {
                console.log('Get info successfuly');
            }
            resolve(info.quota);
          }));
        }
        return getInfoDrive();
    } catch(err){ 
      throw new Error(err);
    }
  },
  moveBetweenOneAccount: async (drive, fileId, folderDestinationID) => {
    try{
      move = async () => {
            var options = {
              "parentReference": {
                "id": folderDestinationID
              }
            };
            try {
              return new Promise((resolve, reject) =>  
                drive.api(`/me/drive/items/${fileId}`).patch(options, (err, res) => {
                  if (err) {
                      console.log('Can not move file');
                      reject(err);
                      resolve();
                  } else {
                      console.log('Moved file successfully');
                      resolve(res);
                  }
                }));
            } catch (err) {
              if (err) {
                  console.log('The API returned an error: ' + err);
                  return;
              }
            }
        }
        return move();
    } catch(err){ 
      throw new Error(err);
    }
  },
  addPermissionFileShare: async (drive, fileID, role, type) => {
    try{
      addPermission = async () => {
            var options = {
                "type": role,
                "scope": type
            };
            try {
              return new Promise((resolve, reject) =>  
                drive.api(`/me/drive/items/${fileID}/createLink`).post(options, (err, res) => {
                  if (err) {
                      console.log('Can not get share link file');
                      reject(err);
                      resolve();
                  } else {
                      console.log('Get share link successfully');
                      resolve(res.link.webUrl);
                  }
                }));
            } catch (err) {
              if (err) {
                  console.log('The API returned an error: ' + err);
                  return;
              }
            }
        }
        return addPermission();
    } catch(err){ 
      throw new Error(err);
    }
  },
  // undoFromTrash: async (drive, fileId) => {
  //   try{
  //       fileUndoFromTrash = async () => {
  //           return new Promise(resolve =>  
  //             drive.api('/me/drive/items/'+ fileId).get((err, file) => {
  //               if (err) {
  //                   console.log('Can not restore file to trash');
  //               } else {
  //                   console.log('Files restored to trash');
  //                   console.log(file);
  //               }
  //               resolve();
  //             }));
  //       }
  //       return fileUndoFromTrash();
  //   } catch(err){ 
  //     throw new Error(err);
  //   }
  // }
};

 async function getAll(itemsPage1, listItems, client){
  return new Promise(async function(resolve, reject) {
    if (itemsPage1["@odata.nextLink"]) {
      try {
        var itemsPage2 = await client.api(itemsPage1["@odata.nextLink"]).get();
      } catch (error) {
        console.log(error);
      }
      listItems = [...listItems, ...itemsPage2.value];
      await getAll(itemsPage2, listItems, client);
      resolve(listItems);
    } else { 
      try {
        var itemsPage2 = await client.api(itemsPage1["@odata.nextLink"]).get();
      } catch (error) {
        console.log(error);
      }
      if (itemsPage2){
        listItems = [...listItems, ...itemsPage2.value];
        await getAll(itemsPage2, listItems, client);
      }
      resolve(listItems);
      return resolve(listItems);
    }
  });
}



//  getAllFiles= async (itemsRoot, listItems, client)=>{
//   if(itemsRoot.length > 0){
//       itemsRoot.map(async (item) => {
//         if (item.file){
//           item.mimeType = item.file.mimeType;
//           if (item.thumbnails.length > 0 ){
//             item.thumbnailLink = item.thumbnails[0].large.url;
//           } else {
//             item.thumbnailLink ="";
//           }
//         } else if (item.folder){
//           item.mimeType = "folder";
//           try {
//             const getItemInFolder = await client.api(`/me/drive/items/${item.id}/children?$expand=thumbnails`).get();
//             itemInFolder =  await getAllFiles(getItemInFolder.value, listItems, client);
//             listItems = [...listItems, ...itemInFolder];
//           } catch (error) {
//             console.log(error);
//           }
//         } else item.mimeType = "one-note"; 
//       });
//   };
//   return listItems
  // resolve(listItems);


async function getAllFiles(itemsRoot, listItems, client, countFolder = 0){
  return new Promise(async function(resolve) {
    if(itemsRoot.length > 0){
      //count number of folder in folder
      await itemsRoot.map(async (item) => {
        if(item.folder){
          countFolder++;
        }
      });

      getInfoAllFolder = async () => {
        await itemsRoot.map(async (item) => {
          if (item.folder){
              try {
                const getItemInFolder = await client.api(`/me/drive/items/${item.id}/children?$expand=thumbnails`).get();
                listItems = [...listItems, ...getItemInFolder.value];
                const itemInFolder = await getAllFiles(getItemInFolder.value, listItems, client, 0);
                countFolder--;
                if (countFolder == 0) {
                  resolve(itemInFolder);
                }
              } catch (error) {
                console.log(error);
              }
          }  
        });
      }
      await getInfoAllFolder();

      if (countFolder == 0) {
        resolve(listItems);
      }
    };
  });
}

async function largeFileUpload(drive, file, folderId, folderName, folderPath) {
  return new Promise(async function(resolve) {
    try {
      let options = {
        path: (folderId == "") ? "/Upload" : ((folderPath !="") ? `/${folderPath}/${folderName}` : `/${folderName}`),
        fileName: file.name,
        rangeSize: 1024 * 1024,
      };
      
      fs.readFile(file.tempFilePath, async function(err, data) {
        const uploadTask = await graph.OneDriveLargeFileUploadTask.create( drive, data, options);
        var response = await uploadTask.upload();
        resolve(response);
      });
    } catch (err) {
      throw err;
    }
  });
}

getAuthenticatedClient = (accessToken) => {

  // Initialize Graph client
  const client = graph.Client.init({
    // Use the provided access token to authenticate requests
    authProvider: (done) => {
      done(null, accessToken);
    }
  });

  return client;
}


