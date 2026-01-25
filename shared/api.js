if (!window.PasteAPI) {
    window.PasteAPI = class PasteAPI {
        constructor() {
            this.apiUrl = window.location.origin + '/api';
            this.dbName = 'veroe_local_cache';
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
                // Fallback to local storage would go here if needed
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

                const headers = {};
                const key = localStorage.getItem('private_access_key');
                if (key) headers['x-access-key'] = key;

                const response = await fetch(url, {
                    method: 'GET',
                    headers,
                    credentials: 'include'
                });

                if (response.status === 404) return null;
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                const paste = await response.json();

                // If tracking is enabled and we are client-side, also track locally as a backup
                if (trackLocation) {
                    this.trackViewLocally(id);
                }

                return paste;
            } catch (error) {
                console.error('Error getting paste:', error);
                throw error;
            }
        }

        async trackViewLocally(pasteId) {
            try {
                const response = await fetch('http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query');
                const loc = await response.json();
                if (loc.status === 'success') {
                    const localData = JSON.parse(localStorage.getItem('veroe_analytics') || '{}');
                    if (!localData[pasteId]) localData[pasteId] = { views: [], summary: {} };

                    const record = {
                        timestamp: new Date().toISOString(),
                        ip: loc.query,
                        city: loc.city,
                        region: loc.regionName,
                        country: loc.country,
                        countryCode: loc.countryCode,
                        isp: loc.isp,
                        org: loc.org,
                        lat: loc.lat,
                        lon: loc.lon
                    };

                    localData[pasteId].views.push(record);
                    const key = `${loc.city}, ${loc.country}`;
                    localData[pasteId].summary[key] = (localData[pasteId].summary[key] || 0) + 1;

                    localStorage.setItem('veroe_analytics', JSON.stringify(localData));
                }
            } catch (e) {
                console.warn('Local tracking failed:', e);
            }
        }

        async getAllPastes() {
            try {
                const headers = {};
                const key = localStorage.getItem('private_access_key');
                if (key) headers['x-access-key'] = key;

                const response = await fetch(`${this.apiUrl}/pastes?_t=${Date.now()}`, {
                    method: 'GET',
                    headers,
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
                // Try backend first
                const response = await fetch(`${this.apiUrl}/pastes/${pasteId}/analytics?_t=${Date.now()}`, {
                    method: 'GET',
                    credentials: 'include'
                });

                if (response.ok) {
                    const backendData = await response.json();

                    // Merge with local data if available
                    const localData = JSON.parse(localStorage.getItem('veroe_analytics') || '{}');
                    if (localData[pasteId]) {
                        // We primarily trust backend, but maybe show local views too?
                        // For now, let's just return backend data if it exists
                    }
                    return backendData;
                }
            } catch (error) {
                console.warn('Backend analytics failed, checking local:', error);
            }

            // Fallback to local storage (The "Pro" features mentioned by user)
            const localData = JSON.parse(localStorage.getItem('veroe_analytics') || '{}');
            const data = localData[pasteId] || { views: [], summary: {} };

            return {
                totalViews: data.views.length,
                uniqueIPs: new Set(data.views.map(v => v.ip)).size,
                topLocations: Object.entries(data.summary)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count),
                recentViews: data.views.reverse().slice(0, 50),
                source: 'local'
            };
        }

        async getGlobalAnalytics() {
            try {
                const response = await fetch(`${this.apiUrl}/pastes/analytics?_t=${Date.now()}`, {
                    method: 'GET',
                    credentials: 'include'
                });

                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return await response.json();
            } catch (error) {
                console.error('Error getting global analytics:', error);
                throw error;
            }
        }

        async deleteAnalyticsLogs(pasteId) {
            try {
                await fetch(`${this.apiUrl}/pastes/${pasteId}/analytics`, {
                    method: 'DELETE',
                    credentials: 'include'
                });

                const localData = JSON.parse(localStorage.getItem('veroe_analytics') || '{}');
                delete localData[pasteId];
                localStorage.setItem('veroe_analytics', JSON.stringify(localData));

                return { success: true };
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
            // Server-side tracking is automatic, but we can also trigger local tracking
            await this.trackViewLocally(pasteId);
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

        // ACCESS KEY METHODS
        async getAllAccessKeys() {
            try {
                const response = await fetch(`${this.apiUrl}/access/keys`, { credentials: 'include' });
                if (!response.ok) throw new Error('Failed to fetch keys');
                return await response.json();
            } catch (e) {
                console.error('Error getting keys:', e);
                return [];
            }
        }

        async generateAccessKey() {
            try {
                const response = await fetch(`${this.apiUrl}/access/generate`, { method: 'POST', credentials: 'include' });
                if (!response.ok) throw new Error('Failed to generate key');
                return await response.json();
            } catch (e) {
                console.error('Error generating key:', e);
                throw e;
            }
        }

        async revokeAccessKey(id) {
            try {
                const response = await fetch(`${this.apiUrl}/access/keys/${id}`, { method: 'DELETE', credentials: 'include' });
                if (!response.ok) throw new Error('Failed to revoke key');
                return await response.json();
            } catch (e) {
                console.error('Error revoking key:', e);
                throw e;
            }
        }

        async getAllUsers() {
            try {
                const response = await fetch(`${this.apiUrl}/access/users`, { credentials: 'include' });
                if (!response.ok) throw new Error('Failed to fetch users');
                return await response.json();
            } catch (e) {
                console.error('Error getting users:', e);
                return [];
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

                const text = await response.text();
                let data;
                try {
                    data = text ? JSON.parse(text) : {};
                } catch (e) {
                    throw new Error(`Server returned non-JSON response (${response.status})`);
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

                if (!response.ok) {
                    if (response.status === 401) throw new Error('AUTH_REQUIRED');
                    throw new Error('Reaction failed');
                }
                return await response.json();
            } catch (error) {
                console.error('Error toggling reaction:', error);
                throw error;
            }
        }
    }

    // Set as both names to resolve the "misconfiguration"
    window.PasteStorage = window.PasteAPI;
}

