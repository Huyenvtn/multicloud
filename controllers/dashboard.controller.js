var googleController= require('../controllers/google.controller');
var onedriveController= require('../controllers/oneDrive.controller');
var dropboxController= require('../controllers/dropbox.controller');
const {google} = require('googleapis'); 
var File = require('../models/files.model');
var User = require('../models/users.model');
var fs = require('fs');
const os = require('os');
var path = require('path');
const nodemailer = require('nodemailer');
var config = require('../config');
var refresh = require('passport-oauth2-refresh');

module.exports = {
    dashboard: async (req, res) => {
        var filter = {};
        var user = req.user;
        getList = async () => {
            try {
                getAllCloudIdOfUser = async () => {
                    var allCloudIdOfUser = [];
                    await Promise.all([
                        user.google.map( (account) => { 
                            allCloudIdOfUser.push(account._id);
                        }),
                        user.onedrive.map( (account) => { 
                            allCloudIdOfUser.push(account._id);
                        }),
                        user.dropbox.map( (account) => { 
                            allCloudIdOfUser.push(account._id);
                        }),
                    ]);
                    return allCloudIdOfUser;
                }
                let allCloudId = await getAllCloudIdOfUser();
                let listFile = await File.find({driveID : { $in: allCloudId } });
                if (listFile.length > 0) {
                    var listFileParseJson = listFile.map((file) => {
                        return file = JSON.parse(JSON.stringify(file));
                    });
                    return await getInfoFileOfDrive(listFileParseJson, user);
                } else {
                    return [];
                }
            } catch (error) {
                if (error) console.log(error);
            }
        };   
        var listFile = await getList();
        res.render('dashboard_Page', { user, listFile, filter, messages: req.flash()} );
    },
    upload: async (req, res) => {
        var driveType = req.params.driveType;
        var index = req.params.index; 
        const folderId = req.params.folderId ? req.params.folderId : (req.params.parents ? req.params.parents : "");
        var driveID = [];
        var user = req.user;
        if (driveType == "google-drive"){
            driveID = req.params.driveID ? req.params.driveID : user.google[index]._id;
            var token = req.params.token ? req.params.token : user.google[index].token;
            var refreshToken = req.params.refreshToken ? req.params.refreshToken : user.google[index].refreshToken;
            var drive = await googleDriveAuth(token, refreshToken);
        } else if (driveType == "onedrive"){
            driveID = req.params.driveID ? req.params.driveID : user.onedrive[index]._id;
            var token = req.params.token ? req.params.token : user.onedrive[index].token;
            var drive = await getAuthenticatedClient(token);
        } else if (driveType == "dropbox"){
            driveID = req.params.driveID ? req.params.driveID : user.dropbox[index]._id;
            var token = req.params.token ? req.params.token : user.dropbox[index].token;
        }
        listFileUpload = req.files.file_upload ? req.files.file_upload : req.files.folder_upload;
        lenght = (listFileUpload.length) ? listFileUpload.length : 1;
        var listNewFiles = [];
        try {
            for (var i = 0; i < lenght; i++) {
                if (driveType == "google-drive"){
                    listNewFiles.push(await googleController.upload(drive, listFileUpload, folderId, i, req));
                } else if (driveType == "onedrive"){
                    listNewFiles.push(await onedriveController.upload(drive, listFileUpload, folderId, i));
                } else if (driveType == "dropbox"){
                    listNewFiles.push(await dropboxController.upload(token, listFileUpload, folderId, i));
                }
            } 
            new File().refreshFilesSchema(listNewFiles, driveID, driveType);
            req.flash("success", "Tải lên thành công!");
        } catch (error) {
            if (error) 
                req.flash("fail", "Có lỗi trong quá trình tải lên! Vui lòng thử lại");
        }
        res.redirect('back');
    },
    download: async (req, res) => {
        var driveType = req.params.driveType;
        var token = req.params.token;
        var name = req.params.name; 
        var fileId = req.params.id;
        var mimeType = req.params.mimeType;
        var refreshToken = req.params.refreshToken;

        if (driveType == "google-drive"){
            var drive = await googleDriveAuth(token, refreshToken);
            if (mimeType != "application/vnd.google-apps.folder") {
                try {
                    let dir = os.homedir() + "/Downloads";
                    fs.mkdirSync(dir, { recursive: true });
                    var dest = fs.createWriteStream(os.homedir() + "/Downloads/" + name);
                    await googleController.downloadFile(drive, fileId, dest, req);
                    req.flash("success", "Tải xuống tệp thành công!");
                    res.redirect('back');
                } catch (error) {
                    if (error) 
                    req.flash("fail", "Có lỗi trong quá trình tải tệp xuống! Vui lòng thử lại");
                    res.redirect('back');
                }
            } else {
                try {
                    //create folder directory
                    var dir = os.homedir() + "/Downloads/" + name;
                    fs.mkdirSync(dir, { recursive: true });
                    var listFiles = await googleController.getFileOfFolder(drive, fileId, req);
                    await googleController.downloadFolder(listFiles, drive, dir, 0, req);
                    req.flash("success", "Tải xuống thư mục thành công!");
                    res.redirect('back');
                } catch (error) {
                    if (error) 
                    req.flash("fail", "Có lỗi trong quá trình tải thư mục xuống! Vui lòng thử lại");
                    res.redirect('back');
                }
            }
        } else if (driveType == "onedrive"){
            var drive = await getAuthenticatedClient(token);
            if (mimeType != "folder") {
                try {
                    var dest = fs.createWriteStream(os.homedir() + "/Downloads/" + name);
                    await onedriveController.downloadFile(drive, fileId, dest);
                    req.flash("success", "Tải xuống tệp thành công!");
                    res.redirect('back');
                } catch (error) {
                    if (error) 
                    req.flash("fail", "Có lỗi trong quá trình tải tệp xuống! Vui lòng thử lại");
                    res.redirect('back');
                }
            } else {
                try {
                    //create folder directory
                    var dir = os.homedir() + "/Downloads/" + name;
                    fs.mkdirSync(dir, { recursive: true });
                    var listFiles = await onedriveController.getFileOfFolder(drive, fileId, req);
                    await onedriveController.downloadFolder(listFiles, drive, dir, 0);
                    req.flash("success", "Tải xuống thư mục thành công!");
                    res.redirect('back');
                } catch (error) {
                    if (error) 
                    req.flash("fail", "Có lỗi trong quá trình tải thư mục xuống! Vui lòng thử lại");
                    res.redirect('back');
                }
            }
        }
    },
    createFolder: async (req, res) => {
        var driveType = req.params.driveType; 
        var index = req.params.index; 
        var token = req.params.token;
        var nameFolder = req.body.nameFolder;
        var parents = req.params.parents;
        var user = req.user;
        var driveID = [];
        var listNewFiles = [];
        try {
            if (driveType == "google-drive"){
                driveID = req.params.driveID ? req.params.driveID : user.google[index]._id;
                var token = req.params.token ? req.params.token : user.google[index].token;
                var refreshToken = req.params.refreshToken ? req.params.refreshToken : user.google[index].refreshToken;
                var drive = await googleDriveAuth(token, refreshToken);
                listNewFiles.push(await googleController.createFolder(drive, nameFolder, parents, req));
            } else if (driveType == "onedrive"){
                driveID = req.params.driveID ? req.params.driveID : user.onedrive[index]._id;
                var token = req.params.token ? req.params.token : user.onedrive[index].token;
                var drive = await getAuthenticatedClient(token);
                listNewFiles.push(await onedriveController.createFolder(drive, nameFolder, parents));
            } else if (driveType == "dropbox"){
                driveID = req.params.driveID ? req.params.driveID : user.dropbox[index]._id;
                var token = req.params.token ? req.params.token : user.dropbox[index].token;
                listNewFiles.push(await dropboxController.createFolder(token, nameFolder, parents));
            }
            new File().refreshFilesSchema(listNewFiles, driveID, driveType);
            req.flash("success", "Thư mục đã được tạo!");
        } catch (error) {
            if (error) {
                console.log(error);
                req.flash("fail", "Không thể tạo thư mục. Vui lòng thử lại sau!");
            }

        }
        res.redirect('back');
    },
    moveBetweenOneAccount: async (req, res) => {
        var driveType = req.params.driveType;
        var token = req.params.token;
        var fileId = req.params.id;      
        var folderDestinationID = req.params.folderDestinationID;
        var folderHeadID = req.params.folderHeadID;
        var refreshToken = req.params.refreshToken;

        try {
            if (driveType == "google-drive"){
                var drive = await googleDriveAuth(token, refreshToken);
                var fileMove = await googleController.moveBetweenOneAccount(drive, fileId, folderHeadID, folderDestinationID, req);
            } else if (driveType == "onedrive"){
                var drive = await getAuthenticatedClient(token);
                var fileMove = await onedriveController.moveBetweenOneAccount(drive, fileId, folderDestinationID);
            }  
            var newParents =  fileMove.parents ? fileMove.parents : fileMove.parentReference.id;
            await File.updateOne({_id: fileId}, {$set: { parents: newParents }}, function (err, files) {
                if (err){
                    console.log(err);
                } else {
                    console.log("Lưu thành công!");
                }
            });   
            req.flash("success", "Di chuyển thành công!");
            res.redirect('back');
        } catch (error) {
            if (error) 
            req.flash("fail", "Có lỗi xảy ra trong quá trình di chuyển. Vui lòng thử lại sau!");
        }
    },
    copyBetweenOneAccount: async (req, res) => {
        var driveID = req.params.driveID;
        var driveType = req.params.driveType;
        var token = req.params.token;
        var fileId = req.params.id;      
        var refreshToken = req.params.refreshToken; 
        var folderDestinationID = req.params.folderDestinationID;

        try {
            if (driveType == "google-drive"){
                var drive = await googleDriveAuth(token, refreshToken);
                var fileCopy = await googleController.copyBetweenOneAccount(drive, fileId, folderDestinationID, req);
            } else if (driveType == "onedrive"){
                var drive = await getAuthenticatedClient(token);
                var fileCopy = await onedriveController.duplicate(drive, fileId, folderDestinationID, req);
            } 
            new File().refreshFilesSchema([fileCopy], driveID, driveType);
            req.flash("success", "Sao chép thành công!");
            res.redirect('back');
        } catch (error) {
            if (error) 
            req.flash("fail", "Có lỗi xảy ra trong quá trình sao chép. Vui lòng thử lại sau!");
        }
    },
    rename: async (req, res) => {
        var driveType = req.params.driveType;
        var newName = req.body.newName; 
        var token = req.params.token;
        var fileId = req.params.id;
        var refreshToken = req.params.refreshToken; 

        try {
            if (driveType == "google-drive"){
                var drive = await googleDriveAuth(token, refreshToken);
                await googleController.rename(drive, fileId, newName);
            } else if (driveType == "onedrive"){
                var drive = await getAuthenticatedClient(token);
                await onedriveController.rename(drive, fileId, newName);
            }  
    
            await File.updateOne({_id: fileId}, {$set: { name: newName }}, function (err, files) {
                if (err){
                    console.log(err);
                } else {
                    console.log("Lưu tệp thành công !");
                }
            });   
            req.flash("success", "Đổi tên thành công!");
            res.redirect('back');
        } catch (error) {
            if (error) 
            req.flash("fail", "Không thể đổi tên. Vui lòng thử lại sau!");
        }
    },
    duplicate: async (req, res) => {
        var driveType = req.params.driveType;
        var token = req.params.token;
        var fileId = req.params.id;
        var driveID = req.params.driveID;
        var refreshToken = req.params.refreshToken; 

        if (driveType == "google-drive"){
            var drive = await googleDriveAuth(token, refreshToken);
        } else if (driveType == "onedrive"){
            var drive = await getAuthenticatedClient(token);
        }

        try {
            if (driveType == "google-drive"){
                newFile = await googleController.duplicate(drive, fileId);
            } else if (driveType == "onedrive"){
                newFile = await onedriveController.duplicate(drive, fileId);
            }

            if(typeof(newFile) === String){
                req.flash("fail", "Không thể nhân bản tệp. Vui lòng thử lại sau!");
            } else {
                req.flash("success", "Nhân bản tệp thành công!");
                new File().refreshFilesSchema([newFile], driveID, driveType);
            }
        } catch (error) {
            if (error) 
                req.flash("fail", "Không thể nhân bản tệp. Vui lòng thử lại sau!");
        }
        res.redirect('back') // success
    },
    delete: async (req, res) => {
        var driveType = req.params.driveType;
        var token = req.params.token;
        var fileId = req.params.id;
        var refreshToken = req.params.refreshToken; 

        try {
            if (driveType == "google-drive"){
                var drive = await googleDriveAuth(token, refreshToken);
                await googleController.delete(drive, fileId, req);
            } else if (driveType == "onedrive"){
                var drive = await getAuthenticatedClient(token);
                await onedriveController.delete(drive, fileId);
            }  

            await File.deleteOne({_id: fileId}, function (err, files) {
                if (err){
                    return err;
                } else {
                    console.log("Đã xóa tệp thành công !");
                }
            }); 
            req.flash("success", "Xóa thành công!");
            res.redirect('back');
        } catch (error) {
            if (error) 
                req.flash("fail", "Có lỗi xảy ra trong quá trình xóa. Vui lòng thử lại sau!");
        }  
    },
    // deleteToTrash: async (req, res) => {
    //     var driveType = req.params.driveType;
    //     var token = req.params.token;
    //     var fileId = req.params.id;

    //     if (driveType == "google-drive"){
    //         var drive = await googleDriveAuth(token);
    //         await googleController.deleteToTrash(drive, fileId);
    //     } else if (driveType == "onedrive"){
    //         var drive = await getAuthenticatedClient(token);
    //         await onedriveController.deleteToTrash(drive, fileId);
    //     }  

    //     await File.updateOne({_id: fileId}, {$set: { trashed: true }}, function (err, files) {
    //         if (err){
    //             return err;
    //         } else {
    //             console.log("Save File successfully");
    //             res.redirect('/dashboard');
    //         }
    //     });   
    // },
    // undoFromTrash: async (req, res) => {
    //     var driveType = req.params.driveType;
    //     var token = req.params.token;
    //     var fileId = req.params.id;

    //     if (driveType == "google-drive"){
    //         var drive = await googleDriveAuth(token);
    //         await googleController.undoFromTrash(drive, fileId);
    //     } else if (driveType == "onedrive"){
    //         var drive = await getAuthenticatedClient(token);
    //         await onedriveController.undoFromTrash(drive, fileId);
    //     }  

    //     await File.updateOne({_id: fileId}, {$set: { trashed: false }}, function (err, files) {
    //         if (err){
    //             return err;
    //         } else {
    //             console.log("Save File successfully");
    //             res.redirect('/dashboard');
    //         }
    //     });   
    // },
    searchFileByName: async (req, res) => {
        var filter = {searchName};
        var searchName = req.query.searchName;
        var user = req.user;
        getList = async () => {
            try {
                getAllCloudIdOfUser = async () => {
                    var allCloudIdOfUser = [];
                    await Promise.all([
                        user.google.map( (account) => { 
                            allCloudIdOfUser.push(account._id);
                        }),
                        user.onedrive.map( (account) => { 
                            allCloudIdOfUser.push(account._id);
                        }),
                        user.dropbox.map( (account) => { 
                            allCloudIdOfUser.push(account._id);
                        }),
                    ]);
                    return allCloudIdOfUser;
                }
                let allCloudId = await getAllCloudIdOfUser();
                let listFile = await File.find({driveID : { $in: allCloudId }, name: {"$regex": searchName, "$options": "i"} });
                if (listFile.length > 0) {
                    var listFileParseJson = listFile.map((file) => {
                        return file = JSON.parse(JSON.stringify(file));
                    });
                    return await getInfoFileOfDrive(listFileParseJson, user);
                } else {
                    return [];
                }
            } catch (error) {
                if (error) console.log(error);
            }
        };   
        var listFile = await getList();
        res.render('dashboard_Page', { user, listFile, filter, messages: req.flash()} );
    },
    advancedFiltering: async (req, res) => {
        var searchName = req.query.searchName;
        var startDate = req.query.startDate? new Date(req.query.startDate) : new Date("1970-01-01T00:00");
        var endDate = req.query.endDate? new Date(req.query.endDate) : new Date();
        var categoryFilter = req.query.categoryFilter;
        var accountFilter = req.query.accountFilter;
        var sortByName = (req.query.sortByName != "none") ? req.query.sortByName : undefined;
        var user = req.user;
        var filter = {
            startDate: startDate.toISOString().substring(0, 16),
            endDate: endDate.toISOString().substring(0, 16),
            searchName,
            categoryFilter,
            accountFilter,
            sortByName
        }
        getList = async () => {
            try {
                getAllCloudIdOfUser = async () => {
                    var allCloudIdOfUser = [];
                    await Promise.all([
                        user.google.map( (account) => { 
                            allCloudIdOfUser.push(account._id);
                        }),
                        user.onedrive.map( (account) => { 
                            allCloudIdOfUser.push(account._id);
                        }),
                        user.dropbox.map( (account) => { 
                            allCloudIdOfUser.push(account._id);
                        }),
                    ]);
                    return allCloudIdOfUser;
                }
                let allCloudId = accountFilter ? accountFilter : await getAllCloudIdOfUser();
                var queryFilter = {driveID : { $in: allCloudId }}
                if (categoryFilter) {
                    queryFilter.createDate = {"$gte": startDate, "$lte": endDate}
                }
                if (startDate || endDate) {
                    queryFilter.createDate = {"$gte": startDate, "$lte": endDate}
                }
                if (searchName) {
                    queryFilter.name = {"$regex": searchName, "$options": "i"}
                }
                let listFile = await File.find(queryFilter);
                if (listFile.length > 0) {
                    var listFileParseJson = listFile.map((file) => {
                        return file = JSON.parse(JSON.stringify(file));
                    });
                    let listFileAfterGetInfo = await getInfoFileOfDrive(listFileParseJson, user);
                    sortByname = async (arrayOfObjects) => {
                        var byName = arrayOfObjects.slice(0);
                        let listFilesSort = await byName.sort(function(a,b) {
                            var x = a.name.toLowerCase();
                            var y = b.name.toLowerCase();
                            return x < y ? -1 : x > y ? 1 : 0;
                        });
                        return listFilesSort;
                    }
                    if( categoryFilter != "All" ){
                        let listFileFilterCategory = await listFileAfterGetInfo.filter(file => (file.categoryLarge == categoryFilter))
                        if (!sortByName) {
                            return listFileFilterCategory
                        } else if (sortByName == "asc") {
                            return await sortByname(listFileFilterCategory);
                        } else if (sortByName == "desc"){
                            let listFilesAfterSort = await sortByname(listFileFilterCategory);
                            return listFilesAfterSort.reverse();
                        }
                    } else {
                        if (!sortByName) {
                            return listFileAfterGetInfo
                        } else if (sortByName == "asc") {
                            return await sortByname(listFileAfterGetInfo);
                        } else if (sortByName == "desc"){
                            let listFilesAfterSort = await sortByname(listFileAfterGetInfo);
                            return listFilesAfterSort.reverse();
                        }
                    }
                } else {
                    return [];
                }
            } catch (error) {
                if (error) console.log(error);
            }
        };   
        var listFile = await getList();
        res.render('dashboard_Page', { user, listFile, filter, messages: req.flash()} );
    },
    getMyDrive: async (req, res) => {
        var filter = {};
        var driveType = req.params.driveType;
        var index = req.params.index; 
        var user = req.session.user;
        var render = req.params.render;
        var driveID = [];
        var listFile = [];
        try {
            if (driveType == "google-drive"){
                driveID = req.params.driveID ? req.params.driveID : user.google[index]._id;
                var token = req.params.token ? req.params.token : user.google[index].token;
                var refreshToken = req.params.refreshToken ? req.params.refreshToken : user.google[index].refreshToken;
                var drive = await googleDriveAuth(token, refreshToken);
                listFile = await googleController.getFileOfFolder(drive, "root", req);
            } else if (driveType == "onedrive"){
                driveID = req.params.driveID ? req.params.driveID : user.onedrive[index]._id;
                var token = req.params.token ? req.params.token : user.onedrive[index].token;
                var drive = await getAuthenticatedClient(token);
                listFile = await onedriveController.getMyDrive(drive);
            }  else if (driveType == "dropbox"){
                driveID = req.params.driveID ? req.params.driveID : user.dropbox[index]._id;
                var token = req.params.token ? req.params.token : user.dropbox[index].token;
                listFile = await dropboxController.expData(token);
            }
            listFile = await getInfoFileOfDrive(listFile, user, driveID, driveType);
            if (render == "true"){
                req.flash("success", 'Lấy các tệp và thư mục ở "Drive của tôi" thành công');
                res.render('dashboard_Page', { user, listFile, filter, messages: req.flash()} );
            } else {
                res.json(listFile);
            }
        } catch (error) {
            if (error) 
                req.flash("fail", 'Có lỗi trong quá trình lấy tệp và thư mục ở "Drive của tôi". Vui lòng thử lại sau!');
            if (render == "true") {
                res.redirect('/dashboard');
            }
        }
    },
    getAllFiles: async (req, res) => {
        var driveType = req.params.driveType;
        var index = req.params.index; 
        var user = req.session.user;
        var filter = {};

        var listFile = [];
        try {
            if (driveType == "google-drive"){
                var driveID = user.google[index]._id;
                listFile = await googleController.getListFiles(user.google[index].token, user.google[index].refreshToken, req);
            } else if (driveType == "onedrive"){
                var driveID = user.onedrive[index]._id;
                listFile = await onedriveController.getAllItem(user.onedrive[index].token);
            } else if (driveType == "dropbox"){
                listFile = await dropboxController.expData(user.dropbox[index].token);
            }
            listFile = await getInfoFileOfDrive(listFile, user, driveID, driveType);
            req.flash("success", 'Lấy tất cả các tệp và thư mục của tài khoản đám mây này thành công');
            res.render('dashboard_Page', { user, listFile, filter, messages: req.flash()} );
        } catch (error) {
            if (error) {
                req.flash("fail", 'Có lỗi trong quá trình lấy tất cả các tệp và thư mục của tài khoản đám mây này. Vui lòng thử lại sau!');
                res.redirect('/dashboard');
            }
        }
    },
    getFileShareWithMe: async (req, res) => {
        var index = req.params.index;
        var driveType = req.params.driveType;
        var user = req.session.user;
        var driveID = [];
        var filter = {};
        try {
            if (driveType == "google-drive"){
                driveID = req.params.driveID ? req.params.driveID : user.google[index]._id;
                var token = req.params.token ? req.params.token : user.google[index].token;
                var refreshToken = req.params.refreshToken ? req.params.refreshToken : user.google[index].refreshToken;
                var drive = await googleDriveAuth(token, refreshToken);
                var listFile = await googleController.getFileShareWithMe(drive, req);
            } else if (driveType == "onedrive"){
                driveID = req.params.driveID ? req.params.driveID : user.onedrive[index]._id;
                var token = req.params.token ? req.params.token : user.onedrive[index].token;
                var drive = await getAuthenticatedClient(token);
                var listFile = await onedriveController.getFileShareWithMe(drive);
            }
            // else if (driveType == "dropbox"){
            //     driveID = req.params.driveID ? req.params.driveID : user.dropbox[index]._id;
            //     var token = req.params.token ? req.params.token : user.dropbox[index].token;
            //     var listFile = await dropboxController.getFileShareWithMe(token);
            // }
            listFile = await getInfoFileOfDrive(listFile, user, driveID, driveType);
            req.flash("success", 'Lấy các tệp và thư mục ở "Được chia sẻ với tôi" thành công');
            res.render('dashboard_Page', { user, listFile, filter, messages: req.flash()} );
        } catch (error) {
            if (error) {
                console.log(error);
                req.flash("fail", 'Có lỗi trong quá trình lấy tệp và thư mục ở "Được chia sẻ với tôi". Vui lòng thử lại sau!');
                res.redirect('/dashboard');
            }    
        }
    },
    getShareWithMeByParentsID: async (req, res) => {
        var index = req.params.index;
        var driveType = req.params.driveType;
        var user = req.session.user;
        var driveID = [];
        var listFile = [];
        try {
            if (driveType == "google-drive"){
                driveID = req.params.driveID ? req.params.driveID : user.google[index]._id;
                var token = req.params.token ? req.params.token : user.google[index].token;
                var refreshToken = req.params.refreshToken ? req.params.refreshToken : user.google[index].refreshToken;
                var drive = await googleDriveAuth(token, refreshToken);
                listFile = await googleController.getFileShareWithMe(drive, req);
            } else if (driveType == "onedrive"){
                driveID = req.params.driveID ? req.params.driveID : user.onedrive[index]._id;
                var token = req.params.token ? req.params.token : user.onedrive[index].token;
                var drive = await getAuthenticatedClient(token);
                listFile = await onedriveController.getFileShareWithMe(drive);
            }
            listFile = await getInfoFileOfDrive(listFile, user, driveID, driveType);
            res.json(listFile);
        } catch (error) {
            if (error) {
                console.log(error);
            }    
        }
    },
    getFileOfFolder: async (req, res) => {
        var driveType = req.params.driveType;
        var driveID = req.params.driveID;
        var token = req.params.token;
        var render = req.params.render;
        var folderID = req.params.folderID; 
        var user = req.session.user;
        var refreshToken =  req.params.refreshToken;
        var filter = {}
        try {
            if (driveType == "google-drive"){
                var drive = await googleDriveAuth(token, refreshToken);
                var listFile = await googleController.getFileOfFolder(drive, folderID, req);
            } else if (driveType == "onedrive"){
                var drive = await getAuthenticatedClient(token);
                var listFile = await onedriveController.getFileOfFolder(drive, folderID);
            }
            listFile = await getInfoFileOfDrive(listFile, user, driveID, driveType);

            if (render == "true"){
                res.render('dashboard_Page', { user, listFile, filter, messages: req.flash()} );
            } else {
                res.json(listFile);
            }
        } catch (error) {
            if (error) {
                console.log(error);
                req.flash("fail", "Không thể hiển thị các tệp tin hoặc thư mục con của thư mục này");
            }    
        }
    },
    getAllByParentName: async (req, res) => {
        var driveType = req.params.driveType;
        var driveID = req.params.driveID;
        var token = req.params.token;
        var parentID = req.params.parentID; 
        var user = req.session.user;
        var refreshToken =  req.params.refreshToken;
        var listFile = [];
        try {
            if (driveType == "google-drive"){
                var drive = await googleDriveAuth(token, refreshToken);
                listFile = await googleController.getFileOfFolder(drive, parentID, req);
            } else if (driveType == "onedrive"){
                var drive = await getAuthenticatedClient(token);
                listFile = await onedriveController.getFileOfFolder(drive, parentID);
            }
            listFile = await getInfoFileOfDrive(listFile, user, driveID, driveType);
            res.json(listFile);
        } catch (error) {
            if (error) {
                console.log(error);
            }    
        }
    },
    moveBetweenDifferentAccount: async (req, res) => {
        var driveTypeHead = req.params.driveTypeHead;
        var driveTypeDestination = req.params.driveTypeDestination;
        var folderDestinationID = req.params.folderDestinationID ? req.params.folderDestinationID : "";
        var driveDestinationID = req.params.driveDestinationID;
        var headToken = req.params.headToken;
        var headRefreshToken = req.params.headRefreshToken;
        var destinationToken = req.params.destinationToken;
        var destinationRefreshToken = req.params.destinationRefreshToken;
        var name = req.params.name;
        var mimeType = req.params.mimeType;
        var fileId = req.params.id;

        try {
            fileMove = async () => {
                fs.mkdir('public/assets/temp', { recursive: true }, (err) => {
                    if (err) throw err;
                });
                if (driveTypeHead == "google-drive"){
                    var driveHead = await googleDriveAuth(headToken, headRefreshToken);
                    if(mimeType != "application/vnd.google-apps.folder"){
                        //download file to tempFolder
                        let dest = fs.createWriteStream(`public/assets/temp/${name}`);
                        await googleController.downloadFile(driveHead, fileId, dest, req);
                    } else {
                        //create folder directory
                        var dir = os.homedir() + "/Downloads/" + name;
                        fs.mkdirSync(dir, { recursive: true });
                        var listFiles = await googleController.getFileOfFolder(driveHead, fileId, req);
                        await googleController.downloadFolder(listFiles, driveHead, dir, 0, req);
                    }

                    await googleController.delete(driveHead, fileId);
                    await File.deleteOne({_id: fileId}, function (err, files) {
                        if (err) 
                            return err;
                    }); 
                    fileUpload = () => { 
                        let tempFilePath = path.join(config.dirPath,`public/assets/temp/${name}`);
                        fs.readFile(`public/assets/temp/${name}`, async function(err, data) {
                            var fileAfterDownload = {
                                name: name, 
                                mimetype: mimeType, 
                                tempFilePath
                            }
                            if (driveTypeDestination == "google-drive"){
                                var driveDestination = await googleDriveAuth(destinationToken, destinationRefreshToken);
                                var newFiles = await googleController.upload(driveDestination, fileAfterDownload, folderDestinationID, 0, req);
                            } else if (driveTypeDestination == "onedrive"){
                                var driveDestination = await getAuthenticatedClient(destinationToken);
                                var newFiles = await onedriveController.upload(driveDestination, fileAfterDownload, folderDestinationID, 0);
                            }
                            
                            new File().refreshFilesSchema([newFiles], driveDestinationID, driveTypeDestination);
                            fs.unlink(`public/assets/temp/${name}`, function (err) {
                                if (err) throw err;
                                console.log('File in directory deleted!');
                            }); 
                            req.flash("success", "Di chuyển thành công");
                            res.redirect('back');
                        });
                    }
                    await fileUpload();
                } else if (driveTypeHead == "onedrive"){
                    var driveHead = await getAuthenticatedClient(headToken);
                    await driveHead.api('/me/drive/items/'+ fileId +'/content').getStream((err, downloadStream) => { 
                        downloadStream
                        .on('end', async () => {
                            console.log('Done');
                            await onedriveController.delete(driveHead, fileId);
                                await File.deleteOne({_id: fileId}, function (err, files) {
                                    if (err) 
                                        return err;
                                }); 
                                fileUpload = () => { 
                                    fs.readFile(`public/assets/temp/${name}`, async function(err, data) {
                                        var fileAfterDownload = {
                                            name: name, 
                                            mimetype: mimeType, 
                                            data
                                        }
                                        if (driveTypeDestination == "google-drive"){
                                            var driveDestination = await googleDriveAuth(destinationToken, destinationRefreshToken);
                                            var newFiles = await googleController.upload(driveDestination, fileAfterDownload, folderDestinationID, 0, req);
                                        } else if (driveTypeDestination == "onedrive"){
                                            var driveDestination = await getAuthenticatedClient(destinationToken);
                                            var newFiles = await onedriveController.upload(driveDestination, fileAfterDownload, folderDestinationID, 0);
                                        }
                                        
                                        new File().refreshFilesSchema([newFiles], driveDestinationID, driveTypeDestination);
                                        fs.unlink(`public/assets/temp/${name}`, function (err) {
                                            if (err) throw err;
                                            console.log('File in directory deleted!');
                                        }); 
                                        req.flash("success", "Di chuyển thành công");
                                        res.redirect('back');
                                    });
                                }
                                await fileUpload();
                        })  
                        .on('error', err => {
                            console.log('Error', err);
                        })
                        .pipe(dest);
                    });
                }
            }
            await  fileMove();
        } catch (error) {
            if (error) 
                req.flash("fail", "Xãy ra lỗi trong quá trình di chuyển. Vui lòng thử lại sau!");
        }
    },
    copyBetweenDifferentAccount: async (req, res) => {
        var driveTypeHead = req.params.driveTypeHead;
        var driveTypeDestination = req.params.driveTypeDestination;
        var folderDestinationID = req.params.folderDestinationID ? req.params.folderDestinationID : "";
        var driveDestinationID = req.params.driveDestinationID;
        var headToken = req.params.headToken;
        var headRefreshToken = req.params.headRefreshToken;
        var destinationToken = req.params.destinationToken;
        var destinationRefreshToken = req.params.destinationRefreshToken;
        var name = req.params.name;
        var mimeType = req.params.mimeType;
        var fileId = req.params.id;

        try {
            fileCopy = async () => {
                fs.mkdir('public/assets/temp', { recursive: true }, (err) => {
                    if (err) throw err;
                });
                if (driveTypeHead == "google-drive"){
                    var driveHead = await googleDriveAuth(headToken, headRefreshToken);
                    if(mimeType != "application/vnd.google-apps.folder"){
                        //download file to tempFolder
                        let dest = fs.createWriteStream(`public/assets/temp/${name}`);
                        await googleController.downloadFile(driveHead, fileId, dest, req);
                    } else {
                        //create folder directory
                        var dir = os.homedir() + "/Downloads/" + name;
                        fs.mkdirSync(dir, { recursive: true });
                        var listFiles = await googleController.getFileOfFolder(driveHead, fileId, req);
                        await googleController.downloadFolder(listFiles, driveHead, dir, 0, req);
                    }
                    fileUpload = () => { 
                        let tempFilePath = path.join(config.dirPath,`public/assets/temp/${name}`);
                        fs.readFile(`public/assets/temp/${name}`, async function(err, data) {
                            var fileAfterDownload = {
                                name: name, 
                                mimetype: mimeType, 
                                tempFilePath
                            }
                            if (driveTypeDestination == "google-drive"){
                                var driveDestination = await googleDriveAuth(destinationToken, destinationRefreshToken);
                                var newFiles = await googleController.upload(driveDestination, fileAfterDownload, folderDestinationID, 0, req);
                            } else if (driveTypeDestination == "onedrive"){
                                var driveDestination = await getAuthenticatedClient(destinationToken);
                                var newFiles = await onedriveController.upload(driveDestination, fileAfterDownload, folderDestinationID, 0);
                            }
                            
                            new File().refreshFilesSchema([newFiles], driveDestinationID, driveTypeDestination);
                            fs.unlink(`public/assets/temp/${name}`, function (err) {
                                if (err) throw err;
                                console.log('File in directory deleted!');
                            }); 
                            req.flash("success", "Sao chép thành công");
                            res.redirect('back');
                        });
                    }
                    await fileUpload();
                } else if (driveTypeHead == "onedrive"){
                    var driveHead = await getAuthenticatedClient(headToken);
                    await driveHead.api('/me/drive/items/'+ fileId +'/content').getStream((err, downloadStream) => { 
                        downloadStream
                        .on('end', async () => {
                            console.log('Done');
                            fileUpload = () => { 
                                fs.readFile(`public/assets/temp/${name}`, async function(err, data) {
                                    var fileAfterDownload = {
                                        name: name, 
                                        mimetype: mimeType, 
                                        data
                                    }
                                    if (driveTypeDestination == "google-drive"){
                                        var driveDestination = await googleDriveAuth(destinationToken, destinationRefreshToken);
                                        var newFiles = await googleController.upload(driveDestination, fileAfterDownload, folderDestinationID, 0, req);
                                    } else if (driveTypeDestination == "onedrive"){
                                        var driveDestination = await getAuthenticatedClient(destinationToken);
                                        var newFiles = await onedriveController.upload(driveDestination, fileAfterDownload, folderDestinationID, 0);
                                    }
                                    
                                    new File().refreshFilesSchema([newFiles], driveDestinationID, driveTypeDestination);
                                    fs.unlink(`public/assets/temp/${name}`, function (err) {
                                        if (err) throw err;
                                        console.log('File in directory deleted!');
                                    }); 
                                    req.flash("success", "Sao chép thành công");
                                    res.redirect('back');
                                });
                            }
                            await fileUpload();
                        })  
                        .on('error', err => {
                            console.log('Error', err);
                        })
                        .pipe(dest);
                    });
                }
            }
            await fileCopy();
        } catch (error) {
            if (error) 
                req.flash("fail", "Xãy ra lỗi trong quá trình sao chép. Vui lòng thử lại sau!");
        }
    },
    addPermissionFileShare: async (req, res) => {
        var driveType = req.params.driveType;
        var fileID = req.body.fileID;
        var token = req.params.token;
        var refreshToken = req.params.refreshToken;
        try {
            if (driveType == "google-drive"){
                var drive = await googleDriveAuth(token, refreshToken);
                var role = req.body.role;
                var type = req.body.type;
                var linkShare = await googleController.addPermissionFileShare(drive, fileID, role, type, req);
            } else if (driveType == "onedrive"){
                var drive = await getAuthenticatedClient(token);
                var role = (req.body.role == "reader") ? "view" : "edit";
                var type = (req.body.type == "anyone") ? "anonymous" : "organization";
                var linkShare = await onedriveController.addPermissionFileShare(drive, fileID, role, type);
            }
            return res.json(linkShare);
        } catch (error) {
            if (error) {
                console.log(error);
                res.redirect('back');
            }  
        }
    },
    sendMailShareLink: async (req, res) => {
        var linkShare = req.body.linkShare;
        var fileName = req.body.fileName;
        var email = req.body.email;
        var typeSend = req.body.typeSend;
        var driveType = req.body.driveType;
        var fileId = req.body.fileId;
        var token = req.body.token;
        var refreshToken = req.body.refreshToken;

        try {
            let transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                  user: 'nghiahubert@gmail.com',
                  pass: 'trongnghia0976948672' 
                }
            });
        
            // send mail with defined transport object
            if (typeSend == 'link') {
                let info = await transporter.sendMail({
                    from: 'nghiahubert@gmail.com',
                    to: email, 
                    subject: "[Link Share File of CloudInOne]", 
                    html: `<span>Click <a href='${linkShare}'>here</a> to access to file: <b>${fileName}</b>!!!</span>` 
                });
                console.log("Message sent: %s", info.messageId);
                res.redirect('back'); 
            } else {
                //download file to tempFolder
                fs.mkdir('public/assets/temp', { recursive: true }, (err) => {
                    if (err) throw err;
                });
                var dest = fs.createWriteStream(`public/assets/temp/${fileName}`);
                if (driveType == "google-drive"){
                    var drive = await googleDriveAuth(token, refreshToken);
                    await googleController.downloadFile(drive, fileId, dest, req);
                } else if (driveType == "onedrive") {
                    var drive = await getAuthenticatedClient(token);
                    await onedriveController.downloadFile(drive, fileId, dest);
                } 
                sendFileToMail = async () => { 
                    await transporter.sendMail({
                        from: 'nghiahubert@gmail.com',
                        to: email, 
                        subject: "[Share File of CloudInOne]", 
                        html: `<span> <b>${fileName}</b> shared to you!!!</span>`,
                        attachments: {   
                            filename: fileName,
                            content: fs.createReadStream(`public/assets/temp/${fileName}`)
                        } 
                    }, (err, info) => {
                        if (err) {
                            console.log(err);
                        } else {
                            if (info) {
                                fs.unlink(`public/assets/temp/${fileName}`, function (err1) {
                                    if (err1) throw err1;
                                    console.log('File in directory deleted!');
                                });
                                console.log("Message sent: %s", info.messageId);
                                res.redirect('back'); 
                            }
                        }
                    });
                }
                await sendFileToMail();
            }
        } catch (error) {
            if (error) {
                console.log(error);
                res.redirect('back');
            }  
        }
    },
    editProfileLocalAccount: async (req, res) => {
        var name = req.body.name;
        var email = req.body.email;
        var newPassword = req.body.newPassword;
        var passwordConfirm = req.body.passwordConfirm;
        var phoneNumber = req.body.phoneNumber;
        try {
            User.findOne({'local.email': email}, function (err, user) {
                if (err)
                    console.log(err);
                if (newPassword !== passwordConfirm) {
                    req.flash('fail', 'Mật khẩu xác nhận và mật khẩu không giống nhau. Vui lòng nhập lại!'); 
                    res.redirect('back');
                    return;
                } else {
                    user.local.email = email;
                    if (newPassword != "") {
                        user.local.password = user.generateHash(newPassword);
                    }
                    user.local.name = name;
                    user.local.phoneNumber = phoneNumber;
                    user.local.activeStatus = true;
                    user.save();
                    req.session.user = user;
                    req.flash('success', 'Cập nhật thông tin người dùng thành công!'); 
                    res.redirect('back');
                }
            });
        } catch (error) {
            if (error) {
                console.log(error);
                req.flash("fail", "không thể cập nhật thông tin người dùng");
                res.redirect('back');
                return;
            };
        }
    },
    getFileByID: async (req, res) => {
        var driveType = req.params.driveType;
        var token = req.params.token;
        var refreshToken = req.params.refreshToken;
        var fileID = req.params.fileID; 

        var file = {};
        try {
            if (driveType == "google-drive"){
                var drive = await googleDriveAuth(token, refreshToken);
                file = await googleController.getFileByID(drive, fileID, req);
            } else if (driveType == "onedrive"){
                var drive = await getAuthenticatedClient(token);
                file = await onedriveController.getFileByID(drive, fileID);
            }
            return res.json(file);
        } catch (error) {
            if (error) {
                console.log(error);
            }    
        }
    }
}
// get info file of Drive
async function getInfoFileOfDrive(listFile, user, driveID, driveType){
    if (listFile.length > 0){
        getInfo = async (listFile, driveType, driveID) => {
            try {
                listFile = listFile.map(async (file) => {
                    type = file.type ? file.type : file.mimeType;
                    file.driveType = driveType ? driveType : file.driveType;
                    file.type = type;
                    file.createdTime = file.createdTime ? file.createdTime : file.createdDateTime;
                    file.modifiedTime = file.modifiedTime ? file.modifiedTime : file.lastModifiedDateTime;
                    file.size = file.size ? file.size : 0;
                    file.thumbnailLink = file.thumbnailLink ? file.thumbnailLink : "";
                    file.driveID = file.driveID ? file.driveID : (new Array(driveID));
                    file.parents = file.parents ? file.parents : (file.parentReference ? [file.parentReference.id] : new Array("Share with me"));
                    file.category = checkType(type)[0];

                    if (file.category == "Folder") {
                        file.categoryLarge="Folder"; 
                    } else if (file.category == "Image" || file.category == "Google Photo") {
                        file.categoryLarge="Image"; 
                    } else if (file.category == "Video" || file.category == "Google Video") {
                        file.categoryLarge ="Video"; 
                    } else if (file.category == "Audio" || file.category == "Google Audio") {
                        file.categoryLarge ="Audio"; 
                    } else if (file.category == "Compressed archive") {
                        file.categoryLarge ="Compressed_archive"; 
                    } else if (file.category == "Binary file") {
                        file.categoryLarge ="Binary_file";
                    } else if (file.category == "Unknown file") {
                        file.categoryLarge ="Unknown_file"; 
                    } else file.categoryLarge ="Document" 	

                    file.icon = checkType(type)[1];
                    const listCloud = await getCloudByDriveID(file.driveID, file.driveType, user);
                    var listEmailCloud = [];
                    var listTokenCloud = [];
                    var listRefreshTokenCloud = [];
                    listCloud.map((cloud) => {
                        if(cloud) {
                            listEmailCloud.push(cloud.email);
                            listTokenCloud.push(cloud.token);
                            listRefreshTokenCloud.push(cloud.refreshToken);
                        }
                    });
                    file.listEmailCloud = listEmailCloud;
                    file.listTokenCloud = listTokenCloud;
                    file.listRefreshTokenCloud = listRefreshTokenCloud;
                    return file;
                }); 
                await listFile;
            } catch (err) {
                console.log(err);
            }
        }
        getInfo(listFile, driveType, driveID);
    } 
    return listFile;  
}
//get Array Email Cloud Account of File 
function getCloudByDriveID(listDriveID, typeCloud, user){
    var listCloud =  [];
    if(typeCloud == "google-drive"){
        listDriveID.map((driveID) => {
            listCloud.push( user.google.filter((cloud) => cloud._id == driveID)[0] );
        });
    } else if(typeCloud == "onedrive"){
        listDriveID.map((driveID) => {
            listCloud.push( user.onedrive.filter((cloud) => cloud._id == driveID)[0] );
        });
    } else if(typeCloud == "dropbox"){
        listDriveID.map((driveID) => {
            listCloud.push( user.dropbox.filter((cloud) => cloud._id == driveID)[0] );
        });
    }
    return listCloud;
    // if(driveType == "google_drive"){
    //     listEmailCloud = await User.find(
    //         { "google._id": { $in: listDriveID }}, 
    //         {_id: 0, google: 1, onedrive: 0, local: 0, facebook: 0, createDate: 0, modifiedDate: 0,   
    //             google: {$elemMatch: { "_id": { $in: listDriveID }}}}, function (err, acount) {

    //             });
    // } else if(driveType == "onedrive"){
    //     listEmailCloud = await User.find(
    //         { "onedrive._id": { $in: listDriveID }}, 
    //         {_id: 0, google: 0, onedrive: 1, local: 0, facebook: 0, createDate: 0, modifiedDate: 0,   
    //             google: {$elemMatch: { "_id": { $in: listDriveID }}}});
    // }
}

//check type file
function checkType(type, category, icon){
    var splitType = type.split("/");        
    switch(splitType[0]) {
        case "jpg": {
            category = "Image";
            icon = "image.png";
            break;
        }
        case "png": {
            category = "Image";
            icon = "image.png";
            break;
        }
        case "pdf": {
            category = "PDF";
            icon = "PDF.png";
            break;
        }
        case "url": {
            category = "Document";
            icon = "document.png";
            break;
        }
        case "rar": {
            category = "Compressed archive";
            icon = "compressed_archive.png";
            break;
        }
        case "paper": {
            category = "Document";
            icon = "document.png";
            break;
        }
        case "doc": {
            category = "Document";
            icon = "Word.png";
            break;
        }
        case "docx": {
            category = "Document";
            icon = "Word.png";
            break;
        }
        case "mp4": {
            category = "Video";
            icon = "video.png";
            break;
        }
        case "txt": {
            category = "Document";
            icon = "txt.png";
            break;
        }
        case "pptx": {
            category = "Document";
            icon = "PowerPoint.png";
            break;
        }
        case "ppt": {
            category = "Document";
            icon = "PowerPoint.png";
            break;
        }
        case "zip": {
            category = "Compressed archive";
            icon = "compressed_archive.png";
            break;
        }
        case "xlsx": {
            category = "Document";
            icon = "Excel.png";
            break;
        }
        case "xls": {
            category = "Document";
            icon = "Excel.png";
            break;
        }
        case "php": {
            category = "Program langue";
            icon = "image.png";
            break;
        }
        case "html": {
            category = "Program langue";
            icon = "HTML.png";
            break;
        }
        case "mp3": {
            category = "Audio";
            icon = "audio.png";
            break;
        }
        case "xml": {
            category = "Program langue";
            icon = "XML.png";
            break;
        }
        case "csv": {
            category = "Document";
            icon = "CSV.png";
            break;
        }
        case "css": {
            category = "Program langue";
            icon = "CSS.png";
            break;
        }
        case "js": {
            category = "Program langue";
            icon = "JS.png";
            break;
        }
        case "video": {
            category = "Video";
            icon = "video.png";
            break;
        }
        case "image": {
            category = "Image";
            icon = "image.png";
            break;
        }
        case "audio": {
            category = "Audio";
            icon = "audio.png";
            break;
        }
        case "folder": {
            category = "Folder";
            icon = "folder.png";
            break;
        }
        case "one-note": {
            category = "OneNote";
            icon = "one-note.png";
            break;
        }
        case "text": {
            switch (splitType[1]) {
                case "plain":
                case "x-url": {
                    category = "Document";
                    icon = "document.png";
                    break;
                }
                case "xml": {
                    category = "XML";
                    icon = "XML.png";
                    break;
                }
                case "html": {
                    category = "HTML";
                    icon = "HTML.png";
                    break;
                }
                case "csv": {
                    category = "CSV";
                    icon = "CSV.png";
                    break;
                }
                case "css": {
                    category = "CSS";
                    icon = "CSS.png";
                    break;
                }
                case "jscript": {
                    category = "JavaScript";
                    icon = "JS.png";
                    break;
                }
                case "x-python": {
                    category = "Python";
                    icon = "Python.png";
                    break;
                }
            }
            break;
        }
        case "application": {
            switch (splitType[1]) {
                case "vnd.google-apps.audio": {
                    category = "Google Audio";
                    icon = "google_audio.png";
                    break;
                }  
                case "vnd.google-apps.video": {
                    category = "Google Video";
                    icon = "google_video.jpg";
                    break;
                }
                case "vnd.google-apps.drive-sdk": {
                    category = "3rd party shortcut";
                    icon = "google_shortcut.png";
                    break;
                }
                case "vnd.google-apps.drawing": {
                    category = "Google Drawing";
                    icon = "google_drawing.png";
                    break;
                }
                case "vnd.google-apps.file": {
                    category = "Google File";
                    icon = "google_file.png";
                    break;
                }
                case "vnd.google-apps.form": {
                    category = "Google Forms";
                    icon = "google_forms.png";
                    break;
                }
                case "vnd.google-apps.fusiontable": {
                    category = "Google Fusion Tables";
                    icon = "google_fusion_tables.png";
                    break;
                }
                case "vnd.google-apps.map": {
                    category = "Google My Maps";
                    icon = "google_my_maps.png";
                    break;
                }
                case "vnd.google-apps.photo": {
                    category = "Google Photo";
                    icon = "google_photo.png";
                    break;
                }
                case "vnd.google-apps.presentation": {
                    category = "Google Slides";
                    icon = "google_slides.png";
                    break;
                } 
                case "application/vnd.google-apps.script": {
                    category = "Google Apps Scripts";
                    icon = "google_apps_scripts.png";
                    break;
                }  
                case "vnd.google-apps.shortcut": {
                    category = "Shortcut";
                    icon = "google_shortcut.png";
                    break;
                }  
                case "vnd.google-apps.site": {
                    category = "Google Sites";
                    icon = "google_sites.png";
                    break;
                }
                case "vnd.google-apps.document": {
                    category = "Google Docs";
                    icon = "google_docs.jpg";
                    break;
                }
                case "vnd.google-apps.spreadsheet": {
                    category = "Google spreadsheet";
                    icon = "google_spreadsheet.png";
                    break;
                }
                case "vnd.google-apps.folder": {
                    category = "Folder";
                    icon = "folder.png";
                    break;
                }

                case "zip":
                case "x-zip-compressed":
                case "rar":
                case "x-gtar":
                case "x-7z-compressed":
                case "x-gzip":
                case "x-compress": {
                    category = "Compressed archive";
                    icon = "compressed_archive.png";
                    break;
                }

                case "msword":
                case "vnd.openxmlformats-officedocument.wordprocessingml.document": {
                    category = "Word";
                    icon = "Word.png";
                    break;
                }

                case "vnd.ms-excel":
                case "vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
                    category = "Excel";
                    icon = "Excel.png";
                    break;
                }

                case "vnd.ms-powerpoint":
                case "vnd.openxmlformats-officedocument.presentationml.presentation": {
                    category = "PowerPoint";
                    icon = "PowerPoint.png";
                    break;
                }

                case "msaccess":
                case "x-msaccess": {
                    category = "Access";
                    icon = "Access.png";
                    break;
                }

                case "vnd.oasis.opendocument.text": {
                    category = "Open Office doc";
                    break;
                }
                case "x-vnd.oasis.opendocument.spreadsheet": {
                    categoryt = "Open Office sheet";
                    break;
                }
                case "vnd.oasis.opendocument.presentation": {
                    category = "Open Office presentation";
                    break;
                }
                case "pdf": {
                    category = "PDF";
                    icon = "PDF.png";
                    break;
                }
                case "x-javascript": {
                    category = "JavaScript";
                    icon = "JS.png";
                    break;
                }
                case "rtf": {
                    category = "Rich text";
                    icon = "RTF.png";
                    break;
                }
                case "xhtml+xml": {
                    category = "XHTML";
                    icon = "XHTML.jpg";
                    break;
                }
                case "vnd.google-apps.script+json": {
                    category = "JSON";
                    icon = "JSON.png";
                    break;
                }

                case "octet-stream": {
                    category = "Binary file";
                    icon = "binary_file.png";
                    break;
                }
                case "epub+zip": {
                    category = "Electronic edition";
                    icon = "epub_zip.jpg";
                    break;
                } 
                default: {
                    category = "Unknown file";
                    icon = "unknown_file.jpg";
                    break;
                }   
            }
            break;
        }
        default: {
            category = "Unknown file";
            icon = "unknown_file.jpg";
            break;
        }
     } 
     return [category, icon];
}


