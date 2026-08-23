//global error handler - catches any error thrown in routes
//must have 4 parameters for express to treat it as error handler
const errorHandler = (err, req, res, next) => {
    console.error('Unhandled error:', err);

    //Multer errors (file uplaod)
    if (err.message == 'Only image files allowed') {
        return res.status(400).json({ error: err.message });
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum file size is 5MB' })
    }

    //JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Invalid Token' });
    }

    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Duplicate entry' })
    }

    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({ error: 'Referenced record foes not exist' });
    }

    //defalt - generic server error
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
};

const notFound = (req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
};


module.exports = errorHandler;