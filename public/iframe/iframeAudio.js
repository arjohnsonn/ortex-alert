const audioFile = new Audio(chrome.runtime.getURL("sounds/alert.mp3"));

window.addEventListener("message", (event) => {
  if (event.data.message === "play") {
    audioFile.play();
  }
});
