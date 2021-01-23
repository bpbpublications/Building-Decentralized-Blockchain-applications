const IPFS = require('ipfs-api');
const OrbitDB = require('orbit-db');
const uuid = require('uuid/v4');
const bcrypt = require('bcrypt');
const fs = require('fs');
const Identities = require('orbit-db-identity-provider');
const addressGenerator = require('./utils/genkey');
const signMessage = require('./utils/sign');
const verifyMessage = require('./utils/verify');

// load all dbs
let filePath = './dbaddress.js';
let userDb = null;
let userContactsDb = null;
let userEmailsDb = null;

async function loadDB() {
    const ipfsOptions = {
        EXPERIMENTAL: {
            pubsub: true
        },
        relay: {
            enabled: true, hop: {
                enabled: true, active: true
            }
        },
        host: 'localhost',
        port: '5001'
    };
    
    // create identity
    const IdOptions = { id: 'local-id'};
    var identity = await Identities.createIdentity(IdOptions);
    
    // Create IPFS instance
    const ipfs = new IPFS(ipfsOptions);
    const orbitdb = new OrbitDB(ipfs, identity);
    
    console.log('loading the databases');
    try {
        //loads all db
        fs.access(filePath, fs.F_OK, async (err) => {
            if(err) {
                // file does not exists
                // create databases and create file
                console.log('Databases does not exists, this is a genesis peer\n');
                console.log('Creating databases and path files\n');
                // create dbs
                userDb = await orbitdb.create('email.user', 'docstore', {
                    accessController: {
                        write: ['*']
                    }                    
                });

                userContactsDb = await orbitdb.create('email.user.contacts', 'docstore', {
                    accessController: {
                        write: ['*']
                    }   
                });

                userEmailsDb = await orbitdb.create('email.user.data', 'docstore', {
                    accessController: {
                        write: ['*']
                    }   
                });
                let fileContents = {
                    "user": userDb.address.toString(),
                    "contacts": userContactsDb.address.toString(),
                    "emails": userEmailsDb.address.toString()
                }
                // write the db file
                fs.writeFileSync(filePath, JSON.stringify(fileContents));
                console.log('database peer file created, loading them in memory');
            } else {
                // file exists, load the databases
                let fileData = fs.readFileSync(filePath,'utf-8');
                let config = JSON.parse(fileData);
                console.log('Databases exists, loading them in memory\n');
                userDb = await orbitdb.open(config.user);
                userContactsDb = await orbitdb.open(config.contacts);
                userEmailsDb = await orbitdb.open(config.emails);
            }

            // load the local store of the data
            userDb.events.on('ready', () => {
                console.log('user database is ready.')
            });

            userDb.events.on('replicate.progress', (address, hash, entry, progress, have) => {
                console.log('user database replication is in progress');
            });

            userDb.events.on('replicated', (address) => {
                console.log('user database replication done.');
            });

            userContactsDb.events.on('ready', () => {
                console.log('user contacts database is ready.')
            });

            userContactsDb.events.on('replicate.progress', (address, hash, entry, progress, have) => {
                console.log('user contacts database replication is in progress');
            });

            userContactsDb.events.on('replicated', (address) => {
                console.log('user contacts replication done.');
            });

            userEmailsDb.events.on('ready', () => {
                console.log('user emails database is ready.')
            });

            userEmailsDb.events.on('replicate.progress', (address, hash, entry, progress, have) => {
                console.log('user emails database replication is in progress');
            });

            userEmailsDb.events.on('replicated', (address) => {
                console.log('user emails databse replication done.');
            });
            userDb.load();
            userContactsDb.load();
            userEmailsDb.load();
        });
    }
    catch (e) {
        console.log(e);
    }
}

// load the database
loadDB();

async function addUser(requestData) {
    try {
        let id = uuid();
        let password = bcrypt.hashSync(requestData.password, 10);
        let addressData = addressGenerator();
        let data = {
            _id: id,
            email: requestData.email,
            password: password,
            publicKey: addressData.publicKey,
            privateKey: addressData.privateKey,
            time: Date.now()
        }
        let hash = await userDb.put(data);
        console.log(hash);
        let userData = userDb.get(id);
        console.log(userData);
        return {
            "error": false,
            "hash": hash,
            "data": userData[0]
        }
    }
    catch (e) {
        console.log(e);
        return {
            "error": true,
            "hash": null,
            "data": null
        }
    }
}

async function login(data) {
    try {
        let userData = await getUserByEmail(data.email);
        if (bcrypt.compareSync(data.password, userData[0].password)) {
            // correct password
            return {
                "error": false,
                "data": {
                    "userId": userData[0]['_id'],
                    "email": userData[0]['email'],
                    "publicKey": userData[0]['publicKey']
                },
                "message": "user logged in successfully."
            }
        } else {
            return {
                "error": true,
                "data": null,
                "message": "password does not match"
            }
        }
    }
    catch (e) {
        console.log(e)
        return {
            "error": true,
            "data": null,
            "message": "error occurred during login"
        }
    }
}

async function getUserContacts(data) {
    try {
        let userContactData = userContactsDb.query((doc) => doc.userId === data.userId);
        return {
            "error": false,
            "data": userContactData,
            "message": "Success"
        };
    }
    catch (e) {
        return {
            "error": true,
            "data": null,
            "message": "failure"
        };
    }
}

async function findIfContactExists(userId, contactId) {
    try {
        let userContactData = userContactsDb.query((doc) => doc.userId === userId && doc.contactId === contactId);
        return {
            "error": false,
            "data": userContactData,
            "message": "Success"
        };
    }
    catch (e) {
        return {
            "error": true,
            "data": null,
            "message": "failure"
        };
    }
}

async function getUserContactsRequest(data) {
    try {
        let contactRequestData = [];
        let userContactRequestData = userContactsDb.query((doc) => doc.contactEmail === data.email && doc.status === 0);
        if(userContactRequestData.length > 0) {
            userContactRequestData.map(async (singleContact) => {
                let userData = await getUserById(singleContact.userId);
                singleContact.senderData = {
                    email: userData[0].email,
                    publicKey: userData[0].publicKey
                };
                contactRequestData.push(singleContact);
            });
        }
        return {
            "error": false,
            "data": contactRequestData,
            "message": "Success"
        };
    }
    catch (e) {
        return {
            "error": true,
            "data": null,
            "message": "failure"
        };
    }
}

async function userContactAction(data) {
    try {
        let contactData = await searchContact(data.contactRequestId);
        console.log(contactData)
        //process.exit(0);
        let action = null;
        if (data.action === 'approve') {
            action = 1;
        }
        if (data.action === 'reject') {
            action = 2;
        }
        let updateData = {
            _id: contactData[0]._id,
            userId: contactData[0].userId,
            contactEmail: contactData[0].contactEmail,
            contactId: contactData[0].contactId,
            contactPubkey: contactData[0].contactPubkey,
            status: action,
            time: Date.now()
        }
        let hash = await userContactsDb.put(updateData);
        console.log(hash);
        // if approved
        // add the contact in current user list too
        if (action === 1) {
            let newContactData = await getUserById(contactData[0].userId);
            let userContactData = {
                _id: uuid(),
                userId: contactData[0].contactId,
                contactEmail: newContactData[0].email,
                contactId: newContactData[0]['_id'],
                contactPubkey: newContactData[0].publicKey,
                status: 1,
                time: Date.now()
            }
            let newHash = await userContactsDb.put(userContactData);
        }
        return {
            "error": false,
            "hash": hash,
            "message": "Success"
        };
    }
    catch (e) {
        return {
            "error": true,
            "hash": null,
            "message": "Failure"
        };
    }
}

async function getUserByEmail(email) {
    let data = userDb.query((doc) => doc.email === email);
    return data;
}

async function getEmails(email) {
    let data = userEmailsDb.query((doc) => doc.to === email);
    return data;
}

async function getSentEmails(email) {
    let data = userEmailsDb.query((doc) => doc.from === email);
    return data;
}

async function searchContact(contactId) {
    let data = userContactsDb.query((doc) => doc._id === contactId);
    return data;
}

async function getUserById(id) {
    let data = userDb.query((doc) => doc._id === id);
    return data;
}

async function addUserContact(data) {
    try {
        let id = uuid();
        let fetchContactData = await getUserByEmail(data.contactEmail);
        if(fetchContactData.length === 0) {
            throw new Error('User does not exists.');
        }
        // check if the user is already in the contact book
        let checkIfExists = await findIfContactExists(data.userId, fetchContactData[0]['_id']);
        if(checkIfExists.error) {
            throw new Error(checkIfExists.message);
        }
        if(checkIfExists.data.length > 0) {
            throw new Error('Contact already exists');
        }
        let contactData = {
            _id: id,
            userId: data.userId,
            contactEmail: data.contactEmail,
            contactId: fetchContactData[0]['_id'],
            contactPubkey: fetchContactData[0].publicKey,
            status: 0,
            time: Date.now()
        }
        let hash = await userContactsDb.put(contactData);
        console.log(hash);
        let contactDataFetch = userContactsDb.get(id);
        console.log(contactDataFetch);
        return {
            "error": false,
            "hash": hash,
            "message": "Success"
        };
    }
    catch (e) {
        return {
            "error": true,
            "hash": null,
            "message": e.message || "Failure"
        };
    }
}

async function sendEmail(data) {
    // here shahid sending email to ash by encrypting the message with shahid's private key and ash's public key
    try {
        let id = uuid();
        let senderData = await getUserByEmail(data.from);
        let reciepentData = await getUserByEmail(data.to);
        let checkIfExists = await findIfContactExists(senderData[0]['_id'], reciepentData[0]['_id']);
        console.log(checkIfExists)
        if(checkIfExists.error) {
            throw new Error(checkIfExists.message);
        }
        if(checkIfExists.data.length === 0) {
            throw new Error('Contact does not exist, please add contact.');
        }
        if(checkIfExists.data[0].status !== 1) {
            throw new Error('Contact is not approved yet.');
        }
        let email = data.email;
        let signatureData = signMessage(email, { privateKey: senderData[0].privateKey, publicKey: reciepentData[0].publicKey });
        let emailData = {
            _id: id,
            from: data.from,
            to: data.to,
            subject: data.subject || '(No Subject)',
            email: signatureData.data,
            signature: signatureData.nonce,
            readStatus: false,
            time: Date.now()
        }
        let hash = await userEmailsDb.put(emailData);
        console.log(hash);
        let emailFetch = userEmailsDb.get(id);
        console.log(emailFetch);
        return {
            "error": false,
            "hash": hash,
            "message": "Success"
        };
    }
    catch (e) {
        return {
            "error": true,
            "hash": null,
            "message": e.message || "Failure"
        };
    }
}

async function getUserEmail(data) {
    try {
        let emailData = await getEmails(data.email);
        return {
            "error": false,
            "data": emailData,
            "message": "Success"
        };
    }
    catch (e) {
        return {
            "error": true,
            "data": null,
            "message": "Failure"
        };
    }
}


async function getUserSentEmail(data) {
    try {
        let emailData = await getSentEmails(data.email);
        return {
            "error": false,
            "data": emailData,
            "message": "Success"
        };
    }
    catch (e) {
        return {
            "error": true,
            "data": null,
            "message": "Failure"
        };
    }
}

async function readEmail(data) {
    try {
        let emailData = userEmailsDb.query((doc) => doc._id === data.id);
        let userData = await getUserByEmail(data.email);
        let senderData = await getUserByEmail(data.source === 'inbox' ? emailData[0].from: emailData[0].to);
        let decryptEmail = verifyMessage({
            email: emailData[0].email,
            signature: emailData[0].signature
        }, {
                senderPublicKey: senderData[0].publicKey,
                privateKey: userData[0].privateKey
            });
        return {
            "error": false,
            "data": {
                from: emailData[0].from,
                to: emailData[0].to,
                subject: emailData[0].subject || '(No Subject)',
                email: decryptEmail,
            },
            "message": "Success"
        };
    }
    catch (e) {
        return {
            "error": true,
            "data": null,
            "message": "Failure"
        };
    }
}

async function checkUserEmail(data) {
    try {
        let userData = await getUserByEmail(data.email);
        if (userData.length == 0) {
            return {
                "error": false,
                "data": null,
                "message": "email does not exists."
            } 
        } else {
            // email present
            return {
                "error": true,
                "data": null,
                "message": "email already exists."
            }
        }
    }
    catch (e) {
        console.log(e)
        return {
            "error": true,
            "data": null,
            "message": "error occurred during email presence check."
        }
    }
}


module.exports = {
    addUser: addUser,
    login: login,
    getUserContacts: getUserContacts,
    addUserContact: addUserContact,
    userContactAction: userContactAction,
    sendEmail: sendEmail,
    getUserEmail: getUserEmail,
    readEmail: readEmail,
    getUserContactsRequest: getUserContactsRequest,
    checkUserEmail: checkUserEmail,
    getUserSentEmail: getUserSentEmail,
}