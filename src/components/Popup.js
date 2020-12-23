import React, { useState } from 'react';

import '../styles/popup_styles.css';

function sign_in_out(action) {
    chrome.runtime.sendMessage({ from: 'popup', message: action }, response => {
        if (response.message === 'success') {
            location.reload();
        }
    })
}

function Popup() {
    const [user_status, setUserStatus] = useState();

    chrome.runtime.sendMessage({ message: 'get_user_status' }, response => {
        if (response.message === 'success') {
            if (response.payload) {
                setUserStatus(true);
            } else {
                setUserStatus(false);
            }
        }
    });

    return (
        <div id="chrome-ext-container_popup">
            <div className="chrome-ext-popup_name">Welcome</div>
            {
                user_status ?
                    <div onClick={() => sign_in_out('logout')} className="chrome-ext-sign_in_out">Sign Out</div> :
                    <div onClick={() => sign_in_out('login')} className="chrome-ext-sign_in_out">Sign In</div>
            }
        </div>
    )
}

export default Popup;