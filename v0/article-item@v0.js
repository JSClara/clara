<script>
  document.addEventListener("DOMContentLoaded", async () => {
    // -----------------------------
    // Grab elements
    // -----------------------------
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
    const modalArticleTitleEl = document.getElementById("flag-modal-article-title");

    function showError(message) {
      if (!errorEl) {
        console.error(message);
        alert(message);
        return;
      }
      errorEl.textContent = message;
      errorEl.style.display = "block";
    }

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

    if (authError || !authData.user) {
      console.error("Not logged in:", authError);
      window.location.href = "/login";
      return;
    }

    const userId = authData.user.id;

    // -----------------------------
    // Get user's profile to check admin role
    // -----------------------------
    let isAdmin = false;

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

    if (categoryEl) categoryEl.textContent = article.category || "Uncategorised";
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
        .select("user_id") // any existing column is fine
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
    // Show the modal
    function openFlagModal() {
      if (flagModal) flagModal.style.display = "block";
    }

    // Hide the modal
    function closeFlagModal() {
      if (flagModal) flagModal.style.display = "none";
      if (flagReasonInput) flagReasonInput.value = "";
    }

    // Handle flag submit
    async function submitFlag() {
      if (!flagReasonInput || !flagReasonInput.value.trim()) {
        alert("Please enter a reason for flagging this article.");
        return;
      }

      const reason = flagReasonInput.value.trim();

      if (flagSubmitBtn) flagSubmitBtn.disabled = true;

      const { error: flagError } = await supabase
        .from("article_flags")
        .insert({
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

    // Bind flag events
    if (flagBtn) {
      flagBtn.addEventListener("click", openFlagModal);
    }

    if (flagCancelBtn) {
      flagCancelBtn.addEventListener("click", closeFlagModal);
    }

    if (flagSubmitBtn) {
      flagSubmitBtn.addEventListener("click", submitFlag);
    }
  });
</script>
