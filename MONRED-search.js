const form = document.querySelector("#simpleSearchForm");
const input = document.querySelector("#simpleSearchInput");
const clearButton = document.querySelector("#clearSearchButton");
const voiceButton = document.querySelector("#voiceSearchButton");

function submitSearch(query, type = "audio") {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) {
    input?.focus();
    return;
  }

  const params = new URLSearchParams();
  params.set("type", type === "pdf" ? "pdf" : "audio");
  params.set("q", cleanQuery);
  window.location.href = `./MONRED-results.html?${params.toString()}`;
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const query = String(data.get("q") || "").trim();
  const type = String(data.get("type") || "audio");
  submitSearch(query, type);
});

clearButton?.addEventListener("click", () => {
  if (input instanceof HTMLInputElement) {
    input.value = "";
    input.focus();
  }
});

voiceButton?.addEventListener("click", () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    input?.focus();
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.addEventListener("result", (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    if (input instanceof HTMLInputElement) {
      input.value = transcript;
      input.focus();
    }
  });
  recognition.start();
});

document.querySelectorAll("[data-query]").forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    const query = item.getAttribute("data-query") || "";
    if (input instanceof HTMLInputElement) {
      input.value = query;
    }
    submitSearch(query);
  });
});
