(function () {
  const KEY = "monred_theme";
  const root = document.documentElement;

  function applyTheme(theme) {
    root.classList.toggle("monred-dark", theme === "dark");
  }

  applyTheme(localStorage.getItem(KEY) === "dark" ? "dark" : "light");

  window.MONREDTheme = {
    key: KEY,
    set(theme) {
      const next = theme === "dark" ? "dark" : "light";
      localStorage.setItem(KEY, next);
      applyTheme(next);
      window.dispatchEvent(new CustomEvent("monred-theme-change", { detail: { theme: next } }));
    },
    get() {
      return root.classList.contains("monred-dark") ? "dark" : "light";
    },
  };
})();
