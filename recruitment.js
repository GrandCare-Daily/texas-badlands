/* Texas Badlands Recruitment HQ
 * Public URL and publishable key only. Never place secret/service-role credentials here.
 * Depends on the existing Supabase RLS policies. No browser-side admin bypass.
 */
(function () {
  "use strict";

  const PROJECT_URL = "https://vpfzqxwpjulcwzaaqmtc.supabase.co";
  const PUBLISHABLE_KEY = "sb_publishable_pi-TdPeYKDEcpuTdJvYnzQ_6jBA8_do";
  const client = window.supabase && window.supabase.createClient(
    PROJECT_URL, PUBLISHABLE_KEY,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );

  const byId = (id) => document.getElementById(id);
  const state = { user: null, profile: null, contest: null, ownReferral: null, staffRole: null };
  const invitedCode = new URLSearchParams(window.location.search).get("ref");
  if (invitedCode && /^[a-z0-9]{12}$/i.test(invitedCode)) {
    localStorage.setItem("tb_referral_pending", invitedCode.toUpperCase());
  }
  byId("year").textContent = String(new Date().getFullYear());

  function message(text, isError) {
    const notice = byId("alert");
    notice.textContent = text;
    notice.classList.toggle("error", !!isError);
    notice.hidden = false;
    notice.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function errorText(error) {
    return error && error.message ? error.message : "An unexpected error occurred.";
  }
  function formatDate(iso) {
    if (!iso) return "Not recorded";
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago", year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short"
    });
  }
  function formatLocalField(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
  function make(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }
  function clear(node) {
    node.replaceChildren();
  }
  function line(root, strong, smaller) {
    const box = make("div", null, "stack-item");
    box.appendChild(make("strong", strong));
    if (smaller) box.appendChild(make("small", smaller));
    root.appendChild(box);
    return box;
  }
  function isContestActive() {
    const c = state.contest;
    return c && c.status === "active" && Date.now() >= Date.parse(c.starts_at)
      && Date.now() < Date.parse(c.ends_at);
  }
  function requireUser() {
    if (!state.user) throw new Error("Please sign in first.");
  }

  async function loadContest() {
    const { data, error } = await client.from("tb_contests")
      .select("id,title,status,starts_at,ends_at,min_verified_minutes,min_active_days,qualification_days")
      .eq("id", 1).maybeSingle();
    if (error) {
      byId("contestStatus").textContent = "Not available";
      byId("contestDates").textContent = "Contest data unavailable. Contact the server owner.";
      throw error;
    }
    state.contest = data;
    byId("contestStatus").textContent = data ? data.status : "Not configured";
    byId("contestDates").textContent = data
      ? (data.status === "draft" ? "Registration preparation is underway. No referrals count until the contest opens."
        : "From " + formatDate(data.starts_at) + " to " + formatDate(data.ends_at))
      : "No recruitment contest record exists.";
    byId("claimNote").textContent = isContestActive()
      ? "Your confirmation counts as a pending referral. Staff verifies playtime later."
      : "The contest is not accepting new referrals yet.";
    byId("claimForm").querySelector("button").disabled = !isContestActive();
    byId("adminContestDetails").textContent = data
      ? "Current status: " + data.status + ". Opens: " + formatDate(data.starts_at)
        + ". Ends: " + formatDate(data.ends_at)
      : "Contest not found.";
    byId("activateContest").disabled = !data || data.status === "active";
    byId("closeContest").disabled = !data || data.status !== "active";
  }

  async function loadLeaderboard() {
    const root = byId("leaderboardBody");
    clear(root);
    const { data, error } = await client.from("tb_leaderboard")
      .select("dayz_name,qualified_recruits").gt("qualified_recruits", 0)
      .order("qualified_recruits", { ascending: false })
      .order("dayz_name", { ascending: true }).limit(50);
    if (error) {
      const tr = make("tr");
      const td = make("td", "Could not load leaderboard.", "muted");
      td.colSpan = 3; tr.appendChild(td); root.appendChild(tr);
      return;
    }
    if (!data || !data.length) {
      const tr = make("tr");
      const td = make("td", "No verified recruits yet. Be the first to earn a point!", "muted");
      td.colSpan = 3; tr.appendChild(td); root.appendChild(tr);
      return;
    }
    data.forEach((player, i) => {
      const tr = make("tr");
      [String(i + 1), player.dayz_name, String(player.qualified_recruits)].forEach(value => {
        tr.appendChild(make("td", value));
      });
      root.appendChild(tr);
    });
  }

  async function loadIdentity() {
    const { data: result, error } = await client.auth.getUser();
    if (error) console.warn("Authentication check:", error.message);
    state.user = result && result.user || null;
    state.profile = null;
    state.ownReferral = null;
    state.staffRole = null;
    byId("signedIn").hidden = !state.user;
    byId("signedOut").hidden = !!state.user;
    byId("adminPanel").hidden = true;
    if (!state.user) return;

    const { data: profile, error: profileError } = await client.from("tb_players")
      .select("id,dayz_name,referral_code").eq("id", state.user.id).maybeSingle();
    if (profileError || !profile) {
      message("Your account is signed in, but its player profile could not be loaded. " +
        errorText(profileError), true);
      return;
    }
    state.profile = profile;
    byId("accountName").textContent = profile.dayz_name;
    byId("accountEmail").textContent = state.user.email || "";
    byId("myCode").textContent = profile.referral_code;
    byId("editName").value = profile.dayz_name;
    byId("shareLink").value = new URL("/recruitment.html?ref=" + encodeURIComponent(profile.referral_code),
      window.location.origin).href;
    const saved = localStorage.getItem("tb_referral_pending");
    if (saved) byId("claimCode").value = saved;
    await Promise.all([loadMyRecruits(), loadMyInviter()]);
    // If the owner has not installed the staff-role RPC, fail closed.
    const roleResult = await client.rpc("tb_my_staff_role");
    if (!roleResult.error && ["owner", "admin", "reviewer"].includes(roleResult.data)) {
      state.staffRole = roleResult.data;
      byId("adminPanel").hidden = false;
      await loadAdmin();
    }
  }

  async function loadMyRecruits() {
    const root = byId("myRecruits");
    clear(root);
    const { data, error } = await client.from("tb_referrals")
      .select("id,recruit_id,status,verified_minutes,verified_days,claimed_at")
      .eq("recruiter_id", state.user.id).eq("contest_id", 1)
      .order("claimed_at", { ascending: false });
    if (error) { line(root, "Unable to load recruits", errorText(error)); return; }
    if (!data || !data.length) {
      line(root, "No confirmed recruits yet", "Share your personal referral URL to get started.");
      return;
    }
    const ids = data.map(r => r.recruit_id);
    const { data: names } = await client.from("tb_players").select("id,dayz_name").in("id", ids);
    const nameMap = new Map((names || []).map(p => [p.id, p.dayz_name]));
    for (const r of data) {
      const box = line(root, nameMap.get(r.recruit_id) || "Survivor",
        r.verified_minutes + " verified minutes · " + r.verified_days + " verified day(s)");
      box.appendChild(make("span", r.status, "status"));
    }
  }

  async function loadMyInviter() {
    const target = byId("myInviter");
    const list = byId("myCheckins");
    clear(list);
    const { data, error } = await client.from("tb_referrals")
      .select("id,recruiter_id,status,verified_minutes,verified_days")
      .eq("recruit_id", state.user.id).eq("contest_id", 1).maybeSingle();
    state.ownReferral = data || null;
    byId("checkinForm").hidden = !data;
    if (error) { target.textContent = errorText(error); return; }
    if (!data) {
      target.textContent = "No recruiter confirmed yet. If someone invited you, enter their code above.";
      return;
    }
    const { data: inviter } = await client.from("tb_players").select("dayz_name")
      .eq("id", data.recruiter_id).maybeSingle();
    target.textContent = "Recruited by " + (inviter ? inviter.dayz_name : "another survivor")
      + ". Status: " + data.status + ". Verified: " + data.verified_minutes
      + " minutes over " + data.verified_days + " days.";
    const { data: checkins, error: checkinError } = await client.from("tb_checkins")
      .select("reported_start,reported_end,review_status,reviewer_note")
      .eq("referral_id", data.id).order("reported_start", { ascending: false }).limit(30);
    if (checkinError) { line(list, "Unable to load check-ins", errorText(checkinError)); return; }
    (checkins || []).forEach(c => {
      line(list, formatDate(c.reported_start) + " to " + formatDate(c.reported_end),
        "Review: " + c.review_status + (c.reviewer_note ? " · " + c.reviewer_note : ""));
    });
  }

  async function claimReferral(event) {
    event.preventDefault();
    try {
      requireUser();
      if (!isContestActive()) throw new Error("The contest is not accepting referrals yet.");
      const code = byId("claimCode").value.trim().toUpperCase();
      if (!/^[A-Z0-9]{12}$/.test(code)) throw new Error("Enter a valid 12-character referral code.");
      const { data: recruiter, error: lookupError } = await client.from("tb_players")
        .select("id,dayz_name").eq("referral_code", code).maybeSingle();
      if (lookupError) throw lookupError;
      if (!recruiter) throw new Error("No recruiter has that code.");
      if (recruiter.id === state.user.id) throw new Error("You cannot refer yourself.");
      const agreed = window.confirm("Confirm that " + recruiter.dayz_name +
        " genuinely invited you to Texas Badlands? This can only be claimed once.");
      if (!agreed) return;
      const { error } = await client.from("tb_referrals")
        .insert({ contest_id: 1, recruiter_id: recruiter.id, recruit_id: state.user.id });
      if (error) throw error;
      localStorage.removeItem("tb_referral_pending");
      byId("claimCode").value = "";
      message("Referral confirmed! Your playtime will count only after staff verification.");
      await Promise.all([loadMyInviter(), loadMyRecruits()]);
    } catch (err) { message(errorText(err), true); }
  }

  async function submitCheckin(event) {
    event.preventDefault();
    try {
      requireUser();
      if (!state.ownReferral) throw new Error("Confirm your recruiter first.");
      const start = new Date(byId("playedStart").value);
      const end = new Date(byId("playedEnd").value);
      const duration = end.getTime() - start.getTime();
      if (!Number.isFinite(duration) || duration <= 0 || duration > 24 * 3600000) {
        throw new Error("Enter a valid session between 1 minute and 24 hours.");
      }
      if (start.getTime() > Date.now()) throw new Error("Session start cannot be in the future.");
      if (end.getTime() > Date.now() + 60000) throw new Error("Session end cannot be in the future.");
      const { error } = await client.from("tb_checkins").insert({
        referral_id: state.ownReferral.id, reported_start: start.toISOString(),
        reported_end: end.toISOString(), player_note: byId("checkinNote").value.trim()
      });
      if (error) throw error;
      byId("checkinForm").reset();
      message("Check-in received. Your playtime stays unverified until staff approves it.");
      await loadMyInviter();
    } catch (err) { message(errorText(err), true); }
  }

  async function loadAdmin() {
    if (!state.staffRole) return;
    await Promise.all([loadAdminCheckins(), loadAdminReferrals()]);
  }

  async function loadAdminCheckins() {
    const root = byId("adminCheckins");
    clear(root);
    const { data, error } = await client.from("tb_checkins")
      .select("id,referral_id,reported_start,reported_end,player_note,review_status")
      .eq("review_status", "pending").order("created_at", { ascending: true }).limit(100);
    if (error) { line(root, "Could not load check-ins", errorText(error)); return; }
    if (!data || !data.length) { line(root, "No pending check-ins"); return; }
    data.forEach(c => {
      const box = line(root, formatDate(c.reported_start) + " → " + formatDate(c.reported_end),
        "Referral " + c.referral_id + (c.player_note ? " · " + c.player_note : ""));
      const buttons = make("div", null, "admin-actions");
      [["Approve", "approved"], ["Reject", "rejected"]].forEach(([label, status]) => {
        const button = make("button", label, status === "approved" ? "button" : "button secondary");
        button.type = "button";
        button.addEventListener("click", async () => {
          if (!window.confirm(label + " this session?")) return;
          button.disabled = true;
          const { error: saveError } = await client.from("tb_checkins").update({
            review_status: status, reviewed_by: state.user.id, reviewed_at: new Date().toISOString()
          }).eq("id", c.id);
          if (saveError) message(errorText(saveError), true);
          else { message("Check-in " + status + "."); await refreshData(); }
          button.disabled = false;
        });
        buttons.appendChild(button);
      });
      box.appendChild(buttons);
    });
  }

  async function loadAdminReferrals() {
    const root = byId("adminReferrals");
    clear(root);
    const { data, error } = await client.from("tb_referrals")
      .select("id,recruiter_id,recruit_id,status,first_joined_at,verified_minutes,verified_days,claimed_at")
      .eq("contest_id", 1).order("claimed_at", { ascending: false }).limit(100);
    if (error) { line(root, "Could not load referrals", errorText(error)); return; }
    if (!data || !data.length) { line(root, "No referrals yet"); return; }
    const ids = [...new Set(data.flatMap(r => [r.recruiter_id, r.recruit_id]))];
    const { data: names } = await client.from("tb_players").select("id,dayz_name").in("id", ids);
    const nameMap = new Map((names || []).map(p => [p.id, p.dayz_name]));
    data.forEach(r => {
      const box = line(root,
        (nameMap.get(r.recruit_id) || "Recruit") + " ← " + (nameMap.get(r.recruiter_id) || "Recruiter"),
        "Status: " + r.status + " · " + r.verified_minutes + " verified minutes · "
        + r.verified_days + " days · First join: " + formatDate(r.first_joined_at));
      const form = make("form", null, "admin-form");
      const labelStart = make("label", "Verified session start (local time)");
      const start = make("input"); start.type = "datetime-local"; start.required = true;
      const labelEnd = make("label", "Verified session end (local time)");
      const end = make("input"); end.type = "datetime-local"; end.required = true;
      const save = make("button", "Record Verified Session", "button");
      save.type = "submit";
      form.append(labelStart, labelEnd, start, end, save);
      form.addEventListener("submit", async e => {
        e.preventDefault();
        const startDate = new Date(start.value);
        const endDate = new Date(end.value);
        if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())
          || endDate <= startDate || endDate - startDate > 86400000) {
          message("Enter a valid verified session shorter than 24 hours.", true);
          return;
        }
        if (!window.confirm("Record this session as VERIFIED? Only do so after checking server evidence.")) return;
        const { error: addError } = await client.from("tb_verified_sessions").insert({
          referral_id: r.id, session_start: startDate.toISOString(),
          session_end: endDate.toISOString(), source: "manual", recorded_by: state.user.id
        });
        if (addError) message(errorText(addError), true);
        else { message("Verified session recorded."); await refreshData(); }
      });
      box.appendChild(form);
      const joinedForm = make("form", null, "inline-input");
      joinedForm.style.marginTop = "15px";
      const joined = make("input");
      joined.type = "datetime-local";
      joined.value = formatLocalField(r.first_joined_at);
      joined.setAttribute("aria-label", "Actual first DayZ join time");
      const joinedSave = make("button", "Save First Join", "button secondary");
      joinedSave.type = "submit";
      joinedForm.append(joined, joinedSave);
      joinedForm.addEventListener("submit", async e => {
        e.preventDefault();
        if (!joined.value) { message("Enter the recruit's actual first DayZ join time.", true); return; }
        const dt = new Date(joined.value);
        if (!Number.isFinite(dt.getTime())) { message("Invalid date.", true); return; }
        const { error: saveError } = await client.from("tb_referrals")
          .update({ first_joined_at: dt.toISOString() }).eq("id", r.id);
        if (saveError) message(errorText(saveError), true);
        else { message("First join date saved."); await refreshData(); }
      });
      box.appendChild(joinedForm);
    });
  }

  async function refreshData() {
    await loadContest();
    await loadLeaderboard();
    if (state.user && state.profile) {
      await Promise.all([loadMyRecruits(), loadMyInviter()]);
      if (state.staffRole) await loadAdmin();
    }
  }

  byId("signupForm").addEventListener("submit", async e => {
    e.preventDefault();
    const email = byId("signupEmail").value.trim();
    const password = byId("signupPassword").value;
    const name = byId("signupName").value.trim();
    if (!name || name.length > 32) return message("Enter a DayZ name under 33 characters.", true);
    const { data, error } = await client.auth.signUp({
      email, password, options: {
        data: { dayz_name: name },
        emailRedirectTo: window.location.origin + "/recruitment.html"
      }
    });
    if (error) return message(errorText(error), true);
    message(data.session ? "Account created and signed in." :
      "Registration submitted. Check your email for a Supabase confirmation link, then return and sign in.");
    if (data.session) await loadIdentity();
  });

  byId("signinForm").addEventListener("submit", async e => {
    e.preventDefault();
    const { error } = await client.auth.signInWithPassword({
      email: byId("loginEmail").value.trim(), password: byId("loginPassword").value
    });
    if (error) return message(errorText(error), true);
    message("Welcome back to the Badlands.");
    await loadIdentity();
  });

  byId("resetPassword").addEventListener("click", async () => {
    const email = window.prompt("Enter the email address registered to your recruitment account:");
    if (!email) return;
    const { error } = await client.auth.resetPasswordForEmail(email.trim(),
      { redirectTo: window.location.origin + "/recruitment.html" });
    message(error ? errorText(error) : "If that account exists, a password reset email will be sent.", !!error);
  });

  byId("signout").addEventListener("click", async () => {
    const { error } = await client.auth.signOut();
    if (error) return message(errorText(error), true);
    await loadIdentity();
    message("You have signed out.");
  });

  byId("copyLink").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(byId("shareLink").value); message("Recruitment link copied."); }
    catch { byId("shareLink").select(); message("Select and copy the referral URL from the text box."); }
  });

  byId("nameForm").addEventListener("submit", async e => {
    e.preventDefault();
    try {
      requireUser();
      const name = byId("editName").value.trim();
      if (!name || name.length > 32) throw new Error("Enter a DayZ name under 33 characters.");
      const { error } = await client.from("tb_players").update({ dayz_name: name })
        .eq("id", state.user.id);
      if (error) throw error;
      message("DayZ name saved.");
      await loadIdentity();
      await loadLeaderboard();
    } catch (err) { message(errorText(err), true); }
  });

  byId("claimForm").addEventListener("submit", claimReferral);
  byId("checkinForm").addEventListener("submit", submitCheckin);

  byId("activateContest").addEventListener("click", async () => {
    if (!state.staffRole || state.staffRole !== "owner") {
      message("Only the contest owner should activate the competition.", true); return;
    }
    if (!window.confirm("Start the 30-day challenge NOW? Referral claims will open.")) return;
    const starts = new Date();
    const ends = new Date(starts.getTime() + 30 * 86400000);
    const { error } = await client.from("tb_contests").update({
      status: "active", starts_at: starts.toISOString(), ends_at: ends.toISOString()
    }).eq("id", 1);
    if (error) message(errorText(error), true);
    else { message("Contest activated."); await refreshData(); }
  });

  byId("closeContest").addEventListener("click", async () => {
    if (!state.staffRole || state.staffRole !== "owner") {
      message("Only the contest owner should complete the competition.", true); return;
    }
    if (!window.confirm("Close the contest? New claims will stop.")) return;
    const { error } = await client.from("tb_contests")
      .update({ status: "completed" }).eq("id", 1);
    if (error) message(errorText(error), true);
    else { message("Contest marked completed."); await refreshData(); }
  });

  async function init() {
    if (!client) {
      message("Unable to load the Supabase client. Please reload or check your connection.", true);
      return;
    }
    client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setTimeout(async () => {
          const password = window.prompt("Enter your new password (at least 8 characters):");
          if (password && password.length >= 8) {
            const { error } = await client.auth.updateUser({ password });
            message(error ? errorText(error) : "Password updated successfully.", !!error);
          }
        }, 0);
      }
      if (["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED", "TOKEN_REFRESHED"].includes(event)) {
        setTimeout(() => { loadIdentity().catch(err => message(errorText(err), true)); }, 0);
      }
    });
    try {
      await Promise.all([loadContest(), loadLeaderboard()]);
      await loadIdentity();
    } catch (err) { message(errorText(err), true); }
  }
  init();
})();
