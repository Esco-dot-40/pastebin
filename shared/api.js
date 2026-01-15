// API Client for PasteBin Pro
// Uses backend API instead of localStorage

class PasteAPI {
    constructor() {
        this.apiUrl = window.location.origin + '/api';
    }

    async createPaste(content, config) {
        try {
            const response = await fetch(`${this.apiUrl}/pastes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    content,
                    title: config.title || 'Untitled Paste',
                    language: config.language || 'plaintext',
                    expiresAt: config.expiresAt || null,
                    isPublic: config.isPublic !== false,
                    burnAfterRead: config.burnAfterRead || false,
                    folderId: config.folderId || null,
                    password: config.password || null,
                    embedUrl: config.embedUrl || null
                })
            });

            const text = await response.text();
            let data;
            try {
                data = text ? JSON.parse(text) : {};
            } catch (e) {
                console.error('Create paste parse error:', text);
                throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}`);
            }

            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }

            return data.id;
        } catch (error) {
            console.error('Error creating paste:', error);
            throw error;
        }
    }

    async updatePaste(id, content, config) {
        try {
            const response = await fetch(`${this.apiUrl}/pastes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    content,
                    title: config.title || 'Untitled Paste',
                    language: config.language || 'plaintext',
                    expiresAt: config.expiresAt || null,
                    isPublic: config.isPublic !== false,
                    burnAfterRead: config.burnAfterRead || false,
                    folderId: config.folderId || null,
                    password: config.password || null,
                    embedUrl: config.embedUrl || null
                })
            });

            const text = await response.text();
            let data;
            try {
                data = text ? JSON.parse(text) : {};
            } catch (e) {
                console.error('Update paste parse error:', text);
                throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}`);
            }

            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('Error updating paste:', error);
            throw error;
        }
    }

    async getPaste(id, trackLocation = true, password = null) {
        try {
            let url = `${this.apiUrl}/pastes/${id}?track=${trackLocation}&_t=${Date.now()}`;
            if (password) {
                url += `&password=${encodeURIComponent(password)}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.status === 404) return null;
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            return await response.json();
        } catch (error) {
            console.error('Error getting paste:', error);
            throw error;
        }
    }

    async getAllPastes() {
        try {
            const response = await fetch(`${this.apiUrl}/pastes?_t=${Date.now()}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Error getting pastes:', error);
            throw error;
        }
    }

    async deletePaste(id) {
        try {
            const response = await fetch(`${this.apiUrl}/pastes/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Error deleting paste:', error);
            throw error;
        }
    }

    async getAnalytics(pasteId) {
        try {
            const response = await fetch(`${this.apiUrl}/pastes/${pasteId}/analytics?_t=${Date.now()}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Error getting analytics:', error);
            throw error;
        }
    }

    async deleteAnalyticsLogs(pasteId) {
        try {
            const response = await fetch(`${this.apiUrl}/pastes/${pasteId}/analytics`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Error deleting analytics logs:', error);
            throw error;
        }
    }

    async getStats() {
        try {
            const response = await fetch(`${this.apiUrl}/pastes/stats/summary`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Error getting stats:', error);
            throw error;
        }
    }

    async resetViews(id) {
        try {
            const response = await fetch(`${this.apiUrl}/pastes/${id}/reset-views`, {
                method: 'POST',
                credentials: 'include'
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Error resetting views:', error);
            throw error;
        }
    }

    async trackView(pasteId) {
        console.log('trackView handled by API');
    }

    // FOLDER METHODS
    async getAllFolders() {
        try {
            const response = await fetch(`${this.apiUrl}/folders`, {
                method: 'GET',
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to fetch folders');
            return await response.json();
        } catch (error) {
            console.error('Error getting folders:', error);
            throw error;
        }
    }

    async getFolder(id) {
        try {
            const response = await fetch(`${this.apiUrl}/folders/${id}`, {
                method: 'GET',
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to fetch folder');
            return await response.json();
        } catch (error) {
            console.error('Error getting folder:', error);
            throw error;
        }
    }

    async createFolder(name) {
        try {
            const response = await fetch(`${this.apiUrl}/folders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name })
            });
            if (!response.ok) throw new Error('Failed to create folder');
            return await response.json();
        } catch (error) {
            console.error('Error creating folder:', error);
            throw error;
        }
    }

    async deleteFolder(id) {
        try {
            const response = await fetch(`${this.apiUrl}/folders/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to delete folder');
            return await response.json();
        } catch (error) {
            console.error('Error deleting folder:', error);
            throw error;
        }
    }

    // IMAGE METHODS
    async uploadImage(file) {
        try {
            const formData = new FormData();
            formData.append('image', file);

            const response = await fetch(`${this.apiUrl}/images/upload`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            // Read text first to debug non-JSON responses
            const text = await response.text();
            let data;

            try {
                data = text ? JSON.parse(text) : {}; // Handle empty response
            } catch (e) {
                // If parsing fails, use the text as the error message (or formatted error)
                console.error('Upload response parse error:', text);
                throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}`);
            }

            if (!response.ok) {
                throw new Error(data.error || `Upload failed with status ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('Error uploading image:', error);
            throw error;
        }
    }

    // AUTH METHODS
    async getMe() {
        try {
            const response = await fetch(`${this.apiUrl}/auth/me`, { credentials: 'include' });
            if (!response.ok) return null;
            const data = await response.json();
            return data.user;
        } catch (e) {
            return null;
        }
    }

    loginWithDiscord() {
        window.location.href = `${this.apiUrl}/auth/discord`;
    }

    async logout() {
        await fetch(`${this.apiUrl}/auth/logout`, { method: 'POST', credentials: 'include' });
        window.location.reload();
    }

    // REACTION METHODS
    async toggleReaction(pasteId, type) {
        try {
            const response = await fetch(`${this.apiUrl}/pastes/${pasteId}/react`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ type })
            });

            if (response.status === 401) {
                const data = await response.json();
                if (data.authRequired) {
                    throw new Error('AUTH_REQUIRED');
                }
            }

            if (!response.ok) throw new Error('Reaction failed');
            return await response.json();
        } catch (error) {
            console.error('Error toggling reaction:', error);
            throw error;
        }
    }
}

window.PasteAPI = PasteAPI;
window.PasteStorage = PasteAPI;
