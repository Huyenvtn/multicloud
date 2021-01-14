const {google} = require('googleapis'); 
var User = require('../models/users.model');
var fs = require('fs');
const os = require('os');
const { resolve } = require('path');
var refresh = require('passport-oauth2-refresh');

//get list files from drive
module.exports = {
    getListFiles : async (token, refreshToken, req) => {
        var drive = await googleDriveAuth(token, refreshToken);
    
        return new Promise(resolve => drive.files.list({
          //orderBy: 'modifiedTime desc',
          //q: '"root" in parents',
          pageSize: 1000, 
          fields: 'files(id, name, size, mimeType, thumbnailLink, webViewLink, createdTime, modifiedTime, parents, capabilities)',
        }, async (err, res) => {
            if (err) {
                console.log('The API returned an error: ' + err);
                if (err.response.status === 400) {
                    let newDrive =  await handleTokenExpired(token, refreshToken, req);
                    let new_access_token = newDrive.context._options.auth.credentials.access_token;
                    let new_refresh_token = newDrive.context._options.auth.credentials.refresh_token;
                    let listFiles = require('./google.controller').getListFiles(new_access_token, new_refresh_token, req);
                    resolve(await listFiles);
                }
            }
            if (res) {
                var listFiles = [];
                listFiles = res.data.files;
                getSizeFolder = async () => {
                    await listFiles.map(async (file) => {
                        if (file.mimeType == "application/vnd.google-apps.folder"){
                            function query(fileOfFolder) {
                                    if (fileOfFolder.parents){
                                        return fileOfFolder.parents.includes(file.id);
                                    } else return false;
                              }
                            const getItemInFolder = listFiles.filter(query); 
                            file.size = await getSizeOfFolder(listFiles, getItemInFolder, 0, drive, 0);
                        }
                    });
                    return listFiles;
                }
                return resolve(await getSizeFolder());
            }
        }));
    },
    getFileByID: async (drive, fileId, req) => {
        var access_token = drive.context._options.auth.credentials.access_token;
        var refresh_token = drive.context._options.auth.credentials.refresh_token;
        return new Promise(resolve =>  drive.files.get({
            fileId, 
            fields: 'id, name, size, mimeType, thumbnailLink, webViewLink, createdTime, modifiedTime, parents, capabilities'}, 
            async function (err, file) {
            if (err) {
                console.log('File not exists');
                if (err.response.status === 400) {
                    let newDrive =  await handleTokenExpired(access_token, refresh_token, req);
                    let fileByID = require('./google.controller').getFileByID(newDrive, fileId, req);
                    resolve(await fileByID);
                }
            } else {
                return resolve(file.data);
            }
        }));
    },
    upload: async (drive, listFileUpload, folderId, fileIndex, req) => {
        var access_token = drive.context._options.auth.credentials.access_token;
        var refresh_token = drive.context._options.auth.credentials.refresh_token;
        const parents = (folderId != "") ? [folderId] : undefined;
        var { name: filename, mimetype, tempFilePath: tempFilePath } = (listFileUpload[fileIndex]) ? listFileUpload[fileIndex] : listFileUpload;
        return new Promise(resolve =>  drive.files.create({
            resource: {
                name: filename,
                parents
            },
            media: {
                mimeType: mimetype,
                body: fs.createReadStream(tempFilePath)
                //body: Buffer.from(data).toString()
            }
        }, async (err, driveResponse) => {
            if (err) {
                console.log('The API returned an error: ' + err);
                if (err.response.status === 400) {
                    let newDrive =  await handleTokenExpired(access_token, refresh_token, req);
                    let file = require('./google.controller').upload(newDrive, listFileUpload, folderId, fileIndex, req);
                    resolve(await file);
                }
            }
            if (driveResponse) {
                getFileUpload = async () => {
                    return new Promise(resolve2 => drive.files.get({fileId: driveResponse.data.id, 
                    fields: 'id, name, size, mimeType, thumbnailLink, webViewLink, createdTime, modifiedTime, parents, capabilities'},
                    async function (err, file) {
                        if (err) {
                            console.log('File not exists');
                            console.error(err);
                        } else {
                            return resolve2(file.data);
                        }
                    }));
                }
                resolve(await getFileUpload());
            }
        }));
    },
    downloadFile: (drive, fileId, dest, req) => {
        var access_token = drive.context._options.auth.credentials.access_token;
        var refresh_token = drive.context._options.auth.credentials.refresh_token;
        return new Promise(async function(resolve) {
            try{
                fileDownload = async () => {
                    try {
                        let downloadStream = await drive.files.get({fileId: fileId, alt: 'media'}, {responseType: 'stream'});
                        await new Promise((resolve1, reject1)=> {
                            downloadStream.data.pipe(dest);
                            dest.on('finish', () => {
                                console.log('Done');
                            });
                            dest.on("close", resolve1);
                            dest.on('error', err => {
                                console.log('Error', err);
                            });
                        });
                        resolve();
                    } catch (err) {
                        if (err.response.status === 400) {
                            let newDrive =  await handleTokenExpired(access_token, refresh_token, req);
                            resolve(await require('./google.controller').downloadFile(newDrive, fileId, dest, req));
                        }
                    }
                }
                await fileDownload();
            } catch(err){ 
                throw new Error(err);
            }
        });
    },
    downloadFolder: (listFiles, drive, dir, countFolder = 0, req) => {
        var access_token = drive.context._options.auth.credentials.access_token;
        var refresh_token = drive.context._options.auth.credentials.refresh_token;
        return new Promise(async function(resolve) {
          if(listFiles.length > 0){
            //count number of folder in folder
            await listFiles.map(async (file) => {
              if(file.mimeType == "application/vnd.google-apps.folder"){
                countFolder++;
              }
            });
      
            folderDownload = async () => {
                //download file in folder
                for(const file of listFiles){
                    let dirFile = dir + "/" + file.name;
                    if (file.mimeType != "application/vnd.google-apps.folder") {
                        try {
                            let dest = fs.createWriteStream(dirFile);
                            let downloadStream = await drive.files.get({fileId: file.id, alt: 'media'}, {responseType: 'stream'});
                            await new Promise((resolve1, reject1)=> {
                                downloadStream.data.pipe(dest);
                                dest.on('finish', () => {
                                    console.log('Done');
                                });
                                dest.on("close", resolve1);
                                dest.on('error', err => {
                                    console.log('Error', err);
                                });
                            });
                        } catch (err) {
                            if (err.response.status === 400) {
                                let newDrive =  await handleTokenExpired(access_token, refresh_token, req);
                                resolve(await require('./google.controller').downloadFolder(listFiles, newDrive, dir, countFolder = 0, req));
                            }
                        }
                    } else {
                        try {
                            let dirFolder = dir + "/" + file.name;
                            fs.mkdirSync(dirFolder, { recursive: true });
                            var getItemInFolder = await require('./google.controller').getFileOfFolder(drive, file.id);
                            await require('./google.controller').downloadFolder(getItemInFolder, drive, dirFolder, 0, req);
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
    rename: (drive, fileId, newName, req) => {
        var access_token = drive.context._options.auth.credentials.access_token;
        var refresh_token = drive.context._options.auth.credentials.refresh_token;
        try{
            fileRename = async () => {
                return new Promise(resolve =>  drive.files.get({fileId: fileId},
                async function(err, file){ 
                    if (err) {
                        console.log('File not exists');
                        if (err.response.status === 400 || err.response.status === 401) {
                            let newDrive =  await handleTokenExpired(access_token, refresh_token, req);
                            resolve(await require('./google.controller').rename(newDrive, fileId, newName, req));
                        }
                    } else {
                        drive.files.update({fileId, requestBody: {name: newName}}, function (err, file) {
                            if (err) {
                                console.log('Can not rename file');
                            } else {
                                console.log('Files renamed');
                            }
                            resolve();
                        });
                    }
                }));
            }
            return fileRename();
        } catch(err){ throw new Error(err);}
    },
    moveBetweenOneAccount: (drive, fileId, folderHeadID, folderDestinationID, req) => {
        var access_token = drive.context._options.auth.credentials.access_token;
        var refresh_token = drive.context._options.auth.credentials.refresh_token;
        try{
            moveFile = async () => {
                return new Promise(resolve => 
                    drive.files.get({fileId: fileId, fields: 'parents'}, async function (err, res) {
                        if (err) {
                            console.log('File not exists');
                            console.error(err);
                            if (err.response.status === 400 || err.response.status === 401) {
                                let newDrive =  await handleTokenExpired(access_token, refresh_token, req);
                                let file = require('./google.controller').moveBetweenOneAccount(newDrive, fileId, folderHeadID, folderDestinationID, req);
                                resolve(await file);
                            }
                        } else {
                            // Move the file to the new folder
                            var previousParents = folderHeadID ? folderHeadID : "root";
                            drive.files.update({
                                fileId: fileId,
                                fields: 'id, name, size, mimeType, thumbnailLink, webViewLink, createdTime, modifiedTime, parents, capabilities',
                                addParents: folderDestinationID,
                                removeParents: previousParents,
                            }, function (err, file) {
                                if (err) {
                                    console.log('Can not move file');
                                } else {
                                    console.log('Files moved');
                                }
                                resolve(file.data);
                            });
                        }
                    })
                );
            }
            return moveFile();
        } catch(err){ throw new Error(err);}
    },
    copyBetweenOneAccount: (drive, fileId, folderDestinationID, req) => {
        var access_token = drive.context._options.auth.credentials.access_token;
        var refresh_token = drive.context._options.auth.credentials.refresh_token;
        try{
            copyFile = async () => {
                return new Promise(resolve =>  
                    drive.files.copy({fileId, fields: 'id, parents'}, async function (err, file) {
                        if (err) {
                            console.log('Can not copy file');
                            console.error(err);
                            if (err.response.status === 400) {
                                let newDrive =  await handleTokenExpired(access_token, refresh_token, req);
                                let file = require('./google.controller').copyBetweenOneAccount(newDrive, fileId, folderDestinationID, req);
                                resolve(await file);
                            }
                        } else {
                        // Copy the file to the new folder
                        var previousParents = file.data.parents ? file.data.parents.join(',') : "root";
                        drive.files.update({
                            fileId: file.data.id,
                            fields: 'id, name, size, mimeType, thumbnailLink, webViewLink, createdTime, modifiedTime, parents, capabilities',
                            addParents: folderDestinationID,
                            removeParents: previousParents,
                        }, function (err, file) {
                            if (err) {
                                console.log('Can not copy file');
                            } else {
                                console.log('Files copied');
                            }
                            resolve(file.data);
                        });
                      }
                    })
                );
            }
            return copyFile();
        } catch(err){ throw new Error(err);}
    },
    // deleteToTrash: async (drive, fileId) => {
    //     try{
    //         fileDeleteToTrash = async () => {
    //             return new Promise(resolve =>  drive.files.update({fileId, requestBody: {trashed: 'true'}}, 
    //             function (err) {
    //                 if (err) {
    //                     console.log('Can not delete file to trash');
    //                 } else {
    //                     console.log('Files deleted to trash');
    //                 }
    //                 resolve();
    //             }));
    //         }
    //         return fileDeleteToTrash();
    //     } catch(err){ throw new Error(err);}
    // },
    // undoFromTrash: async (drive, fileId) => {
    //     try{
    //         fileUndoFromTrash = async () => {
    //             return new Promise(resolve =>  drive.files.update({fileId, requestBody: {trashed: 'false'}}, 
    //             function (err) {
    //                 if (err) {
    //                     console.log('Can not restore file to trash');
    //                 } else {
    //                     console.log('Files restored to trash');
    //                 }
    //                 resolve();
    //             }));
    //         }
    //         return fileUndoFromTrash();
    //     } catch(err){ throw new Error(err);}
    // },
    delete: async (drive, fileId, req) => {
        var access_token = drive.context._options.auth.credentials.access_token;
        var refresh_token = drive.context._options.auth.credentials.refresh_token;
        try{
            fileDelete = async () => {
                return new Promise(resolve =>  drive.files.get({fileId}, async function (err, file) {
                    if (err) {
                        console.log('File not exists');
                        if (err.response.status === 400) {
                            let newDrive =  await handleTokenExpired(access_token, refresh_token, req);
                            resolve( await require('./google.controller').delete(newDrive, fileId, req));
                        }
                    } else {
                        drive.files.delete({fileId}, function (err) {
                            if (err) {
                                console.log('Can not delete file');
                            } else {
                                console.log('Files deleted');
                            }
                            resolve();
                        });
                    }
                }));
            }
            return fileDelete();
        } catch(err){ throw new Error(err);}
    },
    duplicate: async (drive, fileId, req) => {
        var access_token = drive.context._options.auth.credentials.access_token;
        var refresh_token = drive.context._options.auth.credentials.refresh_token;
        try{
            fileDuplicate = async () => {
                return new Promise(resolve => drive.files.get({ fileId, fields: 'name' }, async function (err, file) {
                    if (err) {
                        console.log('File not exists');
                        if (err.response.status === 400) {
                            let newDrive =  await handleTokenExpired(access_token, refresh_token, req);
                            let file = require('./google.controller').duplicate(newDrive, fileId, req);
                            resolve(await file);
                        }
                    } else {
                        drive.files.copy({fileId, requestBody: {name: "Copy of " + file.data.name}}, function (err, file) {
                            if (err) {
                                console.log('Can not copy file');
                            } else {
                                drive.files.update({ fileId: file.data.id }, function (err, file) {
                                    if (err) {
                                        console.log('Can not duplicate');
                                    } else {
                                        console.log('Files dupliced');
                                    }
                                    resolve(file.data);
                                });
                            }
                        });
                    }
                }));
            }
            return fileDuplicate();
        } catch(err){ throw new Error(err);}
    },
    createFolder: async (drive, nameFolder, parents, req) => {
        var access_token = drive.context._options.auth.credentials.access_token;
        var refresh_token = drive.context._options.auth.credentials.refresh_token;
        try{
            CreateFolder = async () => {
                var fileMetadata = {'name': nameFolder, 'mimeType': 'application/vnd.google-apps.folder', 'parents':[parents]};
                return new Promise(resolve => drive.files.create({resource: fileMetadata,  fields: 'id, name, size, mimeType, thumbnailLink, webViewLink, createdTime, modifiedTime, parents, capabilities'}, async function (err, file) {
                    if (err) {
                        console.error(err);
                        if (err.response.status === 400) {
                            let newDrive =  await handleTokenExpired(access_token, refresh_token, req);
                            let folder = require('./google.controller').createFolder(newDrive, nameFolder, parents, req);
                            resolve(await folder);
                        }
                    } else {
                        console.log('Folder Created');
                        resolve(file.data);
                    }
                }));
            }
            return CreateFolder();
        } catch(err){ throw new Error(err);}
    }, 
    // getMyDrive: async (drive) => {
    //     return new Promise(resolve => drive.files.list({
    //         //orderBy: 'modifiedTime desc',
    //         q: '"root" in parents',
    //         pageSize: 1000, 
    //         fields: 'files(id, name, size, mimeType, thumbnailLink, webViewLink, createdTime, modifiedTime)',
    //         }, async (err, res) => {
    //             if (err) {
    //                 console.log('The API returned an error: ' + err);
    //             }
    //         const listFiles = res.data.files;
    //         return resolve(listFiles);
    //     }));
    // },
    getFileShareWithMe: async (drive, req) => {
        var access_token = drive.context._options.auth.credentials.access_token;
        var refresh_token = drive.context._options.auth.credentials.refresh_token;
        return new Promise(resolve => drive.files.list({
          //orderBy: 'modifiedTime desc',
          q: 'sharedWithMe = true',
          pageSize: 1000, 
          fields: 'files(id, name, size, mimeType, thumbnailLink, webViewLink, createdTime, modifiedTime, parents, capabilities)',
        }, async (err, res) => {
            if (err) {
                console.log('The API returned an error: ' + err);
                if (err.response.status === 400) {
                    let newDrive =  await handleTokenExpired(access_token, refresh_token, req);
                    let listFiles = require('./google.controller').getFileShareWithMe(newDrive, req);
                    resolve(await listFiles);
                }
            }
            if (res) {
                let listFiles = [];
                listFiles = res.data.files;
                console.log(listFiles);
                return resolve(listFiles);
            }
        }));
    },
    getInfoDrive : async (token, refreshToken) => {
        var drive = await googleDriveAuth(token, refreshToken);
    
        return new Promise(resolve => drive.about.get({
          fields: 'storageQuota',
        }, async (err, res) => {
            if (err) {
                console.log('The API returned an error: ' + err);
                if (err.response.status === 400) {
                    let newDrive =  await handleTokenExpired(token, refreshToken, req);
                    let storageQuota = require('./google.controller').getInfoDrive(newDrive, folderID, req);
                    resolve(await storageQuota);
                }
            }
            if (res) {
                var info = res.data;
                return resolve(info.storageQuota);
            }
        }));
    },
    addPermissionFileShare: async (drive, fileID, role, type, req) => {
        var access_token = drive.context._options.auth.credentials.access_token;
        var refresh_token = drive.context._options.auth.credentials.refresh_token;
        try {
            await drive.permissions.create({fileId: fileID, requestBody: {role, type}});
            return getLinkShare = new Promise(resolve => drive.files.get({fileId: fileID, fields: 'webViewLink'}, 
                async function (err, res) {
                    if (err) {
                        if (err.response.status === 400) {
                            let newDrive =  await handleTokenExpired(access_token, refresh_token, req);
                            let webViewLink = require('./google.controller').addPermissionFileShare(newDrive, fileID, role, type, req);
                            resolve(await webViewLink);
                        } else {
                            console.log('Can not get share link file');
                            resolve();
                        }
                    } else {  
                        console.log('Get share link successfully');
                        resolve(res.data.webViewLink);
                    }
                })
            );
        } catch (err) {
            if (err) {
                console.log('The API returned an error: ' + err);
                return;
            }
        }
    },
    getFileOfFolder: async (drive, folderID, req) => {
        var access_token = drive.context._options.auth.credentials.access_token;
        var refresh_token = drive.context._options.auth.credentials.refresh_token;
        return new Promise(resolve => drive.files.list({
            //orderBy: 'modifiedTime desc',
            q: `'${folderID}' in parents`,
            pageSize: 1000, 
            fields: 'files(id, name, size, mimeType, thumbnailLink, webViewLink, createdTime, modifiedTime, parents, capabilities)',
            }, async (err, res) => {
                if (err) {
                    console.log('The API returned an error: ' + err);
                    if (err.response.status === 400) {
                        let newDrive =  await handleTokenExpired(access_token, refresh_token, req);
                        let listFiles = require('./google.controller').getFileOfFolder(newDrive, folderID, req);
                        resolve(await listFiles);
                    }
                }
                if (res) {
                    let listFiles = [];
                    listFiles = res.data.files;
                    return resolve(listFiles);
                }
        }));
    },
    getSizeOfFolder
};


var getSizeOfFolder = async (listFiles, listItems, totalSize = 0, drive, countFolder = 0) => {
    return new Promise(async function(resolve) {
      if(listItems.length > 0){
        //count number of folder in folder
        await listItems.map(async (item) => {
          if(item.mimeType == "application/vnd.google-apps.folder"){
            countFolder++;
          } else {
              if(item.size){
                totalSize += parseInt(item.size);
              }
          }
        });
  
        getInfoAllFolder = async () => {
          await listItems.map(async (item) => {
            if (item.mimeType == "application/vnd.google-apps.folder"){
                try {
                    function query(fileOfFolder) {
                        if (fileOfFolder.parents){
                            return fileOfFolder.parents.includes(item.id);
                        } else return false;
                    }
                    const getItemInFolder = listFiles.filter(query);
                    const sizeOfFolder= await getSizeOfFolder(listFiles, getItemInFolder, totalSize, drive, 0);
                    countFolder--;
                    if (countFolder == 0) {
                        resolve(sizeOfFolder);
                    }
                } catch (error) {
                  console.log(error);
                }
            }  
          });
        }
        await getInfoAllFolder();
  
        if (countFolder == 0) {
          resolve(totalSize);
        }
      } else {
          resolve(0);
      };
    });
};

// config google drive with client token
googleDriveAuth = async (token, refreshToken) => {
    const oauth2Client = new google.auth.OAuth2();

    oauth2Client.setCredentials({ access_token: token, refresh_token: refreshToken });
    // if (oauth2Client.isTokenExpiring()) {
    //     refreshAccessToken((err, credentials) => {
    //         if (credentials.refresh_token) {
    //             User.updateOne(
    //                 { "google.token" : token },
    //                 { $set: {"google.token" : credentials.access_token, "google.refreshToken" : credentials.refresh_token} },
    //                 async function (err, user) {
    //                     if (err) {
    //                         console.log(err);
    //                     }
    //                     if (user) {
    //                         req.session.user = user;
    //                     } 
    //                 }
    //             );
    //             oauth2Client.setCredentials({ access_token: credentials.access_token, refresh_token: credentials.refresh_token });
    //         } else {
    //             User.updateOne(
    //                 { "google.token" : token },
    //                 { $set: {"google.token" : credentials.access_token} }, 
    //                 async function (err, user) {
    //                     if (err) {
    //                         console.log(err);
    //                     }
    //                     if (user) {
    //                         req.session.user = user;
    //                     } 
    //                 }
    //             );
    //             oauth2Client.setCredentials({ access_token: credentials.access_token, refresh_token: refreshToken });
    //         }
    //         console.log("accessToken:" + credentials.access_token);
    //     })
    // };

    return drive = google.drive({
        version: 'v3',
        auth: oauth2Client
    });
}

handleTokenExpired = async (token, refreshToken, req) => {
    return new Promise(async function(resolve) {
        refresh.requestNewAccessToken('google', refreshToken, async function(err, newAccessToken) {
            if(err || !newAccessToken) { 
                resolve(await googleDriveAuth(token, refreshToken)); 
            }

            // Save the new accessToken down database
            User.updateOne(
                { "google" : { $elemMatch: {'refreshToken': refreshToken} } },
                { $set: {"google.$.token" : newAccessToken} }, 
                async function (err, process) {
                    if (err) {
                        console.log(err);
                    }
                    User.findOne( { "google" : { $elemMatch: {'token': newAccessToken} } }, async function (err2, user) {
                        if (err2) {
                            console.log(err2);
                        }
                        if (user) {
                            req.session.user = user;
                            let newDrive = await googleDriveAuth(newAccessToken, refreshToken);
                            resolve(newDrive);
                        } 
                    });
                }
            );
        });
    });
}
