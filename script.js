document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  const form = document.getElementById("contact-form");
  const status = document.getElementById("form-status");

  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = form.querySelector("#email");
    if (!(email instanceof HTMLInputElement) || !email.value.trim()) {
      if (status) {
        status.textContent = "Please enter your email address.";
      }
      email?.focus();
      return;
    }

    if (status) {
      status.textContent =
        "Thank you. Your message has been received. We will connect with you soon.";
    }

    form.reset();
  });
});
