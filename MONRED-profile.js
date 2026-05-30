const toggle = document.querySelector("#profileThemeToggle");

function setTheme(theme) {
  const dark = theme === "dark";
  window.MONREDTheme?.set(dark ? "dark" : "light");
  if (toggle) {
    toggle.checked = dark;
  }
}

setTheme(window.MONREDTheme?.get() === "dark" ? "dark" : "light");

toggle?.addEventListener("change", () => {
  setTheme(toggle.checked ? "dark" : "light");
});
