<script>
  document.addEventListener("DOMContentLoaded", async () => {
    const greetingEl = document.getElementById("dashboard-greeting");
    const importantList = document.getElementById("important-articles-list");
    const pinnedList = document.getElementById("my-pinned-articles-list");

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

        // Later, you can add onclick to go to /article?id=ARTICLE_ID etc.
        container.appendChild(card);
      });
    }

    // 1) Check user is logged in
    const { data: userData, error: userError } = await window.supabase.auth.getUser();

    if (userError || !userData || !userData.user) {
      // Not logged in – send to login page
      window.location.href = "/login";
      return;
    }

    const user = userData.user;

    // 2) Get profile (name, role, team, etc.)
    const { data: profile, error: profileError } = await window.supabase
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
    const { data: importantArticles, error: importantError } = await window.supabase
      .from("articles")
      .select("id, title, excerpt, created_at")
      .eq("is_pinned_by_admin", true)
      .order("created_at", { ascending: false })
      .limit(10);

    if (importantError) {
      console.error("Error loading important articles:", importantError);
      if (importantList) importantList.innerHTML = "<p>Could not load important articles.</p>";
    } else {
      renderArticles(
        importantList,
        importantArticles,
        "No important articles have been pinned yet."
      );
    }

    // 4) Load My Pinned Articles (user_pins for this user)
    const { data: pins, error: pinsError } = await window.supabase
      .from("user_pins")
      .select("article_id")
      .eq("user_id", user.id);

    if (pinsError) {
      console.error("Error loading user pins:", pinsError);
      if (pinnedList) pinnedList.innerHTML = "<p>Could not load your pinned articles.</p>";
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

    const { data: myPinnedArticles, error: myPinnedError } = await window.supabase
      .from("articles")
      .select("id, title, excerpt, created_at")
      .in("id", articleIds)
      .order("created_at", { ascending: false });

    if (myPinnedError) {
      console.error("Error loading pinned articles:", myPinnedError);
      if (pinnedList) pinnedList.innerHTML = "<p>Could not load your pinned articles.</p>";
    } else {
      renderArticles(
        pinnedList,
        myPinnedArticles,
        "You have not pinned any articles yet."
      );
    }
  });
</script>
