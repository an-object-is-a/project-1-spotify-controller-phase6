import React from 'react';

import '../styles/shared_styles.css';
import '../styles/loadingpage_styles.css';

function LoadingPage() {
    // const loading_screen_gif = './images/loading_screen.gif';
    const loading_screen_gif = chrome.runtime.getURL('./images/loading_screen.gif');

    return (
        <div className="chrome-ext-sub_container" id="chrome-ext-container_loadingpage">
            <img id="chrome-ext-loading_screen" src={loading_screen_gif} alt="loading"/>
            <div id="chrome-ext-loading_text">Loading...</div>
        </div>
    )
}

export default LoadingPage;