// Tam ekran uygulama manifest'te options_ui (open_in_tab) olarak tanımlı:
// openOptionsPage() zaten açık olan sekmeyi öne getirir, yoksa yenisini açar.
const openApp = () => {
  chrome.runtime.openOptionsPage().catch((e) => console.error('[TabFlow] tam ekran açılamadı.', e));
};

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-app') openApp();
});

chrome.runtime.onInstalled.addListener(() => {
  console.info('[TabFlow] service worker hazır.');
});
