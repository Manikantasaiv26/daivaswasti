document.addEventListener("DOMContentLoaded", () => {
  const i18n = window.DAIVA_I18N;
  if (!i18n?.strings?.en) {
    console.error("Language pack failed to load (i18n.js).");
    return;
  }

  const supported = new Set(
    (i18n.languages || []).map((language) => language.code)
  );
  const STORAGE_KEY = "daiva-swasti-lang";

  let currentLang = "en";

  function getStrings(lang) {
    return i18n.strings[lang] || i18n.strings.en || {};
  }

  function t(key, lang = currentLang) {
    const strings = getStrings(lang);
    return strings[key] ?? i18n.strings.en[key] ?? null;
  }

  function applyLanguage(lang) {
    if (!supported.has(lang)) {
      lang = "en";
    }

    currentLang = lang;
    document.documentElement.lang = lang;
    document.body.dataset.lang = lang;
    localStorage.setItem(STORAGE_KEY, lang);

    const year = String(new Date().getFullYear());

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const value = t(key);
      if (value == null) return;

      if (el.tagName === "META" && el.getAttribute("name") === "description") {
        el.setAttribute("content", value);
        return;
      }

      el.textContent = value;
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (!key) return;
      const value = t(key);
      if (value == null) return;
      el.setAttribute("placeholder", value);
    });

    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (!key) return;
      const value = t(key);
      if (value == null) return;
      el.setAttribute("aria-label", value);
    });

    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      if (!key) return;
      let html = t(key);
      if (html == null) return;
      if (key === "footerCopy") {
        html = html.replace("{year}", year);
      }
      el.innerHTML = html;
    });

    const label = i18n.languages.find((item) => item.code === lang)?.label;
    const labelEl = document.querySelector("[data-lang-label]");
    if (labelEl && label) {
      labelEl.textContent = label;
    }

    document.querySelectorAll("[data-lang-menu] [data-lang]").forEach((option) => {
      const code = option.getAttribute("data-lang");
      const selected = code === lang;
      option.setAttribute("aria-selected", selected ? "true" : "false");
      option.classList.toggle("is-active", selected);
      const optionLabel = i18n.languages.find((item) => item.code === code)?.label;
      if (optionLabel) {
        option.textContent = optionLabel;
      }
    });

    const status = document.getElementById("form-status");
    if (status) {
      status.textContent = "";
    }
  }

  const dropdownClosers = [];

  function closeAllDropdowns(exceptRoot = null) {
    dropdownClosers.forEach((close) => close(exceptRoot));
  }

  function setupDropdown({
    root,
    button,
    menu,
    onItemClick,
  }) {
    if (!root || !button || !menu) return { close: () => {} };

    const closeMenu = (exceptRoot = null) => {
      if (exceptRoot && exceptRoot === root) return;
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
      root.classList.remove("is-open");
    };

    const openMenu = () => {
      closeAllDropdowns(root);
      menu.hidden = false;
      button.setAttribute("aria-expanded", "true");
      root.classList.add("is-open");
    };

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (menu.hidden) {
        openMenu();
      } else {
        closeMenu();
      }
    });

    menu.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (onItemClick) {
        onItemClick(event, target, closeMenu);
      } else if (target.closest("a")) {
        closeMenu();
      }
    });

    document.addEventListener("click", (event) => {
      if (!root.contains(event.target)) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    });

    dropdownClosers.push(closeMenu);
    return { close: closeMenu, open: openMenu, root, button, menu };
  }

  function setupLanguageSwitcher() {
    setupDropdown({
      root: document.querySelector("[data-lang-switcher]"),
      button: document.querySelector("[data-lang-button]"),
      menu: document.querySelector("[data-lang-menu]"),
      onItemClick: (event, target, closeMenu) => {
        const option = target.closest("[data-lang]");
        if (!option) return;
        event.stopPropagation();
        const lang = option.getAttribute("data-lang");
        if (lang) {
          applyLanguage(lang);
        }
        closeMenu();
      },
    });

    document.querySelectorAll("[data-lang-menu] [data-lang]").forEach((option) => {
      option.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          option.click();
        }
      });
    });
  }

  function setupNavDropdowns() {
    document.querySelectorAll("[data-nav-dropdown]").forEach((root) => {
      setupDropdown({
        root,
        button: root.querySelector("[data-nav-button]"),
        menu: root.querySelector("[data-nav-menu]"),
      });
    });
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  const initial =
    saved && supported.has(saved)
      ? saved
      : supported.has(navigator.language?.slice(0, 2))
        ? navigator.language.slice(0, 2)
        : "en";

  setupLanguageSwitcher();
  setupNavDropdowns();
  applyLanguage(initial);

  const form = document.getElementById("contact-form");
  const status = document.getElementById("form-status");
  const submitBtn = form?.querySelector(".send-btn");

  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nameInput = form.querySelector("#name");
    const emailInput = form.querySelector("#email");
    const messageInput = form.querySelector("#message");
    const newsletterInput = form.querySelector('input[name="newsletter"]');

    const name =
      nameInput instanceof HTMLInputElement ? nameInput.value.trim() : "";
    const email =
      emailInput instanceof HTMLInputElement ? emailInput.value.trim() : "";
    const message =
      messageInput instanceof HTMLTextAreaElement
        ? messageInput.value.trim()
        : "";
    const newsletter =
      newsletterInput instanceof HTMLInputElement && newsletterInput.checked
        ? "yes"
        : "no";

    if (!email) {
      if (status) {
        status.textContent = t("formEmailRequired");
      }
      emailInput?.focus();
      return;
    }

    if (!message) {
      if (status) {
        status.textContent = t("formMessageRequired");
      }
      messageInput?.focus();
      return;
    }

    if (status) {
      status.textContent = t("formSending");
    }
    if (submitBtn instanceof HTMLButtonElement) {
      submitBtn.disabled = true;
    }

    try {
      const response = await fetch(
        "https://formsubmit.co/ajax/pranam@daivaswasti.org",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            name: name || "Website visitor",
            email,
            message,
            newsletter,
            _subject: "New message from Daiva Swasti website",
            _template: "table",
            _captcha: "false",
          }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Unable to send message.");
      }

      if (status) {
        status.textContent = t("formSuccess");
      }
      form.reset();
    } catch (error) {
      if (status) {
        status.textContent = t("formError");
      }
      console.error(error);
    } finally {
      if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = false;
      }
    }
  });
});
