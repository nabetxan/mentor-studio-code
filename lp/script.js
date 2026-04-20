(function () {
  "use strict";

  var STORAGE_KEY = "mentor-studio-lp-lang";

  function getDefaultLang() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      var stored = null;
    }
    if (stored === "ja" || stored === "en") return stored;
    return navigator.language.startsWith("ja") ? "ja" : "en";
  }

  function setLang(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      /* private browsing */
    }
    document.documentElement.lang = lang;

    var elements = document.querySelectorAll("[data-ja][data-en]");
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var text = el.getAttribute("data-" + lang);
      if (el.tagName === "META") {
        el.setAttribute("content", text);
      } else {
        el.innerHTML = text;
      }
    }

    var options = document.querySelectorAll(".lang-option");
    for (var j = 0; j < options.length; j++) {
      if (options[j].getAttribute("data-lang") === lang) {
        options[j].classList.add("active");
      } else {
        options[j].classList.remove("active");
      }
    }
  }

  document.getElementById("lang-toggle").addEventListener("click", function () {
    var current = document.documentElement.lang;
    setLang(current === "ja" ? "en" : "ja");
  });

  setLang(getDefaultLang());
})();
