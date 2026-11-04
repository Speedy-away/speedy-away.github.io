const fs = require('node:fs');
const path = require('node:path');
const {page,section,note,steps} = require('./build-console-guides.cjs');
const root = path.resolve(__dirname,'..');
const checkFile = '/assets/files/phone-download-check.txt';
const content = section('start','Start with the file',
    '<p>Tap the file’s <strong>Download</strong> button. On a phone, <strong>File options</strong> also provides a copyable link and saving instructions.</p>' +
    '<p>Where your browser supports it, prepare a file and then tap <strong>Save or share file</strong> to choose an app or folder. If that option is unavailable for a file, the normal download link remains available.</p>' +
    '<div class="guide-links"><a class="btn btn-primary" href="/downloads/">Browse the download library</a><a class="btn btn-outline" href="/pages/help.html">Help &amp; FAQ</a></div>') +
    section('check','Check saving on your phone',
        '<p>Try this small text file, then find <strong>phone-download-check.txt</strong> in Files or Downloads. You can open it to confirm the file finished saving.</p>' +
        '<div class="guide-links"><a class="btn btn-primary" href="' + checkFile + '" download="phone-download-check.txt">Download test file</a></div>' +
        '<p>For the optional share route, tap <strong>File options</strong>, prepare the file, then tap <strong>Save or share file</strong>. On iPhone, choose <strong>Save to Files</strong>, select a folder and tap <strong>Save</strong>. On Android, choose a file app if one is offered, or use the normal download.</p>' +
        '<p>Opening the share sheet does not save the file by itself. Finish the save in the app or browser, then check that the file is there.</p>') +
    section('iphone','iPhone & iPad',steps([
        ['Download in your browser','Tap Download and confirm the browser’s download prompt if it appears. Wait for it to finish.'],
        ['Find the file','Open Files, tap Browse, then open Downloads. Depending on your settings, it may be under iCloud Drive or On My iPhone / On My iPad. Safari’s Downloads button also opens the download list.'],
        ['Save an open preview','If your browser shows a supported file preview, open Share and choose Save to Files, choose a folder, then tap Save.'],
        ['Choose a download folder','On iPhone, open Settings → Apps → Safari → Downloads to choose a location.']
    ]) + '<p><a href="https://support.apple.com/en-gb/102440" target="_blank" rel="noopener noreferrer">Apple: find downloads in Files</a> · <a href="https://support.apple.com/guide/iphone/customize-your-safari-settings-iphb3100d149/ios" target="_blank" rel="noopener noreferrer">Apple: Safari download settings</a> · <a href="https://support.apple.com/en-gb/guide/iphone/ipha9ed5131c/ios" target="_blank" rel="noopener noreferrer">Apple: saving a PDF preview to Files</a></p>') +
    section('android','Android phones & tablets',steps([
        ['Download the file','Tap Download. Your browser may ask where to save it or ask you to confirm the download.'],
        ['Find the download','Open the phone’s Files or file manager app and look in Downloads. In Chrome, the browser menu also contains Downloads.'],
        ['Use the link menu','You can touch and hold a direct file link and choose Download link.'],
        ['Move or share it','Use the file manager or Chrome’s Downloads list to share the completed file or move it to another folder.']
    ]) + '<p><a href="https://support.google.com/chrome/answer/95759?co=GENIE.Platform%3DAndroid&amp;hl=en" target="_blank" rel="noopener noreferrer">Google: downloading and finding files in Chrome for Android</a></p>') +
    section('troubleshooting','If a file does not save',steps([
        ['Try your full browser','If a link opens inside a social or messaging app and cannot download, copy the file link and open it in Safari, Chrome or your usual browser.'],
        ['Use the original download','File options keeps the normal download link available. For large files, use that link and let the browser manage the download.'],
        ['Check the provider page','External hosts may require their own download button or sign-in. A source or project page is not the file itself.'],
        ['Check what was saved','If the saved item is a sign-in page or an HTML error page, return to the provider and use its actual file download. Renaming a webpage to .zip or .bin does not turn it into the intended file.'],
        ['Check space and connection','Make sure the phone has enough free space, then retry a failed download from the browser’s Downloads list.']
    ]) + note('<strong>Keep the original filename.</strong> Saving a PC or console file to your phone stores it for transfer. Use it on the device and game version listed with that download.'));
page('guides/phone-downloads/index.html','Save downloads on iPhone & Android',
    'Save downloaded files to Files on iPhone and iPad or Downloads on Android. Find browser downloads, use file sharing, copy links and troubleshoot file saving.',
    '/assets/images/logo.png', [['#start','Start'],['#check','Test saving'],['#iphone','iPhone & iPad'],['#android','Android'],['#troubleshooting','Help']], content,'#start','Saving a file');
const sitemapPath=path.join(root,'sitemap.xml');
let sitemap=fs.readFileSync(sitemapPath,'utf8');
const canonical='https://whatwhatboy.com/guides/phone-downloads/';
if(!sitemap.includes('<loc>'+canonical+'</loc>')) {
    sitemap=sitemap.replace('</urlset>','  <url><loc>'+canonical+'</loc><lastmod>2026-11-02</lastmod></url>\n</urlset>');
    fs.writeFileSync(sitemapPath,sitemap);
}
console.log('Built phone download guide.');
