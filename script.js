document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

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
        status.textContent = "Please enter your email address.";
      }
      emailInput?.focus();
      return;
    }

    if (!message) {
      if (status) {
        status.textContent = "Please enter a message.";
      }
      messageInput?.focus();
      return;
    }

    if (status) {
      status.textContent = "Sending your message...";
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
        status.textContent =
          "Thank you. Your message was sent to pranam@daivaswasti.org.";
      }
      form.reset();
    } catch (error) {
      if (status) {
        status.textContent =
          "Sorry, the message could not be sent. Please email pranam@daivaswasti.org directly.";
      }
      console.error(error);
    } finally {
      if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = false;
      }
    }
  });
});
