const express	=	require("express");
const multer	=	require('multer');
const fs = require('fs');
const app	=	express();
const ipfs = require('./ipfs');

const storage	=	multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, './uploads');
  },
  filename: function (req, file, callback) {
    callback(null, file.fieldname + '-' + Date.now());
  }
});

const upload = multer({ storage : storage}).single('userPhoto');

app.get('/', (req,res) => {
      res.sendFile(__dirname + "/index.html");
});

app.post('/api/photo', (req,res) => {
	upload(req,res, async (err) => {
		if(err) {
			return res.end("Error uploading file.");
        }
        let fileObject = fs.readFileSync(__dirname + '/' + req.file.path);
        let response = await ipfs.addFile(Buffer.from(fileObject));
        let link = `http://localhost:8080/ipfs/${response[0].hash}`;
		res.end(`File is uploaded - Click <a href="${link}">here</a> to view the file`);
	});
});

app.listen(3000,function(){
    console.log("Working on port 3000");
});