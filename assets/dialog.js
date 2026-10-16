/* Native dialog keeps keyboard focus and screen readers inside the open sheet. */
const ChantDialog = (() => {
  const dialog = document.getElementById("overlay");
  const sheet = dialog.querySelector(".modal");

  dialog.addEventListener("close", () => {
    // A close event can arrive after another dialog was opened in the same tick.
    if (dialog.open) return;
    document.documentElement.classList.remove("dialog-open");
    if (typeof stopAudio === "function") stopAudio();
  });

  return {
    open() {
      if (!dialog.open) dialog.showModal();
      document.documentElement.classList.add("dialog-open");
      sheet.scrollTop = 0;
      dialog.querySelector(".close-btn").focus({ preventScroll: true });
    },
    close() {
      if (!dialog.open) return;
      dialog.close();
      document.documentElement.classList.remove("dialog-open");
    }
  };
})();
