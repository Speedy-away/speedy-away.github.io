(function (global, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (!global || !global.document) return;
    global.PhoneDownloads = api;
    const start = () => api.install(global.document, global);
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', start, {once: true});
    else start();
})(typeof window === 'object' ? window : globalThis, function () {
    'use strict';

    const MAX_SHARE_BYTES = 25 * 1024 * 1024;
    const FILE_EXTENSION = /\.(?:zip|7z|rar|tar|gz|xz|bz2|bin|elf|pkg|vpk|p3t|ptf|ctf|nxtheme|wuhb|xbe|pbp|pup|upd|fself|rpl|prx|sprx|plugin|self|rpx|nro|nsp|cia|3dsx|dol|nds|gba|iso|img|vhd|chd|dll|exe|msi|apk|aab|dmg|deb|rpm|appimage|lua|gsc|csc|asi|ini|cfg|conf|json|xml|yml|yaml|txt|md|pdf|csv|srt|dat|wad|xex|gpd|ct|py|js|c|cpp|h|hpp)$/i;
    const MEDIA_EXTENSION = /\.(?:png|jpe?g|webp|avif|gif|svg|ico|mp[34]|m4[av]|mov|webm|ogg|wav|flac|aac)$/i;
    const EXCLUDED = '.phone-download-dialog, [data-no-file-options], nav, .sidebar, .mobile-site-header, .site-ad, .site-ad-stage, .sidebar-social, .footer, .key-actions, .loader-download, .receiver-settings, .receiver-files';
    const instances = new WeakMap();

    function filename(value) {
        let text = String(value || '');
        text = text.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_').replace(/[.\s]+$/g, '').trim();
        return text && text !== '.' && text !== '..' ? text.slice(0, 240) : 'download';
    }

    // This classifier is also used by the static site installer. It never
    // follows a link or treats a provider/verification page as a ready file.
    function describeDownload(href, baseURL, options) {
        const settings = options || {};
        let url, base;
        try { url = new URL(String(href || ''), baseURL); base = new URL(baseURL); } catch (_) { return null; }
        if (!/^https?:$/.test(url.protocol) || url.username || url.password || !href) return null;
        if (/(^|\.)bstlar\.com$/i.test(url.hostname) || /\/(?:free-keys|api)(?:\/|$)/i.test(url.pathname)) return null;
        if (url.hostname === 'github.com' && /\/(?:blob|tree|issues|pull|wiki)(?:\/|$)/i.test(url.pathname)) return null;
        const leaf = url.pathname.split('/').pop() || '';
        let decodedLeaf = leaf;
        try { decodedLeaf = decodeURIComponent(leaf); } catch (_) { /* Filename fallback below remains safe. */ }
        const explicit = settings.explicitDownload === true;
        const labelled = /\b(?:download|save (?:file|image|video|audio))\b/i.test(String(settings.label || ''));
        const media = MEDIA_EXTENSION.test(decodedLeaf);
        const localFile = url.origin === base.origin && /^\/downloads\/.+/i.test(url.pathname);
        const releaseAsset = url.hostname === 'github.com' && /^\/[^/]+\/[^/]+\/releases\/download\/[^/]+\/[^/]+$/.test(url.pathname);
        if (/\.md$/i.test(decodedLeaf) && !explicit && !labelled) return null;
        if (media && !explicit && !labelled) return null;
        if (!explicit && !FILE_EXTENSION.test(decodedLeaf) && !(media && labelled) && !localFile && !releaseAsset) return null;
        // An explicit attribute may intentionally download a standalone HTML
        // companion. Ordinary HTML navigation must never become a download.
        if (!explicit && /\.html?$/i.test(decodedLeaf)) return null;
        if (!leaf || /\/$/.test(url.pathname)) return null;
        return {
            href: String(href), url: url.href,
            filename: filename(settings.downloadName || decodedLeaf),
            sameOrigin: url.origin === base.origin
        };
    }

    function getFileInfo(anchor, baseURL) {
        if (!anchor || anchor.tagName !== 'A' || anchor.closest(EXCLUDED)) return null;
        if (anchor.hasAttribute('data-receiver-file') || anchor.hasAttribute('data-receiver-open') || anchor.hasAttribute('data-client-open') || anchor.hasAttribute('data-webman-file')) return null;
        if (anchor.getAttribute('aria-disabled') === 'true' || anchor.classList.contains('disabled') || anchor.id === 'providerLink' || anchor.id === 'loaderDownload') return null;
        return describeDownload(anchor.getAttribute('href'), baseURL, {
            explicitDownload: anchor.hasAttribute('download'),
            downloadName: anchor.getAttribute('download') || '',
            label: (anchor.getAttribute('aria-label') || '') + ' ' + anchor.textContent
        });
    }

    function deviceType(navigator) {
        const nav = navigator || {};
        const ua = String(nav.userAgent || '');
        if (/iPhone|iPad|iPod/i.test(ua) || nav.platform === 'MacIntel' && Number(nav.maxTouchPoints) > 1) return 'ios';
        return /Android/i.test(ua) ? 'android' : 'other';
    }

    function saveInstructions(navigator) {
        const type = deviceType(navigator);
        if (type === 'ios') return 'On iPhone or iPad, tap Download file and confirm Download if asked. In Files → Browse, open iCloud Drive or On My iPhone / iPad, then Downloads, depending on your browser settings. If the file opens as a supported preview, use Share → Save to Files, choose a folder and tap Save.';
        if (type === 'android') return 'On Android, tap Download file and confirm if asked. Find the file in your browser’s Downloads or the Downloads folder in Files / My Files. If a preview opens, use its download button or menu.';
        return 'Choose Download file, then find it in your browser’s Downloads. If a preview opens, use the preview’s download or save command. Your browser chooses the save location.';
    }

    function mimeType(name) {
        const extension = String(name).split('.').pop().toLowerCase();
        return {txt:'text/plain', md:'text/markdown', json:'application/json', xml:'application/xml', pdf:'application/pdf', csv:'text/csv', zip:'application/zip', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', mp4:'video/mp4', mp3:'audio/mpeg'}[extension] || 'application/octet-stream';
    }

    function errorWithCode(code) { const error = new Error(code); error.code = code; return error; }

    async function validateShareFile(file, info, response, length) {
        // Fetch exposes decoded bytes. Content-Length describes the encoded
        // response, so comparing it with a gzip/br body would reject valid files.
        const encoding = (response.headers.get('Content-Encoding') || '').trim().toLowerCase();
        if ((!encoding || encoding === 'identity') && length !== null && file.size !== length) throw errorWithCode('INCOMPLETE');
        const prefix = (await file.slice(0, 1024).text()).replace(/^\uFEFF/, '').trimStart();
        if (/^version https:\/\/git-lfs\.github\.com\/spec\/v1(?:\s|$)/.test(prefix)) throw errorWithCode('UNAVAILABLE');
        // Misconfigured static hosts sometimes serve a successful HTML fallback
        // with an octet-stream/text/plain header. Never share that as a payload.
        // Explicit HTML companions remain downloadable and shareable as HTML.
        if (!/\.(?:html?|xhtml)$/i.test(info.filename)) {
            const start = prefix.replace(/^(?:<!--[\s\S]*?-->\s*)+/, '').replace(/^<\?xml[^>]*>\s*/i, '');
            if (/^(?:<!doctype\s+html\b|<html(?:\s|>)|<head(?:\s|>)|<body(?:\s|>))/i.test(start)) throw errorWithCode('UNAVAILABLE');
        }
        return file;
    }

    async function readShareFile(info, window, signal, limit) {
        const cap = limit || MAX_SHARE_BYTES;
        const here = new URL(window.location.href);
        const url = new URL(info.url, here);
        if (url.origin !== here.origin || !/^https?:$/.test(url.protocol) || url.username || url.password) throw errorWithCode('EXTERNAL');
        const response = await window.fetch(url.href, {method:'GET', credentials:'same-origin', redirect:'error', cache:'no-store', signal});
        const requestedURL = new URL(url), responseURL = new URL(response.url || url, url);
        requestedURL.hash = ''; responseURL.hash = '';
        if (!response.ok || response.type === 'opaque' || response.redirected || responseURL.href !== requestedURL.href) throw errorWithCode('UNAVAILABLE');
        if (response.status === 206 || response.headers.get('Content-Range')) throw errorWithCode('INCOMPLETE');
        const declaredLength = response.headers.get('Content-Length');
        if (declaredLength !== null && !/^\d+$/.test(declaredLength.trim())) throw errorWithCode('UNAVAILABLE');
        const length = declaredLength === null ? null : Number(declaredLength);
        if (length !== null && (!Number.isSafeInteger(length) || length > cap)) {
            if (response.body && typeof response.body.cancel === 'function') { try { await response.body.cancel(); } catch (_) {} }
            throw errorWithCode('TOO_LARGE');
        }
        let type = (response.headers.get('Content-Type') || mimeType(info.filename)).split(';')[0].trim().toLowerCase();
        if (/^(?:text\/html|application\/xhtml\+xml)$/i.test(type) && !/\.(?:html?|xhtml)$/i.test(info.filename)) throw errorWithCode('UNAVAILABLE');
        if (/^(?:application|binary)\/(?:octet-stream|download|x-download)$/.test(type)) type = mimeType(info.filename);
        const parts = [];
        let bytes = 0;
        if (response.body && typeof response.body.getReader === 'function') {
            const reader = response.body.getReader();
            let complete = false;
            try {
                while (true) {
                    if (signal && signal.aborted) throw errorWithCode('ABORTED');
                    const item = await reader.read();
                    if (item.done) { complete = true; break; }
                    bytes += item.value.byteLength;
                    if (bytes > cap) throw errorWithCode('TOO_LARGE');
                    parts.push(item.value);
                }
            } finally {
                if (!complete && typeof reader.cancel === 'function') { try { await reader.cancel(); } catch (_) {} }
                if (typeof reader.releaseLock === 'function') reader.releaseLock();
            }
        } else {
            // Without a stream, require a bounded declared size before putting
            // the response into memory. Encoded lengths do not bound decoded
            // size, so compressed files keep their normal browser download.
            const encoding = (response.headers.get('Content-Encoding') || '').trim().toLowerCase();
            if (!(length > 0 && length <= cap) || encoding && encoding !== 'identity') throw errorWithCode('USE_DOWNLOAD');
            const blob = await response.blob();
            bytes = blob.size;
            if (bytes > cap) throw errorWithCode('TOO_LARGE');
            parts.push(blob);
        }
        if (signal && signal.aborted) throw errorWithCode('ABORTED');
        if (bytes === 0) throw errorWithCode('UNAVAILABLE');
        const file = await validateShareFile(new window.File(parts, info.filename, {type: type || mimeType(info.filename)}), info, response, length);
        if (signal && signal.aborted) throw errorWithCode('ABORTED');
        return file;
    }

    function canShareFile(window, file) {
        try { return Boolean(window.navigator && typeof window.navigator.share === 'function' && typeof window.navigator.canShare === 'function' && window.navigator.canShare({files:[file]})); }
        catch (_) { return false; }
    }

    async function copyLink(document, navigator, field, isCurrent) {
        const text = field.value;
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(text);
                return 'copied';
            }
        } catch (_) { /* Denial falls back to a visible, selectable field. */ }
        if (field.value !== text || isCurrent && !isCurrent()) return 'cancelled';
        field.focus();
        field.select();
        try { if (field.setSelectionRange) field.setSelectionRange(0, field.value.length); } catch (_) {}
        try { if (typeof document.execCommand === 'function' && document.execCommand('copy') === true) return 'copied'; } catch (_) {}
        return 'manual';
    }

    function install(document, window) {
        if (!document || !document.body || !window) return null;
        if (instances.has(document)) return instances.get(document);
        const baseURL = () => window.location.href;
        const mounted = new Map();
        let dialog = null, backdrop = null, ui = null, current = null, opener = null, controller = null, prepared = null, sequence = 0;
        let previousOverflow = '';
        const create = (tag, className, text) => {
            const node = document.createElement(tag);
            if (className) node.className = className;
            if (text != null) node.textContent = text;
            return node;
        };
        const button = (text, className) => { const node = create('button', className, text); node.type = 'button'; return node; };
        const status = (text, state) => { if (ui) { ui.status.textContent = text; ui.status.setAttribute('data-state', state || 'info'); } };

        function reset() {
            sequence++;
            if (controller) controller.abort();
            controller = null; prepared = null; current = null;
            if (ui) { ui.prepare.disabled = false; ui.share.disabled = false; ui.share.hidden = true; }
        }
        function close() {
            if (!dialog || !current && !dialog.open && !dialog.hasAttribute('open')) return;
            reset();
            if (typeof dialog.close === 'function' && dialog.open) dialog.close();
            else dialog.removeAttribute('open');
            if (backdrop) backdrop.hidden = true;
            document.body.style.overflow = previousOverflow;
            if (opener && opener.isConnected) opener.focus({preventScroll:true});
            opener = null;
        }
        function fallbackBackdrop() {
            if (!backdrop) {
                backdrop = create('div', 'phone-download-backdrop');
                backdrop.setAttribute('aria-hidden', 'true');
                backdrop.hidden = true;
                backdrop.addEventListener('click', close);
                document.body.insertBefore(backdrop, dialog);
            }
            return backdrop;
        }
        function makeDialog() {
            if (dialog) return;
            dialog = create('dialog', 'phone-download-dialog');
            dialog.id = 'phone-download-dialog';
            dialog.setAttribute('aria-labelledby', 'phone-download-title');
            dialog.setAttribute('aria-describedby', 'phone-download-instructions');
            const header = create('div', 'phone-download-header');
            const title = create('h2', '', 'Save this file'); title.id = 'phone-download-title';
            const closer = button('×', 'phone-download-close'); closer.setAttribute('aria-label', 'Close file options');
            header.appendChild(title); header.appendChild(closer); dialog.appendChild(header);
            const body = create('div', 'phone-download-body');
            const name = create('p', 'phone-download-filename'); name.setAttribute('translate', 'no'); name.setAttribute('data-i18n-skip', '');
            const instructions = create('p', 'phone-download-note'); instructions.id = 'phone-download-instructions';
            const actions = create('div', 'phone-download-actions');
            const download = create('a', 'btn btn-primary phone-download-link', 'Download file'); download.setAttribute('data-no-file-options', '');
            const copy = button('Copy link', 'btn btn-outline');
            actions.appendChild(download); actions.appendChild(copy);
            const label = create('label', '', 'Download link'); label.setAttribute('for', 'phone-download-url');
            const link = create('input', 'phone-download-url'); link.id = 'phone-download-url'; link.type = 'text'; link.readOnly = true;
            Object.entries({'translate':'no','data-i18n-skip':'','autocapitalize':'off','autocorrect':'off','autocomplete':'off','spellcheck':'false','inputmode':'url'}).forEach(([key,value]) => link.setAttribute(key,value));
            const prepare = button('Prepare file for sharing', 'btn btn-outline');
            const share = button('Save or share file', 'btn btn-primary'); share.hidden = true;
            const sharingActions = create('div', 'phone-download-actions'); sharingActions.appendChild(prepare); sharingActions.appendChild(share);
            const shareNote = create('p', 'phone-download-note', 'Optional: prepare files up to 25 MiB, then open your phone’s share sheet. Choose Save to Files on iPhone or a file app on Android if offered.');
            const feedback = create('p', 'phone-download-status'); feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite'); feedback.setAttribute('aria-atomic', 'true');
            const help = create('a', 'phone-download-help', 'More help saving files'); help.setAttribute('href', '/guides/phone-downloads/');
            [name, instructions, actions, label, link, sharingActions, shareNote, feedback, help].forEach(node => body.appendChild(node));
            dialog.appendChild(body); document.body.appendChild(dialog);
            ui = {name, instructions, download, copy, link, prepare, share, sharingActions, shareNote, status:feedback, closer};
            closer.addEventListener('click', close);
            dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
            dialog.addEventListener('close', () => {
                if (current && !dialog.open) { reset(); if (backdrop) backdrop.hidden = true; document.body.style.overflow = previousOverflow; if (opener && opener.isConnected) opener.focus({preventScroll:true}); opener = null; }
            });
            dialog.addEventListener('click', event => {
                if (event.target !== dialog || typeof dialog.getBoundingClientRect !== 'function') return;
                const rect = dialog.getBoundingClientRect();
                if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
            });
            dialog.addEventListener('keydown', event => {
                if (event.key === 'Escape' && typeof dialog.showModal !== 'function') { event.preventDefault(); close(); return; }
                if (event.key !== 'Tab') return;
                const fields = Array.from(dialog.querySelectorAll('button, a[href], input')).filter(node => !node.hidden && !node.disabled && node.getClientRects().length);
                const first = fields[0], last = fields[fields.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            });
            copy.addEventListener('click', async () => {
                const token = sequence; copy.disabled = true;
                const outcome = await copyLink(document, window.navigator || {}, link, () => token === sequence);
                if (token !== sequence || outcome === 'cancelled') return;
                status(outcome === 'copied' ? 'Link copied.' : 'Link selected. Touch and hold it, then choose Copy.');
                copy.disabled = false;
            });
            download.addEventListener('click', () => status('Your browser handles the download. Check its Downloads list or Files app.'));
            prepare.addEventListener('click', async () => {
                if (!current || !current.sameOrigin || prepare.disabled || prepare.hidden) return;
                const token = sequence, info = current;
                controller = new window.AbortController();
                prepare.disabled = true; share.hidden = true;
                status('Preparing the file for your share sheet…');
                try {
                    const file = await readShareFile(info, window, controller.signal);
                    if (token !== sequence) return;
                    if (!canShareFile(window, file)) throw errorWithCode('UNSUPPORTED_TYPE');
                    prepared = file; share.hidden = false; prepare.hidden = true;
                    status('Ready. Tap Save or share file, then choose a destination.');
                } catch (error) {
                    if (token !== sequence || error.name === 'AbortError' || error.code === 'ABORTED') return;
                    status(error.code === 'TOO_LARGE' ? 'Use Download file for files larger than 25 MiB.' : error.code === 'UNSUPPORTED_TYPE' ? 'Your browser cannot share this file type. Use Download file instead.' : error.code === 'INCOMPLETE' ? 'The file response was incomplete. Retry the download and check your connection.' : 'This file could not be prepared for sharing. Use Download file or copy its link.', 'error');
                } finally {
                    if (token === sequence) { prepare.disabled = false; controller = null; }
                }
            });
            share.addEventListener('click', async () => {
                if (!prepared || share.disabled) return;
                const token = sequence, file = prepared;
                if (!canShareFile(window, file)) { status('Your browser cannot share this file type. Use Download file instead.', 'error'); return; }
                share.disabled = true;
                try {
                    // Called directly in this second tap, rather than after a
                    // network await that loses Safari's transient activation.
                    await window.navigator.share({files:[file]});
                    if (token === sequence) status('Sharing finished. Check Files or your chosen app for the file.');
                } catch (error) {
                    if (token !== sequence) return;
                    status(error.name === 'AbortError' ? 'Sharing cancelled. You can try again or use Download file.' : 'Your browser could not open sharing. Use Download file or copy the link.', error.name === 'AbortError' ? 'info' : 'error');
                } finally { if (token === sequence) share.disabled = false; }
            });
        }
        function open(anchor, trigger) {
            const info = getFileInfo(anchor, baseURL());
            if (!info) return false;
            makeDialog();
            const wasOpen = dialog.open || dialog.hasAttribute('open');
            reset();
            current = info; opener = trigger || document.activeElement;
            ui.name.textContent = info.filename;
            ui.instructions.textContent = saveInstructions(window.navigator);
            ui.link.value = info.url;
            ui.download.setAttribute('href', info.href);
            ui.download.removeAttribute('target');
            if (info.sameOrigin) { ui.download.setAttribute('download', info.filename); ui.download.removeAttribute('rel'); }
            else { ui.download.removeAttribute('download'); ui.download.setAttribute('rel', 'noopener noreferrer'); }
            let sharing = false;
            if (info.sameOrigin && typeof window.File === 'function' && typeof window.AbortController === 'function' && typeof window.fetch === 'function' && window.isSecureContext !== false) {
                try { sharing = canShareFile(window, new window.File([''], info.filename, {type:mimeType(info.filename)})); } catch (_) {}
            }
            ui.prepare.hidden = !sharing; ui.sharingActions.hidden = !sharing; ui.shareNote.hidden = !sharing; ui.share.hidden = true; ui.copy.disabled = false;
            status(info.sameOrigin ? '' : 'This file is hosted on another site. Its server and your browser control the download.');
            dialog.scrollTop = 0;
            if (!wasOpen) {
                previousOverflow = document.body.style.overflow;
                document.body.style.overflow = 'hidden';
                if (typeof dialog.showModal === 'function') dialog.showModal();
                else { fallbackBackdrop().hidden = false; dialog.setAttribute('open', ''); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.classList.add('phone-download-dialog--fallback'); dialog.classList.add('is-fallback'); }
            }
            ui.closer.focus({preventScroll:true});
            return true;
        }
        function enhance(anchor) {
            const info = getFileInfo(anchor, baseURL());
            const existing = mounted.get(anchor);
            if (!info) { if (existing) { existing.remove(); mounted.delete(anchor); } return; }
            if (info.sameOrigin) {
                if (!anchor.getAttribute('download')) anchor.setAttribute('download', info.filename);
                if (anchor.getAttribute('target') === '_blank') anchor.removeAttribute('target');
            }
            let trigger = existing;
            if (!trigger) {
                trigger = button('File options', 'mobile-file-options');
                trigger.setAttribute('aria-haspopup', 'dialog');
                trigger.setAttribute('aria-controls', 'phone-download-dialog');
                trigger.addEventListener('click', () => open(anchor, trigger));
                anchor.parentNode.insertBefore(trigger, anchor.nextSibling);
                mounted.set(anchor, trigger);
            }
            const label = 'File options for ' + info.filename;
            if (trigger.getAttribute('aria-label') !== label) trigger.setAttribute('aria-label', label);
        }
        function refresh(root) {
            const scope = root || document.body;
            if (scope.nodeType !== 1 && scope !== document.body) return;
            if (scope.matches && scope.matches('a[href]')) enhance(scope);
            if (scope.querySelectorAll) scope.querySelectorAll('a[href]').forEach(enhance);
        }
        refresh();
        let observer = null;
        if (typeof window.MutationObserver === 'function') {
            observer = new window.MutationObserver(records => {
                records.forEach(record => {
                    if (record.type === 'attributes' && record.target.tagName === 'A') enhance(record.target);
                    else if (record.type === 'childList') record.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && !node.closest('.phone-download-dialog')) refresh(node);
                    });
                });
            });
            observer.observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['href','download','aria-disabled']});
        }
        const api = {refresh, open, close, getDialog: () => dialog, destroy() {
            close(); if (observer) observer.disconnect(); mounted.forEach(trigger => trigger.remove()); mounted.clear(); if (dialog) dialog.remove(); if (backdrop) backdrop.remove(); instances.delete(document);
        }};
        instances.set(document, api);
        return api;
    }

    return {MAX_SHARE_BYTES, describeDownload, getFileInfo, filename, deviceType, saveInstructions, mimeType, readShareFile, canShareFile, copyLink, install};
});
