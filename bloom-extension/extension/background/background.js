chrome.runtime.onInstalled.addListener(() => {
  console.log("BLOOM extension installed");
});

// Keep service worker alive
const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20e3);
chrome.runtime.onStartup.addListener(keepAlive);
keepAlive();
