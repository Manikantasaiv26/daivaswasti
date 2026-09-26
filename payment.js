(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.DaivaPayment = api;
  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", function () {
      api.mount();
    });
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  var PURPOSES = ["ksact", "annadanam", "puja", "general"];
  var PURPOSE_KEYS = {
    ksact: "payPurposeKsact",
    annadanam: "payPurposeAnnadanam",
    puja: "payPurposePuja",
    general: "payPurposeGeneral"
  };
  var UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;
  var KEY_RE = /^rzp_(test|live)_[A-Za-z0-9]+$/;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var PHONE_RE = /^[6-9]\d{9}$/;
  var APP_PREFIX = {
    gpay: "tez://upi/pay?",
    phonepe: "phonepe://pay?",
    paytm: "paytmmp://pay?",
    any: "upi://pay?"
  };

  function t(key) {
    if (typeof root.daivaT === "function") {
      var value = root.daivaT(key);
      if (value != null) return value;
    }
    var pack = root.DAIVA_I18N && root.DAIVA_I18N.strings;
    if (pack && pack.en && pack.en[key] != null) return pack.en[key];
    return "";
  }

  function format(template, vars) {
    return String(template || "").replace(/\{(\w+)\}/g, function (_, name) {
      return vars && vars[name] != null ? String(vars[name]) : "";
    });
  }

  function formatInr(amount) {
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
      }).format(amount);
    } catch (error) {
      return "₹" + amount;
    }
  }

  function readConfig(source) {
    var raw = source || {};
    var upiId = String(raw.upiId || "").trim();
    var razorpayKeyId = String(raw.razorpayKeyId || "").trim();
    var minAmount = Number(raw.minAmount);
    var maxAmount = Number(raw.maxAmount);
    if (!Number.isFinite(minAmount) || minAmount < 1) minAmount = 101;
    if (!Number.isFinite(maxAmount) || maxAmount < minAmount) maxAmount = 200000;
    var payeeName = String(raw.payeeName || "Daiva Swasti").trim().slice(0, 50);
    return {
      payeeName: payeeName || "Daiva Swasti",
      upiId: UPI_RE.test(upiId) ? upiId : "",
      upiIdInvalid: Boolean(upiId) && !UPI_RE.test(upiId),
      razorpayKeyId: KEY_RE.test(razorpayKeyId) ? razorpayKeyId : "",
      razorpayKeyInvalid: Boolean(razorpayKeyId) && !KEY_RE.test(razorpayKeyId),
      minAmount: minAmount,
      maxAmount: maxAmount,
      notifyEmail: String(raw.notifyEmail || "pranam@daivaswasti.org").trim()
    };
  }

  function buildUpiQuery(fields) {
    return Object.keys(fields)
      .map(function (key) {
        return key + "=" + encodeURIComponent(fields[key]);
      })
      .join("&");
  }

  function buildUpiUrl(options) {
    var query = buildUpiQuery({
      pa: options.upiId,
      pn: options.payeeName,
      am: Number(options.amount).toFixed(2),
      cu: "INR",
      tn: options.reference,
      tr: options.reference
    });
    return "upi://pay?" + query;
  }

  function appUrl(app, upiUrl) {
    var query = upiUrl.split("?")[1] || "";
    return (APP_PREFIX[app] || APP_PREFIX.any) + query;
  }

  function makeReference(date, random) {
    var now = date || new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, "0");
    var d = String(now.getDate()).padStart(2, "0");
    var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var suffix = "";
    var bytes = random;
    if (!bytes) {
      bytes = new Uint8Array(4);
      if (root.crypto && root.crypto.getRandomValues) {
        root.crypto.getRandomValues(bytes);
      } else {
        for (var i = 0; i < bytes.length; i += 1) {
          bytes[i] = Math.floor(Math.random() * 256);
        }
      }
    }
    for (var n = 0; n < bytes.length; n += 1) {
      suffix += alphabet[bytes[n] % alphabet.length];
    }
    return "DS" + y + m + d + suffix;
  }

  function validateOffering(input, config) {
    var purpose = PURPOSES.indexOf(input.purpose) >= 0 ? input.purpose : "";
    var method = input.method === "card" ? "card" : input.method === "upi" ? "upi" : "";
    var name = String(input.name || "").trim().replace(/\s+/g, " ");
    var email = String(input.email || "").trim();
    var phone = String(input.phone || "").replace(/\D/g, "");
    if (phone.length === 12 && phone.indexOf("91") === 0) phone = phone.slice(2);
    if (phone.length === 11 && phone.indexOf("0") === 0) phone = phone.slice(1);
    var note = String(input.note || "").trim().replace(/\s+/g, " ").slice(0, 160);
    var amount = Number(input.amount);

    if (!purpose) return { ok: false, error: "payPurposeLabel" };
    if (!Number.isInteger(amount) || amount < config.minAmount || amount > config.maxAmount) {
      return {
        ok: false,
        error: "payAmountRequired",
        vars: { min: String(config.minAmount), max: String(config.maxAmount) }
      };
    }
    if (name.length < 2 || name.length > 80) return { ok: false, error: "payNameRequired" };
    if (!EMAIL_RE.test(email)) return { ok: false, error: "payEmailRequired" };
    if (!PHONE_RE.test(phone)) return { ok: false, error: "payPhoneRequired" };
    if (!method) return { ok: false, error: "payMethodLabel" };

    return {
      ok: true,
      value: {
        purpose: purpose,
        method: method,
        name: name,
        email: email,
        phone: phone,
        note: note,
        amount: amount
      }
    };
  }

  function mount() {
    var form = document.getElementById("payment-form");
    if (!form) return;

    var config = function () {
      return readConfig(root.DAIVA_PAYMENT);
    };
    var selectedAmount = 501;
    var customMode = false;
    var busy = false;
    var statusState = null;
    var offering = null;

    var errorEl = document.getElementById("pay-error");
    var liveNote = document.getElementById("pay-setup-note");
    var result = document.getElementById("pay-result");
    var ready = result ? result.querySelector("[data-pay-ready]") : null;
    var qrBox = result ? result.querySelector("[data-pay-qr]") : null;
    var statusEl = result ? result.querySelector("[data-pay-status]") : null;
    var customWrap = form.querySelector("[data-custom-amount]");
    var customInput = document.getElementById("pay-custom-amount");
    var upiHint = form.querySelector("[data-pay-hint='upi']");
    var cardHint = form.querySelector("[data-pay-hint='card']");
    var upiSubmit = form.querySelector("[data-pay-submit='upi']");
    var cardSubmit = form.querySelector("[data-pay-submit='card']");

    function setError(key, vars) {
      if (!errorEl) return;
      errorEl.textContent = key ? format(t(key), vars) : "";
    }

    function setStatus(key, vars) {
      statusState = key ? { key: key, vars: vars || null } : null;
      if (statusEl) statusEl.textContent = key ? format(t(key), vars) : "";
    }

    function refreshLiveNote() {
      if (!liveNote) return;
      var current = config();
      var key = "";
      if (current.upiId && current.razorpayKeyId) {
        key = "";
      } else if (current.upiId) {
        key = "payLiveUpi";
      } else if (current.razorpayKeyId) {
        key = "payLiveCard";
      } else {
        key = "payLiveNone";
      }
      if (current.upiIdInvalid || current.razorpayKeyInvalid) {
        key = current.upiIdInvalid ? "payUpiInvalid" : "payKeyInvalid";
      }
      liveNote.hidden = !key;
      liveNote.textContent = key ? t(key) : "";
    }

    function syncMethod() {
      var method = form.querySelector('input[name="method"]:checked');
      var card = method && method.value === "card";
      if (upiHint) upiHint.hidden = card;
      if (cardHint) cardHint.hidden = !card;
      if (upiSubmit) upiSubmit.hidden = card;
      if (cardSubmit) cardSubmit.hidden = !card;
    }

    function selectAmount(amount, isCustom) {
      customMode = Boolean(isCustom);
      form.querySelectorAll("[data-amount]").forEach(function (button) {
        var match = isCustom
          ? button.getAttribute("data-amount") === "custom"
          : button.getAttribute("data-amount") === String(amount);
        button.classList.toggle("is-selected", match);
        button.setAttribute("aria-pressed", match ? "true" : "false");
      });
      if (customWrap) customWrap.hidden = !isCustom;
      if (!isCustom) selectedAmount = amount;
      if (isCustom && customInput) customInput.focus();
    }

    function currentAmount() {
      if (!customMode) return selectedAmount;
      return Number(String(customInput ? customInput.value : "").replace(/[^\d]/g, ""));
    }

    function collect() {
      var purposeInput = form.querySelector('input[name="purpose"]:checked');
      var methodInput = form.querySelector('input[name="method"]:checked');
      return validateOffering(
        {
          purpose: purposeInput ? purposeInput.value : "",
          method: methodInput ? methodInput.value : "",
          name: form.querySelector("#pay-name") ? form.querySelector("#pay-name").value : "",
          email: form.querySelector("#pay-email") ? form.querySelector("#pay-email").value : "",
          phone: form.querySelector("#pay-phone") ? form.querySelector("#pay-phone").value : "",
          note: form.querySelector("#pay-note") ? form.querySelector("#pay-note").value : "",
          amount: currentAmount()
        },
        config()
      );
    }

    function showForm() {
      form.hidden = false;
      if (result) result.hidden = true;
      offering = null;
    }

    function fillReceipt(value, reference) {
      if (!result) return;
      var amountEl = result.querySelector("[data-pay-amount]");
      var purposeEl = result.querySelector("[data-pay-purpose-label]");
      var vpaEl = result.querySelector("[data-pay-vpa]");
      var refEl = result.querySelector("[data-pay-ref]");
      if (amountEl) amountEl.textContent = formatInr(value.amount);
      if (purposeEl) purposeEl.textContent = t(PURPOSE_KEYS[value.purpose]);
      if (vpaEl) vpaEl.textContent = config().upiId;
      if (refEl) refEl.textContent = reference;
      result.hidden = false;
      form.hidden = true;
      result.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function renderQr(url) {
      if (!qrBox) return;
      qrBox.textContent = "";
      if (typeof root.qrcode !== "function") return;
      try {
        var qr = root.qrcode(0, "M");
        qr.addData(url);
        qr.make();
        var svg = qr.createSvgTag({
          cellSize: 4,
          margin: 2,
          scalable: true,
          alt: "UPI QR"
        });
        qrBox.innerHTML = svg;
        var image = qrBox.querySelector("svg");
        if (image) image.setAttribute("focusable", "false");
      } catch (error) {
        qrBox.textContent = "";
      }
    }

    function showUpi(value) {
      var current = config();
      if (!current.upiId) {
        setError(current.upiIdInvalid ? "payUpiInvalid" : "payUpiMissing");
        return;
      }
      var reference = makeReference();
      offering = Object.assign({ reference: reference, paymentId: "" }, value);
      var url = buildUpiUrl({
        upiId: current.upiId,
        payeeName: current.payeeName,
        amount: value.amount,
        reference: reference
      });
      fillReceipt(value, reference);
      if (ready) ready.hidden = false;
      renderQr(url);
      if (result) {
        result.querySelectorAll("[data-pay-app]").forEach(function (link) {
          var app = link.getAttribute("data-pay-app");
          link.href = appUrl(app, url);
        });
      }
      setError("");
      setStatus("");
    }

    function loadRazorpay() {
      if (root.Razorpay) return Promise.resolve();
      return new Promise(function (resolve, reject) {
        var script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = function () {
          resolve();
        };
        script.onerror = function () {
          reject(new Error("Razorpay failed to load"));
        };
        document.head.appendChild(script);
      });
    }

    function notifyTrust(payload) {
      var current = config();
      return fetch("https://formsubmit.co/ajax/" + encodeURIComponent(current.notifyEmail), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          purpose: t(PURPOSE_KEYS[payload.purpose]) || payload.purpose,
          amount_inr: payload.amount,
          method: payload.method,
          reference: payload.reference,
          razorpay_payment_id: payload.paymentId || "",
          note: payload.note || "",
          _subject: "Seva offering " + payload.reference + " — Daiva Swasti",
          _template: "table",
          _captcha: "false"
        })
      }).then(function (response) {
        if (!response.ok) throw new Error("Notify failed");
        return response;
      });
    }

    function showCard(value) {
      var current = config();
      if (!current.razorpayKeyId) {
        setError(current.razorpayKeyInvalid ? "payKeyInvalid" : "payCardMissing");
        return;
      }
      var reference = makeReference();
      offering = Object.assign({ reference: reference, paymentId: "" }, value);
      setError("");
      setStatus("");
      busy = true;
      if (cardSubmit) cardSubmit.disabled = true;
      var opening = document.getElementById("pay-error");
      if (opening) opening.textContent = t("payCardOpening");

      loadRazorpay()
        .then(function () {
          var rzp = new root.Razorpay({
            key: current.razorpayKeyId,
            amount: value.amount * 100,
            currency: "INR",
            name: current.payeeName,
            description: t(PURPOSE_KEYS[value.purpose]) || "Seva",
            prefill: {
              name: value.name,
              email: value.email,
              contact: value.phone
            },
            notes: {
              purpose: value.purpose,
              reference: reference,
              sankalpa: value.note
            },
            theme: { color: "#4a1740" },
            config: {
              display: {
                blocks: {
                  card: {
                    name: "Card",
                    instruments: [{ method: "card" }]
                  }
                },
                sequence: ["block.card"],
                preferences: { show_default_blocks: false }
              }
            },
            handler: function (response) {
              offering.paymentId = response && response.razorpay_payment_id ? response.razorpay_payment_id : "";
              fillReceipt(value, reference);
              if (ready) ready.hidden = true;
              notifyTrust(offering)
                .then(function () {
                  setStatus("payCardSuccess", {
                    ref: reference,
                    id: offering.paymentId
                  });
                })
                .catch(function () {
                  setStatus("payCardSuccessUnsent", {
                    ref: reference,
                    id: offering.paymentId
                  });
                });
            },
            modal: {
              ondismiss: function () {
                setError("payCardDismissed");
              }
            }
          });
          rzp.on("payment.failed", function () {
            setError("payCardFailed");
          });
          if (opening) opening.textContent = "";
          rzp.open();
        })
        .catch(function () {
          setError("payCardError");
        })
        .finally(function () {
          busy = false;
          if (cardSubmit) cardSubmit.disabled = false;
        });
    }

    form.querySelectorAll("[data-amount]").forEach(function (button) {
      button.addEventListener("click", function () {
        var raw = button.getAttribute("data-amount");
        if (raw === "custom") selectAmount(0, true);
        else selectAmount(Number(raw), false);
      });
    });

    form.querySelectorAll('input[name="method"]').forEach(function (input) {
      input.addEventListener("change", syncMethod);
    });

    document.addEventListener("click", function (event) {
      var link = event.target instanceof Element ? event.target.closest("[data-pay-purpose]") : null;
      if (!link || link.closest("#payment-form")) return;
      var purpose = link.getAttribute("data-pay-purpose");
      if (PURPOSES.indexOf(purpose) < 0) return;
      var input = form.querySelector('input[name="purpose"][value="' + purpose + '"]');
      if (input) input.checked = true;
      showForm();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (busy) return;
      var parsed = collect();
      if (!parsed.ok) {
        setError(parsed.error, parsed.vars);
        return;
      }
      if (parsed.value.method === "card") showCard(parsed.value);
      else showUpi(parsed.value);
    });

    if (result) {
      var back = result.querySelector("[data-pay-back]");
      if (back) back.addEventListener("click", showForm);

      result.querySelectorAll("[data-copy]").forEach(function (button) {
        button.addEventListener("click", function () {
          var which = button.getAttribute("data-copy");
          var node = result.querySelector(which === "vpa" ? "[data-pay-vpa]" : "[data-pay-ref]");
          var text = node ? node.textContent : "";
          var done = function () {
            var original = button.getAttribute("data-i18n");
            button.textContent = t("payCopied");
            root.setTimeout(function () {
              button.textContent = original ? t(original) : t("payCopy");
            }, 1400);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(done);
          } else {
            done();
          }
        });
      });

      var notify = result.querySelector("[data-pay-notify]");
      if (notify) {
        notify.addEventListener("click", function () {
          if (!offering || notify.disabled) return;
          notify.disabled = true;
          setStatus("paySending");
          notifyTrust(offering)
            .then(function () {
              setStatus("payNotified");
            })
            .catch(function () {
              setStatus("payNotifyFail");
            })
            .finally(function () {
              notify.disabled = false;
            });
        });
      }
    }

    document.addEventListener("daiva:language", function () {
      refreshLiveNote();
      if (statusState && statusEl) {
        statusEl.textContent = format(t(statusState.key), statusState.vars);
      }
      if (offering && result) {
        var purposeEl = result.querySelector("[data-pay-purpose-label]");
        if (purposeEl) purposeEl.textContent = t(PURPOSE_KEYS[offering.purpose]);
      }
    });

    var params = new URLSearchParams(root.location.search);
    var requested = params.get("offer");
    if (requested && PURPOSES.indexOf(requested) >= 0) {
      var preset = form.querySelector('input[name="purpose"][value="' + requested + '"]');
      if (preset) preset.checked = true;
    }

    if (customInput) {
      customInput.min = String(config().minAmount);
      customInput.max = String(config().maxAmount);
    }

    selectAmount(501, false);
    syncMethod();
    refreshLiveNote();
  }

  return {
    buildUpiUrl: buildUpiUrl,
    appUrl: appUrl,
    readConfig: readConfig,
    validateOffering: validateOffering,
    makeReference: makeReference,
    mount: mount
  };
});
