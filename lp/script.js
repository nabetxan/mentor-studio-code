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

  var TITLES = {
    ja: 'Mentor Studio Code — AIに"教えてもらう"ためのVSCode拡張',
    en: "Mentor Studio Code — A VSCode Extension to Learn From AI",
  };

  var DESCRIPTIONS = {
    ja: "コードが動くだけじゃない。理解できているか、確認しながら学ぼう。VSCode拡張として動くAIメンターツール。",
    en: "Don't just make it work. Make sure you understand it. An AI mentor tool that runs as a VSCode extension.",
  };

  function setLang(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      /* private browsing */
    }
    document.documentElement.lang = lang;
    document.title = TITLES[lang];
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", DESCRIPTIONS[lang]);

    var elements = document.querySelectorAll("[data-ja][data-en]");
    for (var i = 0; i < elements.length; i++) {
      elements[i].textContent = elements[i].getAttribute("data-" + lang);
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
