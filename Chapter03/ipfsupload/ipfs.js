const IPFS = require('ipfs-api');

const ipfsOptions = {
    host: 'localhost',
    port: '5001'
};

const ipfs = new IPFS(ipfsOptions);

function addFile(bufferData) {
    return new Promise((resolve, reject) => {
        ipfs.files.add(bufferData, (err, file) => {
            if(err) {                
                reject(err);
            }
            resolve(file);
        });
    });
}

module.exports = {
    addFile: addFile,
};


