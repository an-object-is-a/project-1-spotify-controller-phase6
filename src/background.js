let active_tabId = null;
let user_signed_in = false;

const CLIENT_ID = encodeURIComponent('5df1d74cb7a34318afdb86c2e33fb586');
const RESPONSE_TYPE = encodeURIComponent('code');
const REDIRECT_URI = encodeURIComponent(chrome.identity.getRedirectURL());
const CODE_CHALLENGE_METHOD = encodeURIComponent('S256');
const SCOPE = encodeURIComponent('user-read-playback-state user-modify-playback-state');
const SHOW_DIALOG = encodeURIComponent('true');


let CODE_VERIFIER = '',
    STATE = '',
    ACCESS_TOKEN = '',
    REFRESH_TOKEN = '';


function rand_string() {
    return Math.random().toString(36).substring(2);
}

function clear_tokens() {
    ACCESS_TOKEN = '';
    REFRESH_TOKEN = '';
    user_signed_in = false;
}

function get_authorization_code_endpoint() {
    return new Promise(async (resolve, reject) => {
        CODE_VERIFIER = rand_string().repeat('5');
        const code_challenge = base64urlencode(await sha256(CODE_VERIFIER));
        STATE = encodeURIComponent('meet' + rand_string());

        const oauth_endpoint =
            `https://accounts.spotify.com/authorize?
&client_id=${CLIENT_ID}
&response_type=${RESPONSE_TYPE}
&redirect_uri=${REDIRECT_URI}
&code_challenge_method=${CODE_CHALLENGE_METHOD}
&scope=${SCOPE}
&show_dialog=${SHOW_DIALOG}
&code_challenge=${code_challenge}
&state=${STATE}
`;

        resolve({
            message: 'success',
            auth_endpoint: oauth_endpoint
        });
    });
}

function get_access_token_endpoint(code) {
    return fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `client_id=${CLIENT_ID}&grant_type=authorization_code&code=${code}&redirect_uri=${chrome.identity.getRedirectURL()}&code_verifier=${CODE_VERIFIER}`
    })
        .then(res => {
            if (res.status === 200) {
                return res.json();
            } else {
                throw new Error('unauthorized');
            }
        })
        .then(res => {
            return {
                ...res,
                message: 'success'
            }
        });
}

function get_refresh_token_endpoint() {
    return fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `client_id=${CLIENT_ID}&grant_type=refresh_token&refresh_token=${REFRESH_TOKEN}`
    })
        .then(res => {
            if (res.status === 200) {
                return res.json();
            } else {
                throw new Error('unauthorized');
            }
        })
        .then(res => {
            return {
                ...res,
                message: 'success'
            }
        })
}

function get_state() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get('chrome-ext-Spotify-controller', item => {
            if (chrome.runtime.lastError) {
                reject('fail');
            } else {
                const state = item['chrome-ext-Spotify-controller'] ? item['chrome-ext-Spotify-controller'] : "{}";

                resolve(JSON.parse(state));
            }
        });
    });
}

function set_state(_state) {
    return new Promise((resolve, reject) => {
        get_state()
            .then(res => {
                const updated_state = {
                    ...res,
                    ..._state
                }

                chrome.storage.local.set({ 'chrome-ext-Spotify-controller': JSON.stringify(updated_state) }, () => {
                    if (chrome.runtime.lastError) {
                        reject('fail');
                    } else {
                        resolve('success');
                    }
                });
            });
    });
}

const player = {
    play: function () {
        return fetch('https://api.spotify.com/v1/me/player/play', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            }
        })
            .then(res => {
                if (res.status === 204) {
                    return 'success';
                } else {
                    throw new Error('fail');
                }
            });
    },
    pause: function () {
        return fetch('https://api.spotify.com/v1/me/player/pause', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            }
        })
            .then(res => {
                if (res.status === 204) {
                    return 'success';
                } else {
                    throw new Error('fail');
                }
            });
    },
    next: function () {
        return fetch('https://api.spotify.com/v1/me/player/next', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            }
        })
            .then(res => {
                if (res.status === 204) {
                    return 'success';
                } else {
                    throw new Error('fail');
                }
            });
    },
    prev: function () {
        return fetch('https://api.spotify.com/v1/me/player/previous', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            }
        })
            .then(res => {
                if (res.status === 204) {
                    return 'success';
                } else {
                    throw new Error('fail');
                }
            });
    },
    current: function () {
        return fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            }
        })
            .then(res => {
                if (res.status === 200 || res.status === 204) {
                    return res.status === 200 ? res.json() : {};
                } else {
                    throw new Error('fail');
                }
            })
            .then(res => {
                return {
                    current_track: res.item ? `${res.item.artists[0].name} - ${res.item.name}` : '',
                    isPlaying: res.is_playing
                }
            });
    }
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.from === 'popup' && request.message === 'login') {
        // sign the user in with Spotify
        get_authorization_code_endpoint()
            .then(res => {
                chrome.identity.launchWebAuthFlow({
                    url: res.auth_endpoint,
                    interactive: true
                }, function (redirect_url) {
                    console.log(redirect_url)
                    if (chrome.runtime.lastError || redirect_url.includes('access_denied')) {
                        sendResponse({ message: 'fail' });
                    } else {
                        const code = redirect_url.substring(redirect_url.indexOf('code=') + 5);
                        const state = redirect_url.substring(redirect_url.indexOf('state=') + 6);

                        if (state === STATE) {
                            get_access_token_endpoint(code)
                                .then(res => {
                                    if (res.message === 'success') {
                                        ACCESS_TOKEN = res.access_token;
                                        REFRESH_TOKEN = res.refresh_token;
                                        user_signed_in = true;

                                        setTimeout(() => {
                                            get_refresh_token_endpoint()
                                                .then(res => {
                                                    if (res.message === 'success') {
                                                        setTimeout(() => {
                                                            clear_tokens();
                                                        }, res.expires_in * 1000);
                                                    }
                                                })
                                                .catch(err => sendResponse({ message: 'fail' }));
                                        }, res.expires_in * 1000);

                                        get_state()
                                            .then(res => {
                                                player.current()
                                                    .then(current => {
                                                        chrome.tabs.sendMessage(active_tabId, { from: 'background', message: 'update_state', payload: { ...res, ...current } });
                                                        sendResponse({ message: 'success' });
                                                    });
                                            })
                                            .catch(err => sendResponse({ message: 'fail' }));
                                    } else {
                                        sendResponse({ message: 'fail' });
                                    }
                                })
                                .catch(err => sendResponse({ message: 'fail' }));
                        } else {
                            sendResponse({ message: 'fail' });
                        }
                    }
                });
            })
            .catch(err => sendResponse({ message: 'fail' }));

        return true;
    } else if (request.from === 'popup' && request.message === 'logout') {
        clear_tokens();

        sendResponse({ message: 'success' });
    }

    if (request.message === 'open_close') {
        set_state(request.payload)
            .then(res => sendResponse({ message: 'success' }))
            .catch(err => sendResponse({ message: 'fail' }));

        return true;
    } else if (!user_signed_in) {
        chrome.tabs.sendMessage(active_tabId, { from: 'background', message: 'login' });
        sendResponse({ message: 'fail' });
    } else {
        if (request.message === 'play') {
            player.play()
                .then(res => set_state(request.payload))
                .then(res => player.current())
                .then(res => sendResponse({ message: 'success', current_track: res.current_track }))
                .catch(err => sendResponse({ message: 'fail' }));

            return true;
        } else if (request.message === 'pause') {
            player.pause()
                .then(res => set_state(request.payload))
                .then(res => player.current())
                .then(res => sendResponse({ message: 'success', current_track: res.current_track }))
                .catch(err => sendResponse({ message: 'fail' }));

            return true;
        } else if (request.message === 'next_track') {
            player.next()
                .then(res => player.current())
                .then(res => set_state({ current_track: res.current_track }))
                .then(res => player.current())
                .then(res => sendResponse({ message: 'success', current_track: res.current_track }))
                .catch(err => sendResponse({ message: 'fail' }));

            return true;
        } else if (request.message === 'prev_track') {
            player.prev()
                .then(res => player.current())
                .then(res => set_state({ current_track: res.current_track }))
                .then(res => player.current())
                .then(res => sendResponse({ message: 'success', current_track: res.current_track }))
                .catch(err => sendResponse({ message: 'fail' }));

            return true;
        } else if (request.message === 'get_state') {
            get_state()
                .then(res => {
                    player.current()
                        .then(current => {
                            sendResponse({ message: 'success', payload: { ...res, ...current } })
                        });
                })
                .catch(err => sendResponse({ message: 'fail' }));

            return true;
        } else if (request.message === 'set_state') {
            set_state(request.payload)
                .then(res => sendResponse({ message: 'success' }))
                .catch(err => sendResponse({ message: 'fail' }));

            return true;
        } else if (request.from === 'options' && request.message === 'update_current_deck') {
            chrome.tabs.sendMessage(active_tabId, { from: 'background', message: 'update_current_deck', payload: request.payload });
            sendResponse({ message: 'success' });

            return true;
        } else if (request.message === 'get_user_status') {
            sendResponse({ message: 'success', payload: user_signed_in });

            return true;
        }
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url.includes('http')) {
        active_tabId = tabId;

        chrome.tabs.executeScript(tabId, { file: './inject_script.js' }, function () {
            chrome.tabs.executeScript(tabId, { file: './foreground.bundle.js' }, function () {
                console.log("INJECTED AND EXECUTED");
            });
        });
    }
});

chrome.tabs.onActivated.addListener(activeInfo => {
    chrome.tabs.get(activeInfo.tabId, function (tab) {
        if (tab.url.includes('http')) active_tabId = activeInfo.tabId;
    });
});