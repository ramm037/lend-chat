const multer = require('multer');

//memory storage - file storage in RAM as a buffer, not onn disk
//we're not saving to disk because we immediately upload to cloudinary
//Disk storage would leave temp files behind

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5mb max
    },
    fileFilter: (req, file, cb) => {
        //only allow image files
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true); //accept
        } else {
            cb(new Error('Only image files allowed')); //reject
        }
    }
});

module.exports = upload;