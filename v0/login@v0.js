<script>
  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("login-form");
    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");
    const errorBox = document.getElementById("login-error");

    if (!form) return;

    // If already logged in, send straight to dashboard
    (async () => {
      const { data } = await window.supabase.auth.getUser();
      if (data && data.user) {
        window.location.href = "/dashboard";
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

      const { data, error } = await window.supabase.auth.signInWithPassword({
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
    });
  });
</script>
