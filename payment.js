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
    var qrSeconds = Number(raw.qrSeconds);
    if (!Number.isFinite(qrSeconds) || qrSeconds < 1 || qrSeconds > 600) qrSeconds = 60;
    return {
      payeeName: payeeName || "Daiva Swasti",
      upiId: UPI_RE.test(upiId) ? upiId : "",
      upiIdInvalid: Boolean(upiId) && !UPI_RE.test(upiId),
      razorpayKeyId: KEY_RE.test(razorpayKeyId) ? razorpayKeyId : "",
      razorpayKeyInvalid: Boolean(razorpayKeyId) && !KEY_RE.test(razorpayKeyId),
      minAmount: minAmount,
      maxAmount: maxAmount,
      notifyEmail: String(raw.notifyEmail || "pranam@daivaswasti.org").trim(),
      qrSeconds: qrSeconds
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

  function makeToken() {
    var alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    var bytes = new Uint8Array(16);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(bytes);
    else {
      for (var i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    }
    var token = "dsw";
    for (var n = 0; n < bytes.length; n += 1) token += alphabet[bytes[n] % alphabet.length];
    return token;
  }

  function encodeSession(data) {
    var json = JSON.stringify(data);
    return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function decodeSession(raw) {
    try {
      var b64 = String(raw || "").replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      return JSON.parse(decodeURIComponent(escape(atob(b64))));
    } catch (error) {
      return null;
    }
  }

  function sessionLink(payload) {
    return root.location.origin + root.location.pathname + "?seva=" + encodeURIComponent(payload) + "#contribute";
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
    var paymentTimer = null;
    var paymentWatch = null;
    var paymentOpen = false;
    var upiArmed = false;

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
      try { root.sessionStorage.removeItem("daivaUpiReturn"); } catch (error) {}
      stopPaymentTimer();
      form.hidden = false;
      if (result) result.hidden = true;
      setReceiptMode(false);
      offering = null;
      var back = result ? result.querySelector("[data-pay-back]") : null;
      if (back) {
        back.setAttribute("data-i18n", "payBack");
        back.textContent = t("payBack");
      }
    }

    function stopPaymentTimer() {
      paymentOpen = false;
      upiArmed = false;
      if (paymentTimer) {
        clearInterval(paymentTimer);
        paymentTimer = null;
      }
      if (paymentWatch) {
        clearInterval(paymentWatch);
        paymentWatch = null;
      }
    }

    function twoDigits(value) {
      return (value < 10 ? "0" : "") + value;
    }

    function renderTimer(secondsLeft) {
      var timer = result ? result.querySelector("[data-pay-timer]") : null;
      if (!timer) return;
      timer.textContent = twoDigits(Math.floor(secondsLeft / 60)) + ":" + twoDigits(secondsLeft % 60);
      timer.classList.toggle("is-low", secondsLeft <= 15);
    }

    function clearOfferingForm() {
      ["#pay-name", "#pay-email", "#pay-phone", "#pay-note"].forEach(function (selector) {
        var field = form.querySelector(selector);
        if (field) field.value = "";
      });
      if (customInput) customInput.value = "";
      var purpose = form.querySelector('input[name="purpose"][value="ksact"]');
      if (purpose) purpose.checked = true;
      var method = form.querySelector('input[name="method"][value="upi"]');
      if (method) method.checked = true;
      selectAmount(501, false);
      syncMethod();
    }

    function expirePayment() {
      if (!paymentOpen) return;
      stopPaymentTimer();
      clearOfferingForm();
      showForm();
      setError("payExpired");
      if (form.scrollIntoView) form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function startPaymentTimer(limitSeconds) {
      stopPaymentTimer();
      var limit = Number(limitSeconds);
      if (!Number.isFinite(limit) || limit < 1) limit = config().qrSeconds;
      var endsAt = Date.now() + limit * 1000;
      paymentOpen = true;
      function tick() {
        if (!paymentOpen) return;
        var secondsLeft = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
        renderTimer(secondsLeft);
        if (secondsLeft <= 0) expirePayment();
      }
      tick();
      paymentTimer = root.setInterval(tick, 250);
    }

    function escapeHtml(value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function formatIssuedAt(iso) {
      var date = new Date(iso);
      if (Number.isNaN(date.getTime())) return "";
      try {
        return new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short"
        }).format(date);
      } catch (error) {
        return date.toLocaleString();
      }
    }

    function receiptDetails(record) {
      var current = config();
      var card = record.method === "card";
      return {
        date: formatIssuedAt(record.issuedAt),
        ref: record.reference,
        name: record.name,
        email: record.email,
        phone: record.phone,
        purpose: t(PURPOSE_KEYS[record.purpose]) || record.purpose,
        amount: formatInr(record.amount),
        method: card ? t("payMethodCard") : t("payMethodUpi"),
        vpa: card ? "" : current.upiId,
        payment: record.paymentId || "",
        note: record.note || "",
        status: format(
          t(card ? "payReceiptStatusCard" : "payReceiptStatusUpi"),
          { ref: record.reference, id: record.paymentId || "" }
        )
      };
    }

    function setReceiptMode(open) {
      var receipt = document.getElementById("pay-receipt");
      var paid = document.getElementById("pay-paid");
      if (receipt) receipt.hidden = !open;
      if (paid) paid.hidden = !open;
      if (ready) ready.hidden = open;
      if (!result) return;
      var title = result.querySelector("[data-i18n='payReceiptTitle']");
      var due = result.querySelector(".pay-amount-due");
      var purposeLine = result.querySelector(".pay-purpose-line");
      if (title) title.hidden = open;
      if (due) due.hidden = open;
      if (purposeLine) purposeLine.hidden = open;
    }

    function fillReceiptDocument() {
      var receipt = document.getElementById("pay-receipt");
      if (!receipt || !offering) return;
      var details = receiptDetails(offering);
      Object.keys(details).forEach(function (key) {
        if (key === "status") return;
        var row = receipt.querySelector('[data-receipt-row="' + key + '"]');
        var cell = receipt.querySelector("[data-receipt-" + key + "]");
        if (cell) cell.textContent = details[key];
        if (row) row.hidden = !details[key];
      });
      var status = receipt.querySelector("[data-receipt-status]");
      if (status) status.textContent = details.status;
      var whatsapp = receipt.querySelector("[data-receipt-whatsapp]");
      if (whatsapp) whatsapp.href = whatsappReceiptUrl(offering);
    }

    function receiptFileHtml(record) {
      var details = receiptDetails(record);
      var rows = [
        ["payReceiptDate", details.date],
        ["payReference", details.ref],
        ["payReceiptName", details.name],
        ["payReceiptEmail", details.email],
        ["payReceiptPhone", details.phone],
        ["payReceiptPurpose", details.purpose],
        ["payReceiptAmount", details.amount],
        ["payReceiptMethod", details.method],
        ["payUpiIdLabel", details.vpa],
        ["payReceiptPaymentId", details.payment],
        ["payReceiptNote", details.note]
      ].filter(function (row) {
        return row[1];
      }).map(function (row) {
        return "<tr><th>" + escapeHtml(t(row[0])) + "</th><td>" + escapeHtml(row[1]) + "</td></tr>";
      }).join("");
      return "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>" +
        escapeHtml(t("payReceiptHeading") + " " + record.reference) +
        "</title><style>body{font-family:Georgia,serif;color:#171717;margin:2rem auto;max-width:640px}h1{font-family:Arial,sans-serif;letter-spacing:.14em;font-size:1rem;color:#4a1740}p.bless{color:#9a3412}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:.55rem 0;border-top:1px solid #eadfce;vertical-align:top}th{width:34%;color:#57534e;font-weight:600}</style></head><body><h1>DAIVA SWASTI</h1><p class=\"bless\">Swasti No Brihaspatirdadhatu</p><h2>" +
        escapeHtml(t("payReceiptHeading")) +
        "</h2><table>" + rows + "</table><p>" + escapeHtml(details.status) + "</p></body></html>";
    }

    function receiptPlainText(record) {
      var details = receiptDetails(record);
      var lines = [
        "DAIVA SWASTI",
        "Swasti No Brihaspatirdadhatu",
        "",
        t("payPaidTitle"),
        t("payPaidWords"),
        "",
        t("payReceiptHeading"),
        "",
        t("payReceiptDate") + ": " + details.date,
        t("payReference") + ": " + details.ref,
        t("payReceiptName") + ": " + details.name,
        t("payReceiptEmail") + ": " + details.email,
        t("payReceiptPhone") + ": " + details.phone,
        t("payReceiptPurpose") + ": " + details.purpose,
        t("payReceiptAmount") + ": " + details.amount,
        t("payReceiptMethod") + ": " + details.method
      ];
      if (details.vpa) lines.push(t("payUpiIdLabel") + ": " + details.vpa);
      if (details.payment) lines.push(t("payReceiptPaymentId") + ": " + details.payment);
      if (details.note) lines.push(t("payReceiptNote") + ": " + details.note);
      lines.push("", details.status);
      return lines.join("\n");
    }

    function whatsappReceiptUrl(record) {
      var phone = String(record.phone || "").replace(/\D/g, "");
      if (phone.length === 10) phone = "91" + phone;
      return "https://wa.me/" + phone + "?text=" + encodeURIComponent(receiptPlainText(record));
    }

    function showReceipt() {
      if (!offering) return;
      if (!offering.issuedAt) offering.issuedAt = new Date().toISOString();
      fillReceiptDocument();
      setReceiptMode(true);
      var paid = document.getElementById("pay-paid");
      var target = paid && !paid.hidden ? paid : document.getElementById("pay-receipt");
      if (target && target.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function printReceipt() {
      document.body.classList.add("pay-printing");
      var cleanup = function () {
        document.body.classList.remove("pay-printing");
        root.removeEventListener("afterprint", cleanup);
      };
      root.addEventListener("afterprint", cleanup);
      root.print();
    }

    function downloadReceipt() {
      if (!offering) return;
      if (!offering.issuedAt) offering.issuedAt = new Date().toISOString();
      var blob = new Blob([receiptFileHtml(offering)], { type: "text/html;charset=utf-8" });
      var link = document.createElement("a");
      var url = URL.createObjectURL(blob);
      link.href = url;
      link.download = "Daiva-Swasti-" + offering.reference + ".html";
      document.body.appendChild(link);
      link.click();
      link.remove();
      root.setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);
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

    function showPayerMode(isPhone) {
      var desktop = result ? result.querySelector("[data-pay-desktop]") : null;
      var phone = result ? result.querySelector("[data-pay-phone]") : null;
      if (desktop) desktop.hidden = !!isPhone;
      if (phone) phone.hidden = !isPhone;
      var launch = result ? result.querySelector("[data-pay-upi-launch]") : null;
      if (launch && offering) {
        launch.href = buildUpiUrl({
          upiId: config().upiId,
          payeeName: config().payeeName,
          amount: offering.amount,
          reference: offering.reference
        });
      }
    }

    function watchPayment(topic, since) {
      if (paymentWatch) {
        clearInterval(paymentWatch);
        paymentWatch = null;
      }
      function poll() {
        if (!paymentOpen || !offering || offering.paid) return;
        fetch("https://ntfy.sh/" + encodeURIComponent(topic) + "/json?poll=1&since=" + since)
          .then(function (response) { return response.text(); })
          .then(function (text) {
            if (!offering || offering.paid) return;
            String(text || "").split("\n").forEach(function (line) {
              if (!line || !offering || offering.paid) return;
              var msg = null;
              try { msg = JSON.parse(line); } catch (error) { return; }
              if (msg && msg.event === "message" && msg.message === "paid") {
                completePayment({ sendMail: true, publish: false });
              }
            });
          })
          .catch(function () {});
      }
      poll();
      paymentWatch = root.setInterval(poll, 1000);
    }

    function armUpiReturn() {
      if (!offering || offering.paid) return;
      upiArmed = true;
      try {
        root.sessionStorage.setItem("daivaUpiReturn", JSON.stringify({
          hiddenAt: Date.now(),
          offering: {
            reference: offering.reference,
            amount: offering.amount,
            purpose: offering.purpose,
            name: offering.name,
            email: offering.email,
            phone: offering.phone,
            note: offering.note || "",
            method: "upi",
            topic: offering.topic || "",
            remotePayer: !!offering.remotePayer
          }
        }));
      } catch (error) {}
    }

    function maybeFinishReturn() {
      var raw = null;
      try { raw = root.sessionStorage.getItem("daivaUpiReturn"); } catch (error) { return; }
      if (!raw) return;
      var saved = null;
      try { saved = JSON.parse(raw); } catch (error) { return; }
      if (!saved || !saved.offering || !saved.hiddenAt) return;
      var elapsed = Date.now() - Number(saved.hiddenAt);
      if (elapsed < 1500) {
        try { root.sessionStorage.removeItem("daivaUpiReturn"); } catch (error) {}
        upiArmed = false;
        return;
      }
      if (elapsed > 120000) {
        try { root.sessionStorage.removeItem("daivaUpiReturn"); } catch (error) {}
        return;
      }
      try { root.sessionStorage.removeItem("daivaUpiReturn"); } catch (error) {}
      if (!offering || offering.reference !== saved.offering.reference) offering = saved.offering;
      if (result && result.hidden) fillReceipt(offering, offering.reference);
      completePayment({
        sendMail: !offering.remotePayer,
        publish: !!offering.remotePayer
      });
    }

    function readSeva(raw) {
      var data = decodeSession(raw);
      if (!data) return null;
      var amount = Number(data.amount);
      var exp = Number(data.exp);
      if (!data.reference || !/^DS\d{8}[A-HJ-NP-Z2-9]{4}$/.test(data.reference)) return null;
      if (!Number.isFinite(amount) || amount < 1) return null;
      if (PURPOSES.indexOf(data.purpose) < 0) return null;
      if (!EMAIL_RE.test(String(data.email || ""))) return null;
      if (!PHONE_RE.test(String(data.phone || ""))) return null;
      if (!/^dsw[a-z0-9]{16}$/.test(String(data.token || ""))) return null;
      if (!Number.isFinite(exp)) return null;
      return data;
    }

    function openPayerFromLocation() {
      var params = new URLSearchParams(root.location.search);
      var raw = params.get("seva");
      if (!raw) return false;
      var data = readSeva(raw);
      if (!data || Number(data.exp) < Date.now()) {
        setError("payExpired");
        return true;
      }
      offering = {
        reference: data.reference,
        amount: Number(data.amount),
        purpose: data.purpose,
        name: data.name,
        email: data.email,
        phone: data.phone,
        note: data.note || "",
        method: "upi",
        paymentId: "",
        topic: data.token,
        remotePayer: true
      };
      fillReceipt(offering, offering.reference);
      setReceiptMode(false);
      showPayerMode(true);
      startPaymentTimer(Math.max(1, Math.ceil((Number(data.exp) - Date.now()) / 1000)));
      setError("");
      setStatus("");
      return true;
    }

    function showUpi(value) {
      var current = config();
      if (!current.upiId) {
        setError(current.upiIdInvalid ? "payUpiInvalid" : "payUpiMissing");
        return;
      }
      var reference = makeReference();
      var token = makeToken();
      var exp = Date.now() + config().qrSeconds * 1000;
      offering = Object.assign({
        reference: reference,
        paymentId: "",
        method: "upi",
        topic: token,
        remotePayer: false
      }, value);
      var upiPayUrl = buildUpiUrl({
        upiId: current.upiId,
        payeeName: current.payeeName,
        amount: value.amount,
        reference: reference
      });
      var pageUrl = sessionLink(encodeSession({
        reference: reference,
        amount: value.amount,
        purpose: value.purpose,
        name: value.name,
        email: value.email,
        phone: value.phone,
        note: value.note || "",
        token: token,
        exp: exp
      }));
      fillReceipt(value, reference);
      setReceiptMode(false);
      showPayerMode(false);
      renderQr(pageUrl);
      if (result) {
        result.setAttribute("data-pay-link", pageUrl);
        result.setAttribute("data-pay-topic", token);
        result.querySelectorAll("[data-pay-app]").forEach(function (link) {
          var app = link.getAttribute("data-pay-app");
          link.href = appUrl(app, upiPayUrl);
        });
      }
      setError("");
      setStatus("");
      startPaymentTimer();
      watchPayment(token, Math.floor(Date.now() / 1000) - 1);
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

    function postReceiptForm(record, message) {
      var current = config();
      return new Promise(function (resolve) {
        var frame = document.getElementById("pay-mail-frame");
        var form = document.createElement("form");
        var fields = {
          name: record.name,
          email: record.email,
          phone: record.phone,
          message: message,
          purpose: t(PURPOSE_KEYS[record.purpose]) || record.purpose,
          amount_inr: String(record.amount),
          method: record.method === "card" ? t("payMethodCard") : t("payMethodUpi"),
          reference: record.reference,
          upi_id: record.method === "card" ? "" : current.upiId,
          razorpay_payment_id: record.paymentId || "",
          note: record.note || "",
          _replyto: record.email,
          _cc: record.email,
          _subject: "Your Daiva Swasti offering receipt " + record.reference,
          _template: "table",
          _captcha: "false",
          _autoresponse: message
        };
        form.method = "POST";
        form.action = "https://formsubmit.co/" + encodeURIComponent(current.notifyEmail);
        form.target = "pay-mail-frame";
        form.acceptCharset = "UTF-8";
        form.hidden = true;
        Object.keys(fields).forEach(function (key) {
          if (!fields[key]) return;
          var input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = fields[key];
          form.appendChild(input);
        });
        var finished = false;
        var finish = function () {
          if (finished) return;
          finished = true;
          frame.removeEventListener("load", finish);
          resolve();
        };
        frame.addEventListener("load", finish);
        document.body.appendChild(form);
        form.submit();
        form.remove();
        root.setTimeout(finish, 12000);
      });
    }

    function completePayment(options) {
      if (!offering || offering.paid) return;
      offering.paid = true;
      var topic = offering.topic;
      var remote = offering.remotePayer;
      stopPaymentTimer();
      var paidAmount = document.querySelector("[data-pay-paid-amount]");
      if (paidAmount) paidAmount.textContent = formatInr(offering.amount);
      var back = result ? result.querySelector("[data-pay-back]") : null;
      if (back) {
        back.setAttribute("data-i18n", "payAnother");
        back.textContent = t("payAnother");
      }
      if (result && result.hidden) fillReceipt(offering, offering.reference);
      showReceipt();
      if (!options || options.sendMail !== false) deliverReceipt();
      else setStatus("payReceiptEmailSent", { email: offering.email });
      if (remote && topic && (!options || options.publish !== false)) {
        var desktopWillMail = !options || options.sendMail !== false;
        fetch("https://ntfy.sh/" + encodeURIComponent(topic), {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: "paid"
        }).then(function (response) {
          if (!desktopWillMail && (!response || !response.ok)) deliverReceipt();
        }).catch(function () {
          if (!desktopWillMail) deliverReceipt();
        });
      }
    }

    function deliverReceipt() {
      if (!offering || offering.receiptEmailed) return;
      if (!offering.issuedAt) offering.issuedAt = new Date().toISOString();
      offering.receiptEmailed = true;
      setStatus("payReceiptSending", { email: offering.email });
      postReceiptForm(offering, receiptPlainText(offering))
        .then(function () {
          setStatus("payReceiptEmailSent", { email: offering.email });
        })
        .catch(function () {
          offering.receiptEmailed = false;
          setStatus("payReceiptEmailFail", { email: offering.email });
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
              completePayment();
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
      var target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      var methodLink = target.closest("[data-pay-method]");
      if (methodLink && !methodLink.closest("#payment-form")) {
        var method = methodLink.getAttribute("data-pay-method");
        if (method === "upi" || method === "card") {
          var methodInput = form.querySelector('input[name="method"][value="' + method + '"]');
          if (methodInput) {
            methodInput.checked = true;
            syncMethod();
          }
          showForm();
        }
      }
      var link = target.closest("[data-pay-purpose]");
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

      var printButton = result.querySelector("[data-receipt-print]");
      if (printButton) printButton.addEventListener("click", printReceipt);
      var downloadButton = result.querySelector("[data-receipt-download]");
      if (downloadButton) downloadButton.addEventListener("click", downloadReceipt);
    }

    document.addEventListener("daiva:language", function () {
      refreshLiveNote();
      if (statusState && statusEl) {
        statusEl.textContent = format(t(statusState.key), statusState.vars);
      }
      if (offering && result) {
        var purposeEl = result.querySelector("[data-pay-purpose-label]");
        if (purposeEl) purposeEl.textContent = t(PURPOSE_KEYS[offering.purpose]);
        var receipt = document.getElementById("pay-receipt");
        if (receipt && !receipt.hidden) fillReceiptDocument();
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
    if (!document.getElementById("pay-mail-frame")) {
      var frame = document.createElement("iframe");
      frame.id = "pay-mail-frame";
      frame.name = "pay-mail-frame";
      frame.hidden = true;
      frame.setAttribute("aria-hidden", "true");
      document.body.appendChild(frame);
    }
    if (result) {
      result.addEventListener("click", function (event) {
        var target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        if (target.closest("[data-pay-app], [data-pay-upi-launch]")) armUpiReturn();
      });
    }
    root.addEventListener("pageshow", function (event) {
      var nav = root.performance && root.performance.getEntriesByType && root.performance.getEntriesByType("navigation")[0];
      if (event.persisted || (nav && nav.type === "back_forward")) maybeFinishReturn();
    });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && upiArmed) maybeFinishReturn();
    });
    openPayerFromLocation();
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
