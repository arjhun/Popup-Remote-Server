const hiddenHeight = 600;
const popupHidden = { marginBottom: `-${hiddenHeight}px` };

let $popup, $content, $title;

$(function () {
  $popup = $(".popup");
  $content = $popup.find("#content");
  $title = $popup.find("#title");
});

const socket = io({
  extraHeaders: {
    clientType: "endpoint",
  },
});

socket.on("popup", (popup) => {
  if (popup) showPopup(popup);
});

socket.on("hide", function () {
  hidePopup();
});

function setContent(popup) {
  if (popup.title)
    $title.html(`<span class=" glow">${popup.title}</span> asked:`);
  else $title.html("");
  $content.text(popup.content);
}

function hidePopup() {
  $popup.animate(popupHidden, 500, () => {});
}

function showPopup(popup) {
  if (parseFloat($popup.css("marginBottom")) >= -hiddenHeight) {
    $popup.animate(popupHidden, 500, () => {
      $popup.clearQueue();
      setContent(popup);
      $popup.animate({ marginBottom: "50px" }, 1000);
    });
  } else {
    setContent(popup);
    $popup.animate({ marginBottom: "100px" }, 1000);
  }
}
