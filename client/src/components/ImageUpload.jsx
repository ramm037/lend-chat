import { useRef, useState } from 'react';

function ImageUpload({ accessToken, channelId, dmId, socket, isDM }) {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = async (e) => {
        console.log('channelId:', channelId, 'dmId:', dmId, 'isDM:', isDM);
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);

        try {
            //formData - used for multipart/form-data requests (file uploads)
            //can't use JSON for files - must be form data
            const formData = new FormData();
            formData.append('image', file);

            //Append channelId or dmId depending on context
            if (isDM) {
                formData.append('dmId', dmId);
            } else {
                formData.append('channelId', channelId);
            }

            const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/upload`, {
                method: 'POST',
                headers: {
                    //Don't set Content-type for form data-
                    //browser sets it automatically with the boundary string
                    //if you set it manually, the boundary is missing and server crashes
                    Authorization: `Bearer ${accessToken}`
                },
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.error);
                return;
            }

            //emit via socket so all room members see it instantly
            if (isDM) {
                socket.emit('send_dm_image', {
                    dmId,
                    newMessage: data.newMessage
                });
            } else {
                socket.emit('send_channel_image', {
                    channelId,
                    newMessage: data.newMessage
                });
            }
        } catch (err) {
            console.error('Upload error:', err);
            alert('Upload Failed');
        } finally {
            setUploading(false);

            //Reset file input so same file can be uploaded again
            fileInputRef.current.value = '';
        }
    };

    return (
        <div>
            {/* Hidden file input — triggered by the button below */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
            <button
                onClick={() => fileInputRef.current.click()}
                disabled={uploading}
                style={{
                    padding: '8px 12px',
                    borderRadius: 4,
                    border: '1px solid #ccc',
                    backgroundColor: 'transparent',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    fontSize: 18
                }}
                title="Upload Image"
            >
                {uploading ? '⏳' : '📎'}
            </button>
        </div>
    );
}

export default ImageUpload;