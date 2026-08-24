const { accessToken } = require("../../../server/utils/token");

const apiFetch = async (url, options = {}, accessToken = null) => {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
        const res = await fetch(url, { ...options, headers });
        const data = await res.json();

        if (!res.ok) {
            //rate limit hit
            if (res.status === 429) {
                throw new Error(data.error || 'Too many requests. Please slow down');
            }
            //validation error - show all details
            if (res.status === 400 && data.details) {
                throw new Error(data.details.join('\n'));
            }
            throw new Error(data.error || 'Something went wrong');
        }

        return data;
    } catch (err) {
        throw err;
    }
};

export default apiFetch;