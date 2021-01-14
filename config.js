module.exports = {
    'facebookAuth': {
        'clientID': '598785524326976', 
        'clientSecret': '6f81f3cd00bbf9b058a4e49194e1bf95', 
        'callbackURL': 'http://localhost:3000/auth/facebook/callback'
    },
    'googleAuth': {
        'clientID': '152406542613-752jr7mhmstt3jfnq729e62uq0suabl4.apps.googleusercontent.com',
        'clientSecret': 'YX5CTkfUyZagxy8r9b04Zugh',
        //'callbackURL': 'http://localhost:3000/auth/google/callback',
        'callbackURL': 'https://multi-cloud-manager.herokuapp.com/auth/google/callback' 
    },
    'oneDriveAuth': {
        'clientID': '07f47f99-05cb-49ef-8dbe-f142b628a043',
        'clientSecret': 'wiSRKN46({=kfcljQVR352*',
        // 'clientID': '7a926022-77f5-49a2-81fe-e33ac5e2f8cf',
        // 'clientSecret': 'K_6a9RgXMh.XxPHnJ-al62~UNCBV0B~3y_',
        //'callbackURL': 'http://localhost:3000/auth/onedrive/callback',
        'callbackURL': 'https://multi-cloud-manager.herokuapp.com/auth/onedrive/callback', 
        'scopes':'profile offline_access user.readwrite files.readwrite.all openid',
        'authority':'https://login.microsoftonline.com/common/',
        'idMetadata':'v2.0/.well-known/openid-configuration',
        'endpoint':'oauth2/v2.0/authorize',
        'tokenEndpoint': 'oauth2/v2.0/token'
    },
    'dropboxAuth': {
        'clientID': 'e40ib43jnytlnl3',
        'clientSecret': 'mrdngklyl9ym4ng',
        //'callbackURL': 'http://localhost:3000/auth/dropbox/callback',
        'callbackURL': 'https://multi-cloud-manager.herokuapp.com/auth/dropbox/callback', 
        'token':'KUJj_VgS8EAAAAAAAAAATbiFcxl8yVJiSLYGymtvPFCFArek92zqu5yKjC1sa0U0'
    },
    'dirPath': __dirname
};