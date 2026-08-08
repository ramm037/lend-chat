const express = require('express');
const cloudinary = require('../cloudinary');
const upload = require('../middleware/upload');
const authMiddleware = require('../middleware/auth');
const db = require('../db');

const router = express.Router();
router.use(authMiddleware);

//POST/api/upload
//accepts an image+channelId or dmID
//uploads to clpoudinary, saves message with image_url, broadcasts via socket
router.post('/', upload.single('image'), async (req, res) => {
    //upload.single('image') - processes one file from the 'image' field
    //req.file = the uploaded file object
    //req.body = other form fields (channelId, dmId)

    if (!req.file) {
        return res.status(400).json({ error: 'No image Provided' });
    }

    const { channelId, dmId } = req.body;
    const userId = req.user.id;

    if (!channelId && !dmId) {
        return res.status(400).json({ error: 'channelId or dmId required '});
    }

    try {
        //upload to cloudinary using upload_stream -
        //takes a buffer (from memoryStorage) and streams it to Cloudinary
        //returns a result object with secure_url
        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'lend-chat', //organizes uploads in cloudinary dashboard
                    resource_type: 'image'
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            //push the file buffer into the stream
            stream.end(req.file.buffer);
        });

        const imageUrl = uploadResult.secure_url;
        //secure_url = https URL, always use this over url (which is http)

        const targetChannelId = channelId || dmId;
        const isDM = !!dmId;

        //save messages to DB with image_url, content is null for image_only messages
        const [result] = await db.query(
            'INSERT INTO messages (channel_id, sender_id, content, image_url) VALUES (?, ?, ?, ?)',
            [targetChannelId, userId, null, imageUrl]
        );

        //build message object - same shape as text messages
        //so frontend can render both with same component
        const newMessage = {
            id: result.insertId,
            channelId: targetChannelId,
            content: null,
            image_url: imageUrl,
            sender_id: userId,
            username: req.user.username,
            created_at: new Date().toISOString()
        };

        //return the message so react can emit it via socket
        res.status(201).json({
            message: 'Image uploaded',
            newMessage,
            isDM
        });


    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

module.exports = router;