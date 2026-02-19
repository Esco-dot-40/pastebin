if (!window.PasteAPI) {
    window.PasteAPI = class PasteAPI {
        constructor() {
            this.apiUrl = window.location.origin + '/api';
            this.dbName = 'veroe_local_cache';
            this.machineId = localStorage.getItem('machine_id');
            this.fingerprint = null;
            this._initPromise = this.initFingerprint();
        }

        async initFingerprint() {
            if (this.fingerprint) return;
            try {
                // Entropy Sources
                const screenRes = `${window.screen.width}x${window.screen.height}`;
                const colorDepth = window.screen.colorDepth;
                const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                const language = navigator.language;
                const cpuCores = navigator.hardwareConcurrency || 4;
                const memory = navigator.deviceMemory || 4;

                let gpuRenderer = 'Standard';
                try {
                    const canvas = document.createElement('canvas');
                    const gl = canvas.getContext('webgl');
                    if (gl) {
                        const debug = gl.getExtension('WEBGL_debug_renderer_info');
                        gpuRenderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'Standard';
                    }
                } catch (e) { }

                const fp = {
                    cpuCores,
                    deviceMemory: memory,
                    screenResolution: screenRes,
                    colorDepth,
                    timezone,
                    language,
                    gpuRenderer,
                    osBuild: navigator.platform,
                    userAgent: navigator.userAgent
                };

                // Stable Hardware Signature (SHA-256)
                // We exclude volatile data if any (though these are mostly stable)
                const raw = `${fp.cpuCores}-${fp.deviceMemory}-${fp.screenResolution}-${fp.gpuRenderer}-${fp.timezone}-${fp.language}`;
                const msgUint8 = new TextEncoder().encode(raw);
                const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
                const hashArray = Array.from(new Uint8Array(hashBuffer));

                const newId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                // Only override if we don't have one or if it's the old 'gen-' format
                if (!this.machineId || this.machineId.startsWith('gen-')) {
                    this.machineId = newId;
                    localStorage.setItem('machine_id', this.machineId);
                }

                this.fingerprint = fp;
            } catch (e) {
                console.warn('Fingerprinting error, using fallback ID', e);
                if (!this.machineId) {
                    this.machineId = 'err-' + Math.random().toString(36).substr(2, 9);
                }
            }
        }

        async _fetch(url, options = {}) {
            if (!this.fingerprint) await this._initPromise;

            const headers = options.headers || {};
            headers['x-veroe-fingerprint'] = this.machineId;
            headers['x-veroe-meta'] = JSON.stringify(this.fingerprint);

            const key = localStorage.getItem('private_access_key');
            if (key) headers['x-access-key'] = key;

            options.headers = headers;
            options.credentials = 'include';
            return fetch(url, options);
        }

        async createPaste(content, config) {
            try {
                const response = await this._fetch(`${this.apiUrl}/pastes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content,
                        title: config.title || 'Untitled Paste',
                        language: config.language || 'plaintext',
                        expiresAt: config.expiresAt || null,
                        isPublic: config.isPublic !== false,
                        burnAfterRead: config.burnAfterRead || false,
                        folderId: config.folderId || null,
                        password: config.password || null,
                        embedUrl: config.embedUrl || null,
                        discordThumbnail: config.discordThumbnail || null
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
                const response = await this._fetch(`${this.apiUrl}/pastes/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content,
                        title: config.title || 'Untitled Paste',
                        language: config.language || 'plaintext',
                        expiresAt: config.expiresAt || null,
                        isPublic: config.isPublic !== false,
                        burnAfterRead: config.burnAfterRead || false,
                        folderId: config.folderId || null,
                        password: config.password || null,
                        embedUrl: config.embedUrl || null,
                        discordThumbnail: config.discordThumbnail || null
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
                const response = await this._fetch(url, {
                    method: 'GET'
                });

                if (response.status === 404) return null;

                if (!response.ok) {
                    let errorData;
                    try {
                        const text = await response.text();
                        errorData = JSON.parse(text);
                    } catch (e) { }
                    throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
                }

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
                const response = await this._fetch('http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query');
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
                const response = await this._fetch(`${this.apiUrl}/pastes?_t=${Date.now()}`, {
                    method: 'GET'
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
                const response = await this._fetch(`${this.apiUrl}/pastes/${id}`, {
                    method: 'DELETE'
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
                // Use track=false to bypass authorization if admin session is flaky
                const response = await this._fetch(`${this.apiUrl}/pastes/${pasteId}/analytics?track=false&_t=${Date.now()}`, {
                    method: 'GET'
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
                uniqueCountries: new Set(data.views.map(v => v.countryCode).filter(Boolean)).size,
                topLocations: Object.entries(data.summary)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count),
                topISPs: [],
                topRegions: [],
                platforms: [],
                browsers: [],
                recentViews: data.views.slice().reverse().slice(0, 50),
                reactions: { heart: 0, star: 0, like: 0 },
                detailedReactions: [],
                source: 'local'
            };
        }

        async getGlobalAnalytics() {
            try {
                const response = await this._fetch(`${this.apiUrl}/pastes/analytics?_t=${Date.now()}`, {
                    method: 'GET'
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
                await this._fetch(`${this.apiUrl}/pastes/${pasteId}/analytics`, {
                    method: 'DELETE'
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
                const response = await this._fetch(`${this.apiUrl}/pastes/stats/summary`, {
                    method: 'GET'
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
                const response = await this._fetch(`${this.apiUrl}/pastes/${id}/reset-views`, {
                    method: 'POST'
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
                const response = await this._fetch(`${this.apiUrl}/folders`, {
                    method: 'GET'
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
                const response = await this._fetch(`${this.apiUrl}/folders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
                const response = await this._fetch(`${this.apiUrl}/folders/${id}`, {
                    method: 'DELETE'
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
            await this._fetch(`${this.apiUrl}/auth/logout`, { method: 'POST' });
            window.location.reload();
        }

        // REACTION METHODS
        async toggleReaction(pasteId, type) {
            try {
                const response = await this._fetch(`${this.apiUrl}/pastes/${pasteId}/react`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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

