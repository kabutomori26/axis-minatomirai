// 内覧予約フォームのバリデーション（お名前・メール入力チェックと送信ボタンの活性制御）
(function () {
  "use strict";

  /* ----------------------------------------------------------
    リロード時のスクロール位置ズレを防ぐ
    ブラウザ既定（auto）の位置復元は、画像・フォントの後読みで
    レイアウトが確定する前に走るため、リロードごとに表示位置が
    ずれる（MVの下に白い余白が出る）。手動制御に切り替える。
    ---------------------------------------------------------- */
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  window.addEventListener("load", function () {
    var fontsReady =
      document.fonts && document.fonts.ready
        ? document.fonts.ready
        : Promise.resolve();

    fontsReady.then(function () {
      // ハッシュがあればその位置へ、無ければ最上部へ合わせ直す
      if (location.hash) {
        var target = document.querySelector(location.hash);
        if (target) target.scrollIntoView({ behavior: "auto", block: "start" });
      } else {
        window.scrollTo(0, 0);
      }
    });
  });

  /* ----------------------------------------------------------
    モバイル用ハンバーガーメニューの開閉
    ---------------------------------------------------------- */
  const header = document.querySelector(".header");
  const toggle = document.querySelector("[data-menu-toggle]");
  const overlay = document.querySelector("[data-menu-overlay]");

  if (header && toggle) {
    const closeMenu = function () {
      header.classList.remove("is-open");
      document.body.classList.remove("is-menu-open");
      toggle.setAttribute("aria-expanded", "false");
    };

    const openMenu = function () {
      header.classList.add("is-open");
      document.body.classList.add("is-menu-open");
      toggle.setAttribute("aria-expanded", "true");
    };

    toggle.addEventListener("click", function () {
      if (header.classList.contains("is-open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // 背景オーバーレイ（メニュー外）をタップしたら閉じる
    if (overlay) overlay.addEventListener("click", closeMenu);

    // メニュー内のリンクを押したら閉じる
    header.querySelectorAll(".header__link, .header__nav-cta").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });

    // Esc キーで閉じる
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ----------------------------------------------------------
    MVスライドショー
    ---------------------------------------------------------- */
  const heroSlides = document.querySelector("[data-hero-slides]");

  if (heroSlides) {
    const slides = Array.prototype.slice.call(
      heroSlides.querySelectorAll(".hero__slide")
    );

    if (slides.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      let current = 0;

      setInterval(function () {
        slides[current].classList.remove("is-active");
        current = (current + 1) % slides.length;
        slides[current].classList.add("is-active");
      }, 8000);
    }
  }

  /* ----------------------------------------------------------
    現在地ハイライト（スクロールスパイ）
    表示中のセクションに対応するナビ項目へ .is-current を付与
    ---------------------------------------------------------- */
  const navLinks = Array.prototype.slice.call(
    document.querySelectorAll(".header__link")
  );

  if (navLinks.length && "IntersectionObserver" in window) {
    const headerH =
      parseInt(
        getComputedStyle(document.documentElement).getPropertyValue("--header-h"),
        10
      ) || 72;

    const linksByHash = {};
    const targets = [];

    navLinks.forEach(function (link) {
      const hash = link.getAttribute("href");
      if (hash && hash.charAt(0) === "#" && hash.length > 1) {
        const el = document.getElementById(hash.slice(1));
        if (el) {
          (linksByHash[hash] = linksByHash[hash] || []).push(link);
          if (targets.indexOf(el) === -1) targets.push(el);
        }
      }
    });

    const setCurrent = function (hash) {
      navLinks.forEach(function (l) {
        l.classList.remove("is-current");
      });
      (linksByHash[hash] || []).forEach(function (l) {
        l.classList.add("is-current");
      });
    };

    // 現在検知領域に入っているセクションを保持
    const visible = new Set();

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        });

        // 検知領域に何も無い（MV付近など）→ ハイライト解除
        if (visible.size === 0) {
          navLinks.forEach(function (l) {
            l.classList.remove("is-current");
          });
          return;
        }

        // 検知領域内で最も上にあるセクションを現在地にする
        let topMost = null;
        visible.forEach(function (el) {
          if (
            !topMost ||
            el.getBoundingClientRect().top < topMost.getBoundingClientRect().top
          ) {
            topMost = el;
          }
        });
        setCurrent("#" + topMost.id);
      },
      // ヘッダー直下を検知ライン、画面上部30%だけを判定領域にする
      { rootMargin: "-" + headerH + "px 0px -70% 0px", threshold: 0 }
    );

    targets.forEach(function (t) {
      observer.observe(t);
    });
  }

  /* ----------------------------------------------------------
    追従CTAの表示制御
    Contactセクションが画面に入ったら、追従CTAを非表示にする
    ---------------------------------------------------------- */
  const fixedCta = document.querySelector("[data-fixed-cta]");
  const contactSection = document.getElementById("contact");

  if (fixedCta && contactSection && "IntersectionObserver" in window) {
    const contactObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          fixedCta.classList.toggle("is-hidden", entry.isIntersecting);
        });
      },
      { threshold: 0 }
    );

    contactObserver.observe(contactSection);
  }

  /* ----------------------------------------------------------
    内覧予約フォームのバリデーション
    ---------------------------------------------------------- */
  const form = document.querySelector("[data-contact-form]");
  if (!form) return;

  const nameInput = form.querySelector("#name");
  const emailInput = form.querySelector("#email");
  const submitBtn = form.querySelector(".contact__submit");
  const success = document.querySelector("[data-contact-success]");

  // 一般的なメールアドレス形式の簡易判定
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // 各フィールドの検証結果（エラーメッセージ。空文字なら正常）
  function validateName() {
    return nameInput.value.trim() === "" ? "お名前を入力してください。" : "";
  }

  function validateEmail() {
    const value = emailInput.value.trim();
    if (value === "") return "メールアドレスを入力してください。";
    if (!emailPattern.test(value)) return "メールアドレスの形式が正しくありません。";
    return "";
  }

  // 一度でも触れた（blur／送信した）フィールドだけエラー文を表示する
  const touched = { name: false, email: false };

  function applyFieldState(input, message, show) {
    const field = input.closest(".field");
    const errorEl = field.querySelector(".field__error");
    const isError = message !== "" && show;
    field.classList.toggle("is-error", isError);
    input.setAttribute("aria-invalid", isError ? "true" : "false");
    // 表示しない時も領域は確保済みのため、文言だけ出し入れする
    errorEl.textContent = show ? message : "";
  }

  // 全体の状態を更新し、ボタンの活性／非活性を切り替える
  function refresh() {
    const nameError = validateName();
    const emailError = validateEmail();

    applyFieldState(nameInput, nameError, touched.name);
    applyFieldState(emailInput, emailError, touched.email);

    submitBtn.disabled = !(nameError === "" && emailError === "");
  }

  nameInput.addEventListener("input", refresh);
  emailInput.addEventListener("input", refresh);
  nameInput.addEventListener("blur", function () {
    touched.name = true;
    refresh();
  });
  emailInput.addEventListener("blur", function () {
    touched.email = true;
    refresh();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    touched.name = true;
    touched.email = true;
    refresh();
    // ボタンは無効時押せないが、念のため最終チェック
    if (validateName() === "" && validateEmail() === "" && success) {
      form.hidden = true;
      success.hidden = false;
    }
  });

  // 初期表示：ボタンを非活性に
  refresh();
})();
