// clara-global.js
// Shared JavaScript for the Clara app, safe to load on every page.

window.Clara = window.Clara || {};

(function () {
  const Clara = window.Clara;

  /**
   * Utility: make sure Supabase is available before we use it.
   */
  function getSupabaseOrWarn(context) {
    if (!window.supabase) {
      console.error(`[Clara] Supabase not found in ${context}.`);
      return null;
    }
    return window.supabase;
  }

  // ----------------------------------------
  // 1. LOGIN / HOME PAGE
  // ----------------------------------------
  Clara.initLoginPage = function () {
    const form = document.getElementById("login-form");
    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");
    const errorBox = document.getElementById("login-error");

    // If we're not on the login page, do nothing.
    if (!form || !emailInput || !passwordInput) return;

    const supabase = getSupabaseOrWarn("Login page");
    if (!supabase) return;

    // If already logged in, send straight to dashboard
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data && data.user) {
          window.location.href = "/dashboard";
        }
      } catch (err) {
        console.error("[Clara] Error checking logged-in user on login page:", err);
      }
    })();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (errorBox) errorBox.textContent = "";

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        if (errorBox) errorBox.textContent = "Please enter both email and password.";
        return;
      }

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error("Login error:", error);
          if (errorBox) errorBox.textContent = error.message;
          return;
        }

        // Success: redirect to dashboard
        window.location.href = "/dashboard";
      } catch (err) {
        console.error("[Clara] Unexpected login error:", err);
        if (errorBox) {
          errorBox.textContent =
            "Something went wrong logging you in. Please try again.";
        }
      }
    });
  };

  // ----------------------------------------
  // 2. ARTICLE ITEM PAGE TEMPLATE
  // ----------------------------------------
  Clara.initArticlePage = function () {
    // Grab elements
    const titleEl = document.getElementById("article-title");
    const metaEl = document.getElementById("article-meta");
    const categoryEl = document.getElementById("article-category");
    const excerptEl = document.getElementById("article-excerpt");
    const contentEl = document.getElementById("article-content");
    const importantBadgeEl = document.getElementById("article-important-badge");
    const errorEl = document.getElementById("article-error");

    const pinMeBtn = document.getElementById("article-pin-me-btn");
    const pinAllBtn = document.getElementById("article-pin-all-btn"); // Admin only

    // Flag modal elements
    const flagBtn = document.getElementById("article-flag-btn");
    const flagModal = document.getElementById("flag-modal");
    const flagReasonInput = document.getElementById("flag-reason-input");
    const flagSubmitBtn = document.getElementById("flag-submit-btn");
    const flagCancelBtn = document.getElementById("flag-cancel-btn");
    const modalArticleTitleEl = document.getElementById(
      "flag-modal-article-title"
    );

    // Sentinel: if none of the key article elements exist, we're not on this page.
    if (!titleEl && !contentEl && !errorEl) return;

    const supabase = getSupabaseOrWarn("Article page");
    if (!supabase) return;

    function showError(message) {
      if (!errorEl) {
        console.error(message);
        alert(message);
        return;
      }
      errorEl.textContent = message;
      errorEl.style.display = "block";
    }

    // Main async flow for the article page
    (async () => {
      // -----------------------------
      // Get article ID from URL
      // -----------------------------
      const params = new URLSearchParams(window.location.search);
      const articleId = params.get("id");

      if (!articleId) {
        showError("No article ID was provided.");
        return;
      }

      // -----------------------------
      // Get logged-in user
      // -----------------------------
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData || !authData.user) {
        console.error("Not logged in:", authError);
        window.location.href = "/login";
        return;
      }

      const userId = authData.user.id;

      // -----------------------------
      // Get user's profile to check admin role
      // -----------------------------
      let isAdmin = false;

      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single();

        if (profileError) {
          console.error("Profile error:", profileError);
        }

        if (profile && profile.role === "admin") {
          isAdmin = true;
        }
      } catch (err) {
        console.error("[Clara] Error loading profile on article page:", err);
      }

      // Hide the admin-only Important button if not admin
      if (!isAdmin && pinAllBtn) {
        pinAllBtn.style.display = "none";
      }

      // -----------------------------
      // Load the article
      // -----------------------------
      const { data: article, error: articleError } = await supabase
        .from("articles")
        .select("*")
        .eq("id", articleId)
        .single();

      if (articleError || !article) {
        console.error(articleError);
        showError("Could not load this article.");
        return;
      }

      // -----------------------------
      // Render article content
      // -----------------------------
      if (titleEl) titleEl.textContent = article.title || "Untitled article";
      if (modalArticleTitleEl) {
        modalArticleTitleEl.textContent = article.title || "Untitled article";
      }

      if (categoryEl) {
        categoryEl.textContent = article.category || "Uncategorised";
      }
      if (excerptEl) excerptEl.textContent = article.excerpt || "";
      if (contentEl) contentEl.innerHTML = article.content || "";

      // Meta line
      if (metaEl) {
        const parts = [];

        if (article.author) parts.push(`By ${article.author}`);

        const created = article.created_at ? new Date(article.created_at) : null;
        const updated = article.updated_at ? new Date(article.updated_at) : null;

        if (created) {
          parts.push(
            `Published ${created.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}`
          );
        }

        if (updated && (!created || updated.getTime() !== created.getTime())) {
          parts.push(
            `Updated ${updated.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}`
          );
        }

        metaEl.textContent = parts.join(" • ");
      }

      // -----------------------------
      // B. Admin Important / Pin for all
      // -----------------------------
      let isImportant =
        article.is_pinned_by_admin ?? article.isPinnedByAdmin ?? false;

      function updateImportantUI() {
        // Badge visibility
        if (importantBadgeEl) {
          importantBadgeEl.style.display = isImportant ? "inline-flex" : "none";
        }

        // Button label + aria
        if (pinAllBtn && isAdmin) {
          pinAllBtn.textContent = isImportant
            ? "Remove from important"
            : "Mark as important";
          pinAllBtn.setAttribute(
            "aria-pressed",
            isImportant ? "true" : "false"
          );
        }
      }

      updateImportantUI();

      async function toggleAdminImportant() {
        if (!pinAllBtn || !isAdmin) return;

        pinAllBtn.disabled = true;

        try {
          const nextValue = !isImportant;

          const { data: updatedArticle, error: updateError } = await supabase
            .from("articles")
            .update({ is_pinned_by_admin: nextValue })
            .eq("id", articleId)
            .select("is_pinned_by_admin")
            .single();

          if (updateError) {
            console.error("Error updating important flag:", updateError);
            showError(
              "Could not update important status. Please try again or contact an administrator."
            );
          } else if (updatedArticle) {
            isImportant = !!updatedArticle.is_pinned_by_admin;
            updateImportantUI();
          }
        } catch (err) {
          console.error("Unexpected important toggle error:", err);
          showError("Something went wrong updating the important status.");
        } finally {
          pinAllBtn.disabled = false;
        }
      }

      if (pinAllBtn && isAdmin) {
        pinAllBtn.addEventListener("click", toggleAdminImportant);
      }

      // -----------------------------
      // A. PIN FOR ME (USER)
      // -----------------------------
      let isPinnedByUser = false;

      function updatePinMeButtonUI() {
        if (!pinMeBtn) return;
        pinMeBtn.textContent = isPinnedByUser
          ? "Unpin this article"
          : "Pin this article";
        pinMeBtn.setAttribute(
          "aria-pressed",
          isPinnedByUser ? "true" : "false"
        );
      }

      async function loadUserPinState() {
        if (!pinMeBtn) return;

        const { data: pins, error: pinError } = await supabase
          .from("user_pins")
          .select("user_id")
          .eq("user_id", userId)
          .eq("article_id", articleId);

        if (pinError) {
          console.error("Error checking pin state:", pinError);
          isPinnedByUser = false;
        } else {
          isPinnedByUser = !!(pins && pins.length > 0);
        }

        updatePinMeButtonUI();
      }

      async function toggleUserPin() {
        if (!pinMeBtn) return;

        pinMeBtn.disabled = true;

        try {
          if (isPinnedByUser) {
            // Unpin: delete the row
            const { error: delError } = await supabase
              .from("user_pins")
              .delete()
              .eq("user_id", userId)
              .eq("article_id", articleId);

            if (delError) {
              console.error("Error unpinning article:", delError);
              showError("Could not unpin this article. Please try again.");
            } else {
              isPinnedByUser = false;
            }
          } else {
            // Pin: insert new row
            const { error: insError } = await supabase
              .from("user_pins")
              .insert({
                user_id: userId,
                article_id: articleId,
              });

            if (insError) {
              console.error("Error pinning article:", insError);
              showError("Could not pin this article. Please try again.");
            } else {
              isPinnedByUser = true;
            }
          }
        } catch (err) {
          console.error("Unexpected pin toggle error:", err);
          showError("Something went wrong changing your pin.");
        } finally {
          updatePinMeButtonUI();
          pinMeBtn.disabled = false;
        }
      }

      await loadUserPinState();

      if (pinMeBtn) {
        pinMeBtn.addEventListener("click", toggleUserPin);
      }

      // -----------------------------
      // C. FLAG FUNCTIONALITY
      // -----------------------------
      function openFlagModal() {
        if (flagModal) flagModal.style.display = "block";
      }

      function closeFlagModal() {
        if (flagModal) flagModal.style.display = "none";
        if (flagReasonInput) flagReasonInput.value = "";
      }

      async function submitFlag() {
        if (!flagReasonInput || !flagReasonInput.value.trim()) {
          alert("Please enter a reason for flagging this article.");
          return;
        }

        const reason = flagReasonInput.value.trim();

        if (flagSubmitBtn) flagSubmitBtn.disabled = true;

        const { error: flagError } = await supabase.from("article_flags").insert({
          article_id: articleId,
          user_id: userId,
          reason: reason,
        });

        if (flagSubmitBtn) flagSubmitBtn.disabled = false;

        if (flagError) {
          console.error("Error submitting flag:", flagError);
          alert("Could not submit your flag. Please try again.");
          return;
        }

        alert("Thank you — your flag has been submitted.");
        closeFlagModal();
      }

      if (flagBtn) {
        flagBtn.addEventListener("click", openFlagModal);
      }

      if (flagCancelBtn) {
        flagCancelBtn.addEventListener("click", closeFlagModal);
      }

      if (flagSubmitBtn) {
        flagSubmitBtn.addEventListener("click", submitFlag);
      }
    })().catch((err) => {
      console.error("[Clara] Unexpected error in article page logic:", err);
    });
  };

  // ----------------------------------------
  // 3. DASHBOARD PAGE
  // ----------------------------------------
  Clara.initDashboard = function () {
    const greetingEl = document.getElementById("dashboard-greeting");
    const importantList = document.getElementById("important-articles-list");
    const pinnedList = document.getElementById("my-pinned-articles-list");

    // Sentinel: if none of these exist, we are not on the dashboard
    if (!greetingEl && !importantList && !pinnedList) return;

    const supabase = getSupabaseOrWarn("Dashboard");
    if (!supabase) return;

    // Helper to render a list of articles into a container
    function renderArticles(container, articles, emptyMessage) {
      if (!container) return;

      if (!articles || articles.length === 0) {
        container.innerHTML = `<p>${emptyMessage}</p>`;
        return;
      }

      container.innerHTML = "";
      articles.forEach((article) => {
        const card = document.createElement("div");
        card.className = "article-card";

        const created = article.created_at ? new Date(article.created_at) : null;
        const createdText = created
          ? created.toLocaleDateString("en-GB", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "";

        card.innerHTML = `
          <h3>${article.title}</h3>
          <p>${article.excerpt || ""}</p>
          ${createdText ? `<small>Created: ${createdText}</small>` : ""}
        `;

        container.appendChild(card);
      });
    }

    (async () => {
      // 1) Check user is logged in
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData || !userData.user) {
        // Not logged in – send to login page
        window.location.href = "/login";
        return;
      }

      const user = userData.user;

      // 2) Get profile (name, role, team, etc.)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, name, role, team")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Error loading profile:", profileError);
        if (greetingEl) greetingEl.textContent = "Hello!";
      } else {
        if (greetingEl) {
          const displayName = profile.name || "";
          greetingEl.textContent = displayName
            ? `Hello, ${displayName}`
            : "Hello!";
        }

        // Show admin-only elements if role is admin
        if (profile.role === "admin") {
          document.querySelectorAll(".admin-only").forEach((el) => {
            el.style.display = "block";
          });
        } else {
          document.querySelectorAll(".admin-only").forEach((el) => {
            el.style.display = "none";
          });
        }
      }

      // 3) Load Important Articles (admin-pinned for everyone)
      const { data: importantArticles, error: importantError } = await supabase
        .from("articles")
        .select("id, title, excerpt, created_at")
        .eq("is_pinned_by_admin", true)
        .order("created_at", { ascending: false })
        .limit(10);

      if (importantError) {
        console.error("Error loading important articles:", importantError);
        if (importantList) {
          importantList.innerHTML =
            "<p>Could not load important articles.</p>";
        }
      } else {
        renderArticles(
          importantList,
          importantArticles,
          "No important articles have been pinned yet."
        );
      }

      // 4) Load My Pinned Articles (user_pins for this user)
      const { data: pins, error: pinsError } = await supabase
        .from("user_pins")
        .select("article_id")
        .eq("user_id", user.id);

      if (pinsError) {
        console.error("Error loading user pins:", pinsError);
        if (pinnedList) {
          pinnedList.innerHTML = "<p>Could not load your pinned articles.</p>";
        }
        return;
      }

      if (!pins || pins.length === 0) {
        renderArticles(
          pinnedList,
          [],
          "You have not pinned any articles yet."
        );
        return;
      }

      const articleIds = pins.map((p) => p.article_id);

      const { data: myPinnedArticles, error: myPinnedError } = await supabase
        .from("articles")
        .select("id, title, excerpt, created_at")
        .in("id", articleIds)
        .order("created_at", { ascending: false });

      if (myPinnedError) {
        console.error("Error loading pinned articles:", myPinnedError);
        if (pinnedList) {
          pinnedList.innerHTML = "<p>Could not load your pinned articles.</p>";
        }
      } else {
        renderArticles(
          pinnedList,
          myPinnedArticles,
          "You have not pinned any articles yet."
        );
      }
    })().catch((err) => {
      console.error("[Clara] Unexpected error in dashboard logic:", err);
    });
  };

  // ----------------------------------------
  // 4. ALL ARTICLES PAGE (LIST)
  // ----------------------------------------
  Clara.initAllArticlesPage = function () {
    const container = document.getElementById("articles-list");
    if (!container) return; // Not on this page

    const supabase = getSupabaseOrWarn("All articles page");
    if (!supabase) return;

    (async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, excerpt, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading articles:", error);
        container.innerHTML =
          "<p>Sorry, there was a problem loading the articles.</p>";
        return;
      }

      if (!data || data.length === 0) {
        container.innerHTML = "<p>No articles yet.</p>";
        return;
      }

      container.innerHTML = ""; // clear any placeholder

      data.forEach((article) => {
        const card = document.createElement("div");
        card.className = "article-card";

        const created = new Date(article.created_at);
        const createdText = created.toLocaleDateString("en-GB", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        card.innerHTML = `
          <h3>${article.title}</h3>
          <p>${article.excerpt || ""}</p>
          <small>Created: ${createdText}</small>
        `;

        // Later you can add a click to go to /article?id=ARTICLE_ID etc.
        container.appendChild(card);
      });
    })().catch((err) => {
      console.error("[Clara] Unexpected error in all-articles list logic:", err);
    });
  };
  
  // ----------------------------------------
  // 5. LOGOUT BUTTON
  // ----------------------------------------
  Clara.initLogout = function () {
    const logoutBtn = document.getElementById("logout-btn");
    if (!logoutBtn) return; // Not on a page with a logout button

    const supabase = getSupabaseOrWarn("Logout");
    if (!supabase) return;

    logoutBtn.addEventListener("click", async (event) => {
      event.preventDefault();

      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error("[Clara] Logout error:", error);
          alert("There was a problem logging you out. Please try again.");
          return;
        }

        // Clear any client-side state you rely on
        sessionStorage.clear();
        // If you later store app-specific data in localStorage, clear it here too

        // Send the user back to the login page
        window.location.href = "/login";
      } catch (err) {
        console.error("[Clara] Unexpected logout error:", err);
        alert("There was a problem logging you out. Please try again.");
      }
    });
  };

  // ----------------------------------------
  // DOM READY – RUN ALL INIT FUNCTIONS
  // ----------------------------------------
  document.addEventListener("DOMContentLoaded", function () {
    try {
      Clara.initLoginPage && Clara.initLoginPage();
      Clara.initArticlePage && Clara.initArticlePage();
      Clara.initDashboard && Clara.initDashboard();
      Clara.initAllArticlesPage && Clara.initAllArticlesPage();
      Clara.initLogout && Clara.initLogout(); // 🔹 NEW
    } catch (err) {
      console.error("[Clara] Error initialising Clara global JS:", err);
    }
  });

})();
