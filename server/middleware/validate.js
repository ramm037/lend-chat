const Joi = require('joi');

//validation schemas - define the shape of valid data
const schemas = {
    register: Joi.object({
        username: Joi.string()
            .alphanum()
            .min(3)
            .max(30)
            .required()
            .messages({
                'string.alphanum': 'Username can only contain letters and numbers',
                'string.min': 'Username must be at least 3 characters',
                'string.max': 'Username cannot exceed 30 characters',
                'any.required': 'Username is required'
            }),
        email: Joi.string()
            .email()
            .required()
            .messages({
                'string.email': 'Invalid email format',
                'any.required': 'Email is required'
            }),
        password: Joi.string()
            .min(8)
            .max(100)
            .required()
            .messages({
                'string.min': 'Password must be at least 8 characters',
                'any.required': 'Password is required'
            })
    }),

    login: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    }),

    createChannel: Joi.object({
        name: Joi.string()
            .min(1)
            .max(50)
            .required()
            .messages({
                'string.min': 'Channel name required',
                'string.max': 'Channel name too long'
            }),
        is_group: Joi.boolean().optional()
    }),

    sendMessage: Joi.object({
        content: Joi.string()
            .min(1)
            .max(2000)
            .required()
            .messages({
                'string.max': 'Message too long (max 2000 characters)'
            })
    })
};

//Validate middleware factory
//returns a middleware function for the given schema
const validate = (schemaName) => {
    return (req, res, next) => {
        const schema = schemas[schemaName];
        if (!schema) return next();

        //abortEarly: false = collect ALL errors, not just first one
        const { error } = schema.validate(req.body, { abortEarly: false });

        if (error) {
            // Extract all error messages into an array
            const errors = error.details.map(d => d.message);
            return res.status(400).json({
                error: 'Validation failed',
                details: errors
            });
        }

        next();
    };
};

module.exports = validate;
