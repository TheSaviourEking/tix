// export interface UploadImageResult {
//     url: string;
//     publicId: string;
// }

// export async function uploadImage(file: File): Promise<UploadImageResult> {
//     try {
//         const formData = new FormData();
//         formData.append('image', file);

//         const response = await fetch('/api/upload-image', {
//             method: 'POST',
//             body: formData,
//         });

//         if (!response.ok) {
//             const errorData = await response.json();
//             throw new Error(errorData.message || 'Failed to upload image');
//         }

//         const data = await response.json();
//         return { url: data.url, publicId: data.publicId };
//     } catch (error) {
//         console.error('Upload error:', error);
//         throw new Error('Failed to upload image');
//     }
// }

export async function uploadImage(file: File, endpoint: string = '/api/upload-image'): Promise<{ url: string; publicId: string }> {
    try {
        const formData = new FormData();
        // Use the correct field name based on the endpoint
        const fieldName = endpoint === '/api/upload-profile-image' ? 'profileImage' : 'image';
        formData.append(fieldName, file);

        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to upload image');
        }

        const data = await response.json();
        return { url: data.url, publicId: data.publicId };
    } catch (error) {
        console.error('Upload error:', error);
        throw new Error('Failed to upload image');
    }
}