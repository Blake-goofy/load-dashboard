// ==UserScript==
// @name         Load dashboard fix
// @namespace    http://tampermonkey.net/
// @version      0.0
// @description  Fixes load animation hanging on dashboard load
// @icon         https://scale20.byjasco.com/favicon.ico
// @author       Blake
// @match        https://scale25qa.byjasco.com/scale/trans/dashboard
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        debug: false,
        hideSpinnerDelayMs: 0,
        observeTimeoutMs: 15000
    };

    const log = (...args) => {
        if (CONFIG.debug) {
            console.log('[load-dashboard-fix]', ...args);
        }
    };

    let activeRequests = 0;
    let _loadSpinnerObservable = null;

    const getContext = () => {
        if (typeof ko === 'undefined') return null;
        const contextElement = document.querySelector('[data-bind*="_loadSpinner"]') || document.body;
        return ko.contextFor(contextElement);
    };

    const forceSpinnerOff = (source) => {
        if (_loadSpinnerObservable && _loadSpinnerObservable()) {
            log(`Forcing spinner OFF (${source})`);
            _loadSpinnerObservable(false);
        }
    };

    const updateNetworkStatus = (change) => {
        activeRequests += change;
        if (activeRequests < 0) activeRequests = 0;
        
        log(`Active requests: ${activeRequests}`);
        
        if (activeRequests === 0) {
            forceSpinnerOff('network idle');
        }
    };

    const hookNetwork = () => {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            updateNetworkStatus(1);
            try {
                return await originalFetch(...args);
            } finally {
                updateNetworkStatus(-1);
            }
        };

        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (...args) {
            this._tracked = true;
            return originalOpen.apply(this, args);
        };

        XMLHttpRequest.prototype.send = function (...args) {
            if (this._tracked) {
                updateNetworkStatus(1);
                this.addEventListener('loadend', () => updateNetworkStatus(-1));
            }
            return originalSend.apply(this, args);
        };
        log('Network hooks initialized');
    };

    const findAndHookObservable = () => {
        const context = getContext();
        if (context && context.$data && typeof context.$data._loadSpinner === 'function') {
            _loadSpinnerObservable = context.$data._loadSpinner;
            
            // Initial check
            forceSpinnerOff('initial hook');

            // Subscribe to changes
            _loadSpinnerObservable.subscribe((newValue) => {
                log(`_loadSpinner changed to: ${newValue}`);
                if (newValue && activeRequests === 0) {
                    forceSpinnerOff('observable change + network idle');
                }
            });

            log('Hooked into _loadSpinner observable');
            return true;
        }
        return false;
    };

    const boot = () => {
        log('Booting load spinner fix');
        hookNetwork();
        
        const intervalId = setInterval(() => {
            if (findAndHookObservable()) {
                clearInterval(intervalId);
            }
        }, 500);

        // Stop checking after timeout if we never find it
        setTimeout(() => {
            clearInterval(intervalId);
        }, CONFIG.observeTimeoutMs);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();