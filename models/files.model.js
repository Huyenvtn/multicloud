var mongoose = require('mongoose');

var filesSchema = mongoose.Schema({
    _id: { type:String },
    name: { type:String, default: "" },
    size: { type:String, default: "0" },
    type: { type:String, default: "" },
    driveID: [],
    driveType: { type:String, default: "" },
    thumbnailLink: { type:String, default: "" },
    webUrl: { type:String, default: "" },
    parents: [],
    capabilities: {},
    createDate : { type:Date, default:Date.now },
    modifiedDate : { type:Date, default:Date.now }
});

// methods ======================
filesSchema.methods.addFile = function (_id ="", name="", size="0", mimeType="", driveID="", driveType="", thumbnailLink="", webUrl="", parents, capabilities, createdTime="", modifiedTime="") {
    var newFile = new mongoose.model('File', filesSchema)();  
    newFile._id = _id;
    newFile.name = name;
    newFile.size = size;
    newFile.type = mimeType;
    newFile.driveID.push(driveID);
    if ((parents == undefined) || (parents.length < 1)){
        parents =[];
        parents.push("Share with me");
    }
    newFile.parents = parents;
    newFile.capabilities = capabilities;
    newFile.driveType = driveType;
    newFile.thumbnailLink = thumbnailLink;
    newFile.webUrl = webUrl;
    newFile.createDate = createdTime;
    newFile.modifiedDate = modifiedTime;
    // save the file
    newFile.save(function (err) {
        if (err) throw err;
    });
};

filesSchema.methods.refreshFilesSchema = function (listFiles, driveID, driveType="") {
    var length = listFiles.length ? listFiles.length : Object.keys(listFiles).length;
    if (length > 0 ){
        listFiles.map((file) => {
            mongoose.model('File', filesSchema).findOne({'_id': file.id}, function (err, sameFile){
                if (err)
                    console.log(err);

                if (sameFile){
                    var newFile = sameFile;  
                    if (!newFile.driveID.includes(driveID)){
                        newFile.driveID.push(driveID);
                    } 
                    
                    newFile.save(function (err) {
                        if (err) throw err;
                    });
                }   
                else {               
                   /* new mongoose.model('File', filesSchema)().addFile(file.id, file.name, file.size, 
                        file.mimeType ? file.mimeType : file.file.mimeType, 
                        driveID, driveType, file.thumbnailLink, 
                        file.webUrl ? file.webUrl : file.webViewLink,
                        file.parents ? file.parents : (file.parentReference ? [file.parentReference.id] : undefined),
                        file.createdTime ? file.createdTime : file.createdDateTime, 
                        file.modifiedTime ? file.modifiedTime : file.lastModifiedDateTime);
                     */   new mongoose.model('File', filesSchema)().addFile(file.id ? file.id : file.id, file.name? file.name : file.file.name, file.size ? file.size : "0", 
                        file.mimeType ? file.mimeType : (file.file.mimeType ? file.file.mimeType : ""), 
                        driveID, driveType, (file.thumbnailLink ? file.thumbnailLink : ""), 
                        file.webUrl ? file.webUrl : (file.webViewLink? file.webViewLink : ""),
                        file.parents ? file.parents : (file.parentReference ? [file.parentReference.id] : (file.path_display? file.path_display : undefined)),
                        file.capabilities ? file.capabilities : {},
                        file.createdTime ? file.createdTime : (file.createdDateTime? file.createdDateTime : file.client_modified), 
                        file.modifiedTime ? file.modifiedTime : (file.lastModifiedDateTime? file.lastModifiedDateTime : file.server_modified));
                    
                    }
            });
        });
    } else {
        console.log('No files found.');
    } 
};

module.exports = mongoose.model('File', filesSchema);

