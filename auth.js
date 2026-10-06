/*
  Login and signup logic, shared by login.html and signup.html.

  Backend contract
    POST {API_BASE}{LOGIN_PATH}   body: { "email": "...", "password": "..." }
    POST {API_BASE}{SIGNUP_PATH}  body: { "name": "...", "email": "...", "password": "..." }
    Success reply (JSON): { "token": "...", "user": { "name": "...", "email": "..." } }
    Errors: any non-2xx reply; the message is read from "detail", "error" or "message".

  Set DEMO to false and API_BASE to your server's address to use your own backend.
  In demo mode no request is sent and no password is stored.
*/
(function () {
  "use strict";

  var CONFIG = {
    DEMO: true,
    API_BASE: "http://localhost:8000",
    LOGIN_PATH: "/auth/login",
    SIGNUP_PATH: "/auth/signup",
    AFTER_LOGIN: "index.html",
    LOGIN_PAGE: "login.html"
  };

  var form = document.querySelector("form[data-form]");
  if (!form) return;
  var kind = form.getAttribute("data-form");
  var banner = document.getElementById("banner");
  var submitBtn = form.querySelector(".submit");
  var submitLabel = submitBtn.textContent;

  /* ---------- Mode note ---------- */
  var modeNote = document.getElementById("modeNote");
  if (modeNote && CONFIG.DEMO) {
    modeNote.hidden = false;
    modeNote.textContent = "Demo mode: any valid details will work, and nothing is sent to a server. Set DEMO to false in auth.js to connect your backend.";
  }

  /* ---------- Notice after signup ---------- */
  if (kind === "login" && /(?:\?|&)registered=1(?:&|$)/.test(location.search)) {
    showBanner("ok", "Account created", "Log in with your new details.");
  }

  /* ---------- Helpers ---------- */
  function showBanner(type, title, message) {
    banner.className = "banner " + type;
    banner.hidden = false;
    banner.innerHTML = "";
    var s = document.createElement("strong");
    s.textContent = title;
    banner.appendChild(s);
    if (message) banner.appendChild(document.createTextNode(message));
    banner.setAttribute("role", type === "error" ? "alert" : "status");
  }
  function hideBanner() { banner.hidden = true; }

  function field(name) { return form.elements[name]; }
  function setError(name, msg) {
    var input = field(name);
    var out = document.getElementById(name + "-error");
    if (!input || !out) return;
    out.textContent = msg || "";
    if (msg) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
  }

  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validate() {
    var errors = {};
    var email = field("email").value.trim();
    var pw = field("password").value;

    if (!email) errors.email = "Enter your email address.";
    else if (!EMAIL.test(email)) errors.email = "Enter an email address like name@example.com.";

    if (!pw) errors.password = "Enter your password.";

    if (kind === "signup") {
      if (!field("name").value.trim()) errors.name = "Enter your name.";
      if (pw && pw.length < 8) errors.password = "Use at least 8 characters.";
      else if (pw && !(/[A-Za-z]/.test(pw) && /\d/.test(pw))) errors.password = "Include at least one letter and one number.";
      var confirm = field("confirm").value;
      if (!confirm) errors.confirm = "Re-enter your password.";
      else if (pw && confirm !== pw) errors.confirm = "The passwords don't match.";
    }
    return errors;
  }

  var ORDER = kind === "signup" ? ["name", "email", "password", "confirm"] : ["email", "password"];

  function applyErrors(errors) {
    var first = null;
    ORDER.forEach(function (n) {
      setError(n, errors[n] || "");
      if (errors[n] && !first) first = n;
    });
    if (first) field(first).focus();
    return !first;
  }

  /* Clear a field's message as soon as the person edits it */
  ORDER.forEach(function (n) {
    field(n).addEventListener("input", function () { setError(n, ""); hideBanner(); });
  });

  /* ---------- Show / hide password ---------- */
  Array.prototype.forEach.call(form.querySelectorAll(".toggle-pw"), function (btn) {
    btn.addEventListener("click", function () {
      var input = document.getElementById(btn.getAttribute("data-target"));
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "Hide" : "Show";
      btn.setAttribute("aria-pressed", show ? "true" : "false");
    });
  });

  /* ---------- Storage ---------- */
  function saveSession(data, fallbackEmail, fallbackName) {
    try {
      localStorage.setItem("sqlllm.token", data.token || "");
      var user = data.user || { name: fallbackName || fallbackEmail.split("@")[0], email: fallbackEmail };
      localStorage.setItem("sqlllm.user", JSON.stringify(user));
    } catch (e) { /* storage can be blocked; the person can still continue */ }
  }

  /* ---------- Requests ---------- */
  function send(path, body) {
    if (CONFIG.DEMO) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve({ token: "demo-token", user: { name: body.name || body.email.split("@")[0], email: body.email } });
        }, 600);
      });
    }
    var url = CONFIG.API_BASE.replace(/\/+$/, "") + path;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
        if (!res.ok) {
          var msg = data && (data.detail || data.error || data.message);
          if (msg && typeof msg !== "string") msg = JSON.stringify(msg);
          var err = new Error(msg || (res.status === 401 ? "Email or password is incorrect." : res.status + " " + res.statusText));
          err.status = res.status;
          throw err;
        }
        return data || {};
      });
    }, function () {
      var err = new Error("Could not reach " + url + ".");
      err.network = true;
      throw err;
    });
  }

  function setBusy(busy) {
    submitBtn.disabled = busy;
    submitBtn.textContent = busy ? (kind === "signup" ? "Creating account…" : "Logging in…") : submitLabel;
  }

  /* ---------- Submit ---------- */
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    hideBanner();
    if (!applyErrors(validate())) return;

    var email = field("email").value.trim();
    var pw = field("password").value;
    var name = kind === "signup" ? field("name").value.trim() : "";
    var body = kind === "signup" ? { name: name, email: email, password: pw } : { email: email, password: pw };

    setBusy(true);
    send(kind === "signup" ? CONFIG.SIGNUP_PATH : CONFIG.LOGIN_PATH, body).then(function (data) {
      if (kind === "signup" && !data.token) {
        location.href = CONFIG.LOGIN_PAGE + "?registered=1";
        return;
      }
      if (!data.token) throw new Error("The server accepted the request but didn't return a token.");
      saveSession(data, email, name);
      location.href = CONFIG.AFTER_LOGIN;
    }).catch(function (err) {
      setBusy(false);
      if (err.network) {
        showBanner("error", "Can't reach the server", err.message + " Check that it's running and allows requests from this page (CORS).");
      } else if (kind === "signup" && err.status === 409) {
        showBanner("error", "That email is already registered", "Log in instead, or use a different email.");
      } else {
        showBanner("error", kind === "signup" ? "Couldn't create your account" : "Couldn't log you in", err.message);
      }
    });
  });
})();
